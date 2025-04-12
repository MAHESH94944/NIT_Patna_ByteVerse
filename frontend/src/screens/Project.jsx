import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useLocation } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webcontainer';

// Custom syntax highlighting component
function SyntaxHighlightedCode(props) {
  const ref = useRef(null);

  React.useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current);
      ref.current.removeAttribute('data-highlighted');
    }
  }, [props.className, props.children]);

  return <code {...props} ref={ref} />;
}

const Project = () => {
  const location = useLocation();
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(new Set());
  const [project, setProject] = useState(location.state.project);
  const [message, setMessage] = useState('');
  const { user } = useContext(UserContext);
  const messageBox = React.createRef();

  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [fileTree, setFileTree] = useState({});
  const [currentFile, setCurrentFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [webContainer, setWebContainer] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [isWebContainerReady, setIsWebContainerReady] = useState(false);
  const [runProcess, setRunProcess] = useState(null);
  const [hasPackageJson, setHasPackageJson] = useState(false);
  const [isInstallingDeps, setIsInstallingDeps] = useState(false);
  const [outputLog, setOutputLog] = useState([]);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' or 'terminal'

  // Custom color theme
  const theme = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    dark: '#1e293b',
    light: '#f8fafc',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const handleUserClick = (id) => {
    setSelectedUserId(prevSelectedUserId => {
      const newSelectedUserId = new Set(prevSelectedUserId);
      if (newSelectedUserId.has(id)) {
        newSelectedUserId.delete(id);
      } else {
        newSelectedUserId.add(id);
      }
      return newSelectedUserId;
    });
  };

  function addCollaborators() {
    axios.put("/projects/add-user", {
      projectId: location.state.project._id,
      users: Array.from(selectedUserId)
    }).then(res => {
      console.log(res.data);
      setIsModalOpen(false);
    }).catch(err => {
      console.log(err);
    });
  }

  const send = () => {
    if (!message.trim()) return;

    sendMessage('project-message', {
      message,
      sender: user
    });
    setMessages(prevMessages => [...prevMessages, { sender: user, message }]);
    setMessage("");
    scrollToBottom();
  };

  function scrollToBottom() {
    if (messageBox.current) {
      messageBox.current.scrollTop = messageBox.current.scrollHeight;
    }
  }

  function WriteAiMessage(message) {
    const messageObject = JSON.parse(message);
    return (
      <div className='overflow-auto bg-gradient-to-r from-indigo-900 to-purple-800 text-white rounded-lg p-4 shadow-lg'>
        <Markdown
          children={messageObject.text}
          options={{
            overrides: {
              code: SyntaxHighlightedCode,
            },
          }}
        />
      </div>
    );
  }

  const checkForPackageJson = (fileTree) => {
    const hasPackage = Object.keys(fileTree).some(file =>
      file.toLowerCase() === 'package.json'
    );
    setHasPackageJson(hasPackage);
    return hasPackage;
  };

  const installDependencies = async () => {
    if (!webContainer || !hasPackageJson) return false;

    try {
      setIsInstallingDeps(true);
      setOutputLog(prev => [...prev, "Installing dependencies..."]);

      const installProcess = await webContainer.spawn("npm", ["install"]);

      // Capture install output
      const installOutput = [];
      const reader = installProcess.output.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = typeof value === 'string' ? value : new TextDecoder().decode(value);
        installOutput.push(text);
        setOutputLog(prev => [...prev, text]);
      }

      const exitCode = await installProcess.exit;
      setIsInstallingDeps(false);

      if (exitCode !== 0) {
        setOutputLog(prev => [...prev, `Install failed with code ${exitCode}`]);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Install error:', error);
      setOutputLog(prev => [...prev, `Install error: ${error.message}`]);
      setIsInstallingDeps(false);
      return false;
    }
  };

  const handleProcessOutput = async (process) => {
    const reader = process.output.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = typeof value === 'string' ? value : new TextDecoder().decode(value);
      setOutputLog(prev => [...prev, text]);
    }
  };

  useEffect(() => {
    initializeSocket(project._id);

    const initWebContainer = async () => {
      try {
        const container = await getWebContainer();
        setWebContainer(container);
        setIsWebContainerReady(true);
        console.log("WebContainer initialized");
      } catch (error) {
        console.error("Failed to initialize web container:", error);
      }
    };

    initWebContainer();

    receiveMessage('project-message', data => {
      if (data.sender._id === 'ai') {
        const message = JSON.parse(data.message);
        if (isWebContainerReady && webContainer) {
          webContainer.mount(message.fileTree);
        }
        if (message.fileTree) {
          setFileTree(message.fileTree || {});
          checkForPackageJson(message.fileTree);
        }
        setMessages(prevMessages => [...prevMessages, data]);
      } else {
        setMessages(prevMessages => [...prevMessages, data]);
      }
      scrollToBottom();
    });

    axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {
      setProject(res.data.project);
      const initialFileTree = res.data.project.fileTree || {};
      setFileTree(initialFileTree);
      checkForPackageJson(initialFileTree);
    });

    axios.get('/users/all').then(res => {
      setUsers(res.data.users);
    }).catch(err => {
      console.log(err);
    });

    // Cleanup function
    return () => {
      if (runProcess) {
        runProcess.kill();
      }
    };
  }, []);

  function saveFileTree(ft) {
    axios.put('/projects/update-file-tree', {
      projectId: project._id,
      fileTree: ft
    }).then(res => {
      console.log(res.data);
      checkForPackageJson(ft);
    }).catch(err => {
      console.log(err);
    });
  }

  const handleRun = async () => {
    if (!isWebContainerReady || !webContainer || !hasPackageJson) {
      console.error('Web container is not ready or missing package.json');
      return;
    }

    try {
      setOutputLog([]);
      await webContainer.mount(fileTree);

      // Install dependencies first
      const installSuccess = await installDependencies();
      if (!installSuccess) {
        setOutputLog(prev => [...prev, "Failed to install dependencies"]);
        return;
      }

      // Kill previous process if exists
      if (runProcess) {
        runProcess.kill();
      }

      // Start the application
      setOutputLog(prev => [...prev, "Starting application..."]);
      let tempRunProcess = await webContainer.spawn("npm", ["start"]);

      handleProcessOutput(tempRunProcess);
      setRunProcess(tempRunProcess);

      // Set iframe URL once server is ready
      webContainer.on('server-ready', (port, url) => {
        console.log('Server ready on:', port, url);
        setOutputLog(prev => [...prev, `Server ready at ${url}`]);
        setIframeUrl(url);
      });
    } catch (error) {
      console.error('Error during process execution:', error);
      setOutputLog(prev => [...prev, `Error: ${error.message}`]);
    }
  };

  return (
    <main className='h-screen w-screen flex bg-gray-100 overflow-hidden'>
      {/* Left panel - chat section */}
      <section className="left relative flex flex-col h-screen w-80 bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-xl">
        <header className='flex justify-between items-center p-4 w-full bg-gray-800 border-b border-gray-700'>
          <button
            className='flex gap-2 items-center bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors'
            onClick={() => setIsModalOpen(true)}
          >
            <i className="ri-add-line"></i>
            <span>Add collaborator</span>
          </button>
          <button
            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
            className='p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors'
          >
            <i className="ri-group-line"></i>
          </button>
        </header>

        <div className="conversation-area pt-4 pb-4 flex-grow flex flex-col h-full relative">
          <div
            ref={messageBox}
            className="message-box p-4 flex-grow flex flex-col gap-3 overflow-auto max-h-full scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${msg.sender._id === 'ai' ? 'max-w-full' : 'max-w-xs'} ${msg.sender._id === user._id.toString() ? 'ml-auto' : 'mr-auto'
                  } message flex flex-col p-3 rounded-xl ${msg.sender._id === user._id.toString()
                    ? 'bg-indigo-600 text-white'
                    : msg.sender._id === 'ai'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-600 text-white'
                  } shadow-md transition-all hover:shadow-lg`}
              >
                <small className={`text-xs ${msg.sender._id === user._id.toString()
                  ? 'text-indigo-200'
                  : 'text-gray-300'
                  }`}>
                  {msg.sender.email}
                </small>
                <div className='text-sm mt-1'>
                  {msg.sender._id === 'ai' ?
                    WriteAiMessage(msg.message)
                    : <p>{msg.message}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="inputField w-full flex p-4 bg-gray-800 border-t border-gray-700">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && send()}
              className='flex-grow p-3 rounded-l-lg bg-gray-700 text-white border-none outline-none focus:ring-2 focus:ring-indigo-500'
              type="text"
              placeholder='Type your message...'
            />
            <button
              onClick={send}
              className='px-5 bg-indigo-600 text-white rounded-r-lg hover:bg-indigo-700 transition-colors'
            >
              <i className="ri-send-plane-line"></i>
            </button>
          </div>
        </div>

        {/* Side panel for collaborators */}
        <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-gray-800 absolute transition-all duration-300 ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'
          } top-0 z-20 shadow-2xl`}>
          <header className='flex justify-between items-center px-4 py-3 bg-gray-900 border-b border-gray-700'>
            <h1 className='font-semibold text-lg flex items-center gap-2'>
              <i className="ri-team-line"></i>
              <span>Collaborators</span>
            </h1>
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className='p-2 text-gray-400 hover:text-white transition-colors'
            >
              <i className="ri-close-line"></i>
            </button>
          </header>
          <div className="users flex flex-col gap-1 p-2 overflow-y-auto">
            {project.users && project.users.map((user, index) => (
              <div
                key={index}
                className="user cursor-pointer hover:bg-gray-700 p-3 flex gap-3 items-center rounded-lg transition-colors"
              >
                <div className='relative'>
                  <div className='aspect-square rounded-full w-10 h-10 flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white'>
                    <i className="ri-user-line"></i>
                  </div>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'
                    }`}></span>
                </div>
                <div className='flex-1 min-w-0'>
                  <h1 className='font-medium truncate'>{user.email}</h1>
                  <small className='text-gray-400 text-xs truncate'>{user.role || 'Collaborator'}</small>
                </div>
                <button className='text-gray-400 hover:text-white transition-colors'>
                  <i className="ri-more-2-line"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right panel - code editor section */}
      <section className="right flex-grow h-full flex bg-white">
        {/* File explorer */}
        <div className="explorer h-full w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className='font-medium text-gray-700 flex items-center gap-2'>
              <i className="ri-folder-open-line"></i>
              <span>Files</span>
            </h2>
            <button className='text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-200'>
              <i className="ri-add-line"></i>
            </button>
          </div>
          <div className="file-tree flex-grow overflow-y-auto">
            {Object.keys(fileTree).map((file, index) => (
              <div
                key={index}
                onClick={() => {
                  setCurrentFile(file);
                  setOpenFiles([...new Set([...openFiles, file])]);
                }}
                className={`file-item cursor-pointer px-4 py-2 flex items-center gap-2 ${currentFile === file ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100 text-gray-700'
                  } transition-colors`}
              >
                <i className={`ri-${file.endsWith('.js') ? 'javascript-line' :
                  file.endsWith('.json') ? 'code-box-line' :
                    file.endsWith('.html') ? 'html5-line' :
                      file.endsWith('.css') ? 'css3-line' :
                        'file-line'
                  }`}></i>
                <span className='truncate'>{file}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code editor and terminal */}
        <div className="code-editor flex flex-col flex-grow h-full">
          {/* Editor tabs */}
          <div className="tabs flex justify-between w-full bg-gray-50 border-b border-gray-200">
            <div className="files flex overflow-x-auto">
              {openFiles.map((file, index) => (
                <div
                  key={index}
                  onClick={() => setCurrentFile(file)}
                  className={`tab-item flex items-center px-4 py-2 border-r border-gray-200 ${currentFile === file
                    ? 'bg-white border-t-2 border-t-indigo-500 text-indigo-600'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                    } cursor-pointer transition-colors`}
                >
                  <span className='truncate max-w-xs'>{file}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFiles(openFiles.filter(f => f !== file));
                      if (currentFile === file) {
                        setCurrentFile(openFiles.length > 1 ? openFiles[0] : null);
                      }
                    }}
                    className="ml-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
                  >
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
              ))}
            </div>

            <div className="actions flex items-center pr-3 gap-2 bg-gray-50">
              <div className="flex gap-1 rounded-md bg-gray-200 p-1">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1 rounded text-sm ${activeTab === 'editor' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  Editor
                </button>
                <button
                  onClick={() => setActiveTab('terminal')}
                  className={`px-3 py-1 rounded text-sm ${activeTab === 'terminal' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  Terminal
                </button>
              </div>

              <button
                onClick={handleRun}
                disabled={!isWebContainerReady || !hasPackageJson || isInstallingDeps}
                className={`px-3 py-1 rounded-md text-sm flex items-center gap-1 ${isWebContainerReady && hasPackageJson && !isInstallingDeps
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 cursor-not-allowed text-gray-500'
                  } transition-colors`}
                title={!hasPackageJson ? "Project requires package.json to run" : ""}
              >
                {isInstallingDeps ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    <span>Running</span>
                  </>
                ) : (
                  <>
                    <i className="ri-play-line"></i>
                    <span>Run</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Editor/terminal content */}
          <div className="flex flex-col flex-grow max-w-full shrink overflow-hidden bg-white">
            {/* Code editor area */}
            {activeTab === 'editor' && (
              <div className="code-editor-area h-full overflow-auto flex-grow">
                {fileTree[currentFile] ? (
                  <pre className="hljs h-full m-0">
                    <code
                      className="hljs h-full outline-none p-4"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const updatedContent = e.target.innerText;
                        const ft = {
                          ...fileTree,
                          [currentFile]: {
                            file: {
                              contents: updatedContent
                            }
                          }
                        };
                        setFileTree(ft);
                        saveFileTree(ft);
                      }}
                      dangerouslySetInnerHTML={{
                        __html: hljs.highlightAuto(fileTree[currentFile].file.contents).value
                      }}
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: '"Fira Code", monospace',
                        fontSize: '14px',
                        lineHeight: '1.5',
                      }}
                    />
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <i className="ri-file-code-line text-4xl mb-2"></i>
                    <p>Select a file to edit</p>
                  </div>
                )}
              </div>
            )}

            {/* Terminal output */}
            {activeTab === 'terminal' && (
              <div className="terminal h-full bg-gray-900 text-green-400 p-4 overflow-auto font-mono text-sm">
                <div className="terminal-header flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-400 ml-2">Terminal</span>
                </div>
                {outputLog.length > 0 ? (
                  outputLog.map((line, index) => (
                    <div key={index} className="terminal-line">
                      {line.startsWith('Error') || line.startsWith('npm ERR') ? (
                        <span className="text-red-400">{line}</span>
                      ) : line.startsWith('Warning') ? (
                        <span className="text-yellow-400">{line}</span>
                      ) : (
                        <span>{line}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">
                    <p>Output will appear here when you run your project...</p>
                    <p className="mt-2 text-gray-600">Try clicking the "Run" button above</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {iframeUrl && webContainer && (
          <div className="flex flex-col w-1/3 h-full border-l border-gray-200 bg-white">
            <div className="preview-header flex justify-between items-center p-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-700 flex items-center gap-2">
                <i className="ri-eye-line"></i>
                <span>Preview</span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setIframeUrl(iframeUrl)} // Refresh
                  className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                  title="Refresh"
                >
                  <i className="ri-refresh-line"></i>
                </button>
                <button
                  onClick={() => setIframeUrl(null)}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                  title="Close"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
            </div>
            <div className="preview-content flex-grow relative">
              <iframe
                src={iframeUrl}
                className="absolute inset-0 w-full h-full bg-white"
                title="Project Preview"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              {!iframeUrl && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <i className="ri-window-line text-4xl mb-2"></i>
                    <p>Preview will appear here when server starts</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Modal for adding collaborators */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-96 max-w-full relative max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <header className='flex justify-between items-center p-4 border-b'>
              <h2 className='text-xl font-semibold text-gray-800'>Add Collaborators</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className='p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100'
              >
                <i className="ri-close-line"></i>
              </button>
            </header>
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Search users..."
                className="w-full p-2 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="users-list flex-grow overflow-y-auto">
              {users.map(user => (
                <div
                  key={user._id}
                  className={`user p-3 flex items-center gap-3 cursor-pointer ${Array.from(selectedUserId).includes(user._id)
                    ? 'bg-indigo-50'
                    : 'hover:bg-gray-50'
                    } transition-colors`}
                  onClick={() => handleUserClick(user._id)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${Array.from(selectedUserId).includes(user._id)
                    ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-300'
                    : 'bg-gray-200 text-gray-600'
                    }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{user.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                  </div>
                  {Array.from(selectedUserId).includes(user._id) && (
                    <i className="ri-check-line text-indigo-600"></i>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg mr-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addCollaborators}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Project;