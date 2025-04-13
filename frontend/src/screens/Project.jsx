import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useLocation } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webcontainer';
import 'highlight.js/styles/vs2015.css';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-100 text-red-800 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p>Please refresh the page or try again later.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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

// File explorer item component
const FileItem = ({
  name,
  item,
  path,
  depth = 0,
  onFileClick,
  onFileDelete,
  currentFile,
  theme
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDirectory = !!item.directory;
  const hasChildren = isDirectory && Object.keys(item.directory).length > 0;

  const iconClass = isDirectory
    ? hasChildren
      ? isExpanded
        ? 'ri-folder-open-fill text-yellow-400'
        : 'ri-folder-fill text-yellow-400'
      : 'ri-folder-line text-yellow-400'
    : name.endsWith('.js') ? 'ri-javascript-line text-yellow-300' :
      name.endsWith('.json') ? 'ri-code-box-line text-yellow-300' :
        name.endsWith('.html') ? 'ri-html5-line text-orange-400' :
          name.endsWith('.css') ? 'ri-css3-line text-blue-400' :
            'ri-file-line text-gray-400';

  return (
    <div className="file-item-container">
      <div
        className={`file-item group flex items-center ${isDirectory ? 'cursor-pointer' : ''}`}
        style={{
          paddingLeft: `${depth * 12 + 12}px`,
          backgroundColor: currentFile === path ? theme.listActiveSelectionBackground : 'transparent'
        }}
      >
        {isDirectory && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white mr-1"
          >
            <i className={`ri-arrow-right-s-line transition-transform ${isExpanded ? 'rotate-90' : ''}`}></i>
          </button>
        )}
        {!isDirectory && <div className="w-5"></div>}

        <div
          onClick={() => isDirectory ? setIsExpanded(!isExpanded) : onFileClick(path)}
          className={`flex-1 flex items-center gap-1 py-1 ${isDirectory ? '' : 'hover:bg-gray-700'}`}
        >
          <i className={`${iconClass} text-sm`}></i>
          <span className="text-sm truncate">{name}</span>
        </div>

        {!isDirectory && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFileDelete(path);
            }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 px-2"
          >
            <i className="ri-close-line text-sm"></i>
          </button>
        )}
      </div>

      {isDirectory && isExpanded && (
        <div className="directory-contents">
          {Object.entries(item.directory).map(([childName, childItem]) => (
            <FileItem
              key={`${path}/${childName}`}
              name={childName}
              item={childItem}
              path={`${path}/${childName}`}
              depth={depth + 1}
              onFileClick={onFileClick}
              onFileDelete={onFileDelete}
              currentFile={currentFile}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Project = () => {
  const location = useLocation();
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(new Set());
  const [project, setProject] = useState(location.state?.project || {});
  const [message, setMessage] = useState('');
  const { user } = useContext(UserContext);
  const messageBox = useRef(null);

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
  const [activeTab, setActiveTab] = useState('editor');
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef(null);
  const [currentPath, setCurrentPath] = useState(''); // Track current directory path
  const [searchTerm, setSearchTerm] = useState('');

  // Terminal state
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [terminals, setTerminals] = useState([{ id: 1, name: 'Terminal 1', history: [] }]);
  const [activeTerminal, setActiveTerminal] = useState(1);
  const terminalEndRefs = useRef({});

  // Dependencies state
  const [installedDependencies, setInstalledDependencies] = useState({});
  const [isDependencyCacheValid, setIsDependencyCacheValid] = useState(false);

  // File system operations state
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFileModal, setShowFileModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [isFile, setIsFile] = useState(true);

  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // VS Code-like theme colors
  const theme = {
    dark: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      selection: '#264f78',
      sidebar: '#252526',
      sidebarBorder: '#1a1a1a',
      tabBar: '#2d2d2d',
      editorGroupHeader: '#252526',
      activityBar: '#333333',
      statusBar: '#007acc',
      inputBackground: '#3c3c3c',
      buttonBackground: '#0e639c',
      buttonHoverBackground: '#1177bb',
      listActiveSelectionBackground: '#094771',
      listHoverBackground: '#2a2d2e',
      scrollbar: '#3e3e3e',
      scrollbarHover: '#4a4a4a',
      terminalBackground: '#1e1e1e',
      terminalForeground: '#cccccc',
      terminalCursor: '#ffffff',
      terminalSelection: '#264f78',
    },
    light: {
      background: '#ffffff',
      foreground: '#333333',
      selection: '#add6ff',
      sidebar: '#f3f3f3',
      sidebarBorder: '#e0e0e0',
      tabBar: '#e5e5e5',
      editorGroupHeader: '#f3f3f3',
      activityBar: '#f3f3f3',
      statusBar: '#0078d4',
      inputBackground: '#ffffff',
      buttonBackground: '#0078d4',
      buttonHoverBackground: '#106ebe',
      listActiveSelectionBackground: '#e4e6f1',
      listHoverBackground: '#f0f0f0',
      scrollbar: '#e0e0e0',
      scrollbarHover: '#d0d0d0',
      terminalBackground: '#ffffff',
      terminalForeground: '#333333',
      terminalCursor: '#000000',
      terminalSelection: '#add6ff',
    }
  };

  const currentTheme = darkMode ? theme.dark : theme.light;

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newWidth = Math.max(150, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Scroll terminal to bottom
  const scrollTerminalToBottom = (terminalId) => {
    terminalEndRefs.current[terminalId]?.scrollIntoView({ behavior: 'smooth' });
  };

  // Helper function to navigate file tree
  const navigateFileTree = (path, tree) => {
    if (!path) return tree;

    const parts = path.split('/').filter(p => p);
    let current = tree;

    for (const part of parts) {
      if (current[part]?.directory) {
        current = current[part].directory;
      } else {
        return null;
      }
    }

    return current;
  };

  // Get current directory contents
  const getCurrentDirectoryContents = () => {
    const contents = navigateFileTree(currentPath, fileTree);
    return contents || {};
  };

  // Optimized dependency installation
  const installDependencies = async (force = false) => {
    if (!webContainer || !hasPackageJson) return false;

    try {
      // Check if we can skip installation
      if (isDependencyCacheValid && !force) {
        addTerminalOutput(activeTerminal, "Using cached dependencies");
        return true;
      }

      setIsInstallingDeps(true);
      addTerminalOutput(activeTerminal, "Installing dependencies...");

      const installProcess = await webContainer.spawn("npm", ["install"]);
      addTerminalOutput(activeTerminal, "npm install started");

      // Capture install output with proper error handling
      const installOutput = [];
      const reader = installProcess.output.getReader();

      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) break;

          let text;
          if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            text = new TextDecoder().decode(value);
          } else if (typeof value === 'string') {
            text = value;
          } else {
            console.warn('Unexpected output type:', typeof value);
            continue;
          }

          installOutput.push(text);
          addTerminalOutput(activeTerminal, text);
        } catch (error) {
          console.error('Error reading process output:', error);
          break;
        }
      }

      const exitCode = await installProcess.exit;
      setIsInstallingDeps(false);

      if (exitCode !== 0) {
        addTerminalOutput(activeTerminal, `Install failed with code ${exitCode}`);
        return false;
      }

      // Cache the installed dependencies
      const packageJson = JSON.parse(fileTree['package.json'].file.contents);
      setInstalledDependencies(packageJson.dependencies || {});
      setIsDependencyCacheValid(true);

      return true;
    } catch (error) {
      console.error('Install error:', error);
      addTerminalOutput(activeTerminal, `Install error: ${error.message}`);
      setIsInstallingDeps(false);
      return false;
    }
  };

  // Add terminal output helper
  const addTerminalOutput = (terminalId, text) => {
    setTerminals(prev => prev.map(term =>
      term.id === terminalId
        ? { ...term, history: [...term.history, { type: 'output', text }] }
        : term
    ));
    setTimeout(() => scrollTerminalToBottom(terminalId), 50);
  };

  // Handle terminal commands with proper output handling
  const handleTerminalCommand = async (command, terminalId) => {
    if (!command.trim()) return;

    // Add command to history
    setTerminals(prev => prev.map(term =>
      term.id === terminalId
        ? { ...term, history: [...term.history, { type: 'command', text: command }] }
        : term
    ));
    setTerminalInput('');

    try {
      const [cmd, ...args] = command.split(' ');

      // Handle special commands
      if (cmd === 'clear') {
        setTerminals(prev => prev.map(term =>
          term.id === terminalId ? { ...term, history: [] } : term
        ));
        return;
      }

      if (cmd === 'cd') {
        const newPath = args[0] || '';
        // Handle path navigation (simplified for example)
        addTerminalOutput(terminalId, `Changing directory to ${newPath}`);
        return;
      }

      // Execute command in web container
      const process = await webContainer.spawn(cmd, args);

      // Capture output with proper error handling
      const reader = process.output.getReader();

      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) break;

          let text;
          if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
            text = new TextDecoder().decode(value);
          } else if (typeof value === 'string') {
            text = value;
          } else {
            console.warn('Unexpected output type:', typeof value);
            continue;
          }

          addTerminalOutput(terminalId, text);
        } catch (error) {
          console.error('Error reading process output:', error);
          break;
        }
      }

      const exitCode = await process.exit;
      addTerminalOutput(terminalId, `Process exited with code ${exitCode}`);
    } catch (error) {
      addTerminalOutput(terminalId, `Error: ${error.message}`);
    }
  };

  // Add new terminal
  const addTerminal = () => {
    const newId = Math.max(...terminals.map(t => t.id), 0) + 1;
    setTerminals([...terminals, { id: newId, name: `Terminal ${newId}`, history: [] }]);
    setActiveTerminal(newId);
  };

  // Close terminal
  const closeTerminal = (id) => {
    if (terminals.length <= 1) return;
    const newTerminals = terminals.filter(t => t.id !== id);
    setTerminals(newTerminals);
    setActiveTerminal(newTerminals[newTerminals.length - 1].id);
  };

  // File system operations
  const createFile = async () => {
    if (!newFileName.trim()) return;

    try {
      const pathParts = currentPath ? currentPath.split('/').filter(p => p) : [];
      let current = { ...fileTree };

      // Navigate to the current directory
      for (const part of pathParts) {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }

      // Create the new file
      current[newFileName] = { file: { contents: '' } };

      setFileTree({ ...fileTree });
      saveFileTree(fileTree);
      setNewFileName('');
      setShowFileModal(false);

      // Open the new file
      const filePath = currentPath ? `${currentPath}/${newFileName}` : newFileName;
      setCurrentFile(filePath);
      setOpenFiles([...new Set([...openFiles, filePath])]);

    } catch (error) {
      console.error('Error creating file:', error);
      addTerminalOutput(activeTerminal, `Error creating file: ${error.message}`);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const pathParts = currentPath ? currentPath.split('/').filter(p => p) : [];
      let current = { ...fileTree };

      // Navigate to the current directory
      for (const part of pathParts) {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }

      // Create the new folder
      current[newFolderName] = { directory: {} };

      setFileTree({ ...fileTree });
      saveFileTree(fileTree);
      setNewFolderName('');
      setShowFolderModal(false);

    } catch (error) {
      console.error('Error creating folder:', error);
      addTerminalOutput(activeTerminal, `Error creating folder: ${error.message}`);
    }
  };

  const deleteFile = async (filePath) => {
    try {
      const pathParts = filePath.split('/').filter(p => p);
      let current = { ...fileTree };
      let parent = null;
      let key = null;

      // Navigate to the parent directory
      for (let i = 0; i < pathParts.length - 1; i++) {
        parent = current;
        current = current[pathParts[i]].directory;
        key = pathParts[i];
      }

      // Delete the file/folder
      const fileName = pathParts[pathParts.length - 1];
      delete current[fileName];

      setFileTree({ ...fileTree });
      saveFileTree(fileTree);

      // Close if open
      setOpenFiles(openFiles.filter(f => f !== filePath));
      if (currentFile === filePath) {
        setCurrentFile(openFiles.length > 1 ? openFiles[0] : null);
      }

    } catch (error) {
      console.error('Error deleting file:', error);
      addTerminalOutput(activeTerminal, `Error deleting file: ${error.message}`);
    }
  };

  const handleFileClick = (filePath) => {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];

    // Check if it's a directory
    const item = navigateFileTree(filePath, fileTree);
    if (item && item.directory) {
      setCurrentPath(filePath);
      return;
    }

    // It's a file, open it
    setCurrentFile(filePath);
    setOpenFiles([...new Set([...openFiles, filePath])]);
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
      projectId: location.state?.project?._id,
      users: Array.from(selectedUserId)
    }).then(res => {
      console.log(res.data);
      setIsModalOpen(false);
      setSelectedUserId(new Set());
    }).catch(err => {
      console.log(err);
      addTerminalOutput(activeTerminal, `Error adding collaborators: ${err.message}`);
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
    try {
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
    } catch (e) {
      return <div className="text-white p-4">{message}</div>;
    }
  }

  const checkForPackageJson = (fileTree) => {
    const hasPackage = Object.keys(fileTree).some(file =>
      file.toLowerCase() === 'package.json'
    );
    setHasPackageJson(hasPackage);
    return hasPackage;
  };

  const handleProcessOutput = async (process, terminalId) => {
    const reader = process.output.getReader();

    while (true) {
      try {
        const { done, value } = await reader.read();
        if (done) break;

        let text;
        if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
          text = new TextDecoder().decode(value);
        } else if (typeof value === 'string') {
          text = value;
        } else {
          console.warn('Unexpected output type:', typeof value);
          continue;
        }

        addTerminalOutput(terminalId, text);
      } catch (error) {
        console.error('Error reading process output:', error);
        break;
      }
    }
  };

  function saveFileTree(ft) {
    axios.put('/projects/update-file-tree', {
      projectId: project._id,
      fileTree: ft
    }).then(res => {
      console.log(res.data);
      checkForPackageJson(ft);
    }).catch(err => {
      console.log(err);
      addTerminalOutput(activeTerminal, `Error saving file tree: ${err.message}`);
    });
  }

  const handleRun = async () => {
    if (!isWebContainerReady || !webContainer || !hasPackageJson) {
      console.error('Web container is not ready or missing package.json');
      addTerminalOutput(activeTerminal, "Web container is not ready or missing package.json");
      return;
    }

    try {
      addTerminalOutput(activeTerminal, "Preparing to run project...");
      await webContainer.mount(fileTree);

      // Install dependencies first
      const installSuccess = await installDependencies();
      if (!installSuccess) {
        addTerminalOutput(activeTerminal, "Failed to install dependencies");
        return;
      }

      // Kill previous process if exists
      if (runProcess) {
        runProcess.kill();
      }

      // Start the application
      addTerminalOutput(activeTerminal, "Starting application...");
      let tempRunProcess = await webContainer.spawn("npm", ["start"]);

      handleProcessOutput(tempRunProcess, activeTerminal);
      setRunProcess(tempRunProcess);

      // Set iframe URL once server is ready
      webContainer.on('server-ready', (port, url) => {
        console.log('Server ready on:', port, url);
        addTerminalOutput(activeTerminal, `Server ready at ${url}`);
        setIframeUrl(url);
      });
    } catch (error) {
      console.error('Error during process execution:', error);
      addTerminalOutput(activeTerminal, `Error: ${error.message}`);
    }
  };

  useEffect(() => {
    if (!location.state?.project?._id) return;

    initializeSocket(location.state.project._id);

    const initWebContainer = async () => {
      try {
        const container = await getWebContainer();
        setWebContainer(container);
        setIsWebContainerReady(true);

        // Check for existing node_modules to skip reinstallation
        try {
          const files = await container.fs.readdir('/');
          const hasNodeModules = files.includes('node_modules');
          setIsDependencyCacheValid(hasNodeModules);
        } catch (e) {
          console.log('No node_modules directory found');
          setIsDependencyCacheValid(false);
        }

        console.log("WebContainer initialized");
        addTerminalOutput(activeTerminal, "WebContainer initialized and ready");
      } catch (error) {
        console.error("Failed to initialize web container:", error);
        addTerminalOutput(activeTerminal, `Failed to initialize web container: ${error.message}`);
      }
    };

    initWebContainer();

    receiveMessage('project-message', data => {
      if (data.sender._id === 'ai') {
        try {
          const message = JSON.parse(data.message);
          if (isWebContainerReady && webContainer) {
            webContainer.mount(message.fileTree).catch(e => console.error('Mount error:', e));
          }
          if (message.fileTree) {
            setFileTree(message.fileTree || {});
            checkForPackageJson(message.fileTree);
          }
        } catch (e) {
          console.error('Error parsing AI message:', e);
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
    }).catch(err => {
      console.log(err);
      addTerminalOutput(activeTerminal, `Error loading project: ${err.message}`);
    });

    axios.get('/users/all').then(res => {
      setUsers(res.data.users);
    }).catch(err => {
      console.log(err);
      addTerminalOutput(activeTerminal, `Error loading users: ${err.message}`);
    });

    // Cleanup function
    return () => {
      if (runProcess) {
        runProcess.kill();
      }
    };
  }, [location.state?.project?._id]);

  // VS Code-like file explorer
  const renderFileExplorer = () => (
    <div
      ref={sidebarRef}
      className="explorer h-full flex flex-col"
      style={{
        width: `${sidebarWidth}px`,
        backgroundColor: currentTheme.sidebar,
        borderRight: `1px solid ${currentTheme.sidebarBorder}`
      }}
    >
      <div
        className="p-3 border-b flex justify-between items-center"
        style={{
          backgroundColor: currentTheme.editorGroupHeader,
          borderColor: currentTheme.sidebarBorder
        }}
      >
        <h2 className='font-medium flex items-center gap-2 text-gray-300'>
          <i className="ri-folder-open-line"></i>
          <span>EXPLORER</span>
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => { setIsFile(true); setShowFileModal(true); }}
            className='text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700'
            title="New File"
          >
            <i className="ri-file-add-line"></i>
          </button>
          <button
            onClick={() => { setIsFile(false); setShowFolderModal(true); }}
            className='text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700'
            title="New Folder"
          >
            <i className="ri-folder-add-line"></i>
          </button>
        </div>
      </div>

      {/* Breadcrumb navigation */}
      <div
        className="breadcrumbs flex items-center px-3 py-2 text-xs border-b"
        style={{
          backgroundColor: currentTheme.editorGroupHeader,
          borderColor: currentTheme.sidebarBorder,
          color: currentTheme.foreground
        }}
      >
        <button
          onClick={() => setCurrentPath('')}
          className="hover:bg-gray-700 px-1 rounded"
        >
          <i className="ri-home-line mr-1"></i>
          <span>root</span>
        </button>
        {currentPath && currentPath.split('/').filter(p => p).map((part, index, parts) => (
          <React.Fragment key={index}>
            <i className="ri-arrow-right-s-line mx-1 text-gray-500"></i>
            <button
              onClick={() => setCurrentPath(parts.slice(0, index + 1).join('/'))}
              className="hover:bg-gray-700 px-1 rounded"
            >
              {part}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div
        className="file-tree flex-grow overflow-y-auto"
        style={{
          backgroundColor: currentTheme.sidebar,
          color: currentTheme.foreground
        }}
      >
        {Object.keys(getCurrentDirectoryContents()).map((file, index) => (
          <FileItem
            key={index}
            name={file}
            item={getCurrentDirectoryContents()[file]}
            path={currentPath ? `${currentPath}/${file}` : file}
            depth={0}
            onFileClick={handleFileClick}
            onFileDelete={deleteFile}
            currentFile={currentFile}
            theme={currentTheme}
          />
        ))}
      </div>
      {/* Resize handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors"
        onMouseDown={() => setIsDragging(true)}
      />
    </div>
  );

  // VS Code-like terminal tabs
  const renderTerminalTabs = () => (
    <div
      className="flex items-center px-2 border-b"
      style={{
        backgroundColor: currentTheme.tabBar,
        borderColor: currentTheme.sidebarBorder
      }}
    >
      {terminals.map(terminal => (
        <div
          key={terminal.id}
          onClick={() => setActiveTerminal(terminal.id)}
          className={`flex items-center px-3 py-2 text-sm cursor-pointer ${activeTerminal === terminal.id
            ? 'border-t-2 border-t-blue-500 text-white'
            : 'text-gray-400 hover:text-white'
            }`}
        >
          <i className="ri-terminal-line mr-2"></i>
          <span>{terminal.name}</span>
          {terminals.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(terminal.id);
              }}
              className="ml-2 text-gray-400 hover:text-white"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addTerminal}
        className="ml-2 p-1 text-gray-400 hover:text-white rounded"
        title="New Terminal"
      >
        <i className="ri-add-line"></i>
      </button>
    </div>
  );

  // VS Code-like terminal
  const renderTerminal = () => {
    const terminal = terminals.find(t => t.id === activeTerminal) || terminals[0];

    return (
      <div
        className="terminal h-full flex flex-col"
        style={{
          backgroundColor: currentTheme.terminalBackground,
          color: currentTheme.terminalForeground
        }}
      >
        {renderTerminalTabs()}

        <div
          className="terminal-content flex-grow overflow-y-auto p-2 font-mono text-sm"
          style={{
            backgroundColor: currentTheme.terminalBackground,
            color: currentTheme.terminalForeground
          }}
        >
          {terminal.history.map((item, index) => (
            <div key={index} className="terminal-line mb-1">
              {item.type === 'command' && (
                <div className="text-blue-400">$ {item.text}</div>
              )}
              {item.type === 'output' && (
                <div>{item.text}</div>
              )}
              {item.type === 'error' && (
                <div className="text-red-400">{item.text}</div>
              )}
              {item.type === 'exit' && (
                <div className="text-yellow-400">{item.text}</div>
              )}
            </div>
          ))}
          <div ref={el => terminalEndRefs.current[terminal.id] = el} />
        </div>

        <div
          className="terminal-input flex items-center p-2 border-t"
          style={{
            backgroundColor: currentTheme.inputBackground,
            borderColor: currentTheme.sidebarBorder
          }}
        >
          <span className="text-blue-400 mr-2">$</span>
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTerminalCommand(terminalInput, terminal.id);
              }
            }}
            className="flex-grow bg-transparent text-green-400 outline-none"
            placeholder="Enter command..."
            style={{ color: currentTheme.terminalForeground }}
          />
        </div>
      </div>
    );
  };

  // VS Code-like editor
  const renderEditor = () => {
    const getFileContent = () => {
      if (!currentFile) return '';

      const pathParts = currentFile.split('/').filter(p => p);
      let current = fileTree;

      for (const part of pathParts) {
        if (current[part]?.file) {
          return current[part].file.contents;
        }
        if (current[part]?.directory) {
          current = current[part].directory;
        } else {
          return '';
        }
      }

      return '';
    };

    return (
      <div
        className="code-editor-area h-full overflow-auto flex-grow"
        style={{
          backgroundColor: currentTheme.background,
          color: currentTheme.foreground
        }}
      >
        {currentFile ? (
          <pre className="hljs h-full m-0">
            <code
              className="hljs h-full outline-none p-4"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const updatedContent = e.target.innerText;
                const pathParts = currentFile.split('/').filter(p => p);
                let current = { ...fileTree };
                let parent = current;

                // Navigate to the file location
                for (let i = 0; i < pathParts.length - 1; i++) {
                  parent = current;
                  current = current[pathParts[i]].directory;
                }

                // Update the file content
                const fileName = pathParts[pathParts.length - 1];
                current[fileName] = {
                  file: {
                    contents: updatedContent
                  }
                };

                setFileTree({ ...fileTree });
                saveFileTree(fileTree);
              }}
              dangerouslySetInnerHTML={{
                __html: hljs.highlightAuto(getFileContent()).value
              }}
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: '"Fira Code", monospace',
                fontSize: '14px',
                lineHeight: '1.5',
                color: currentTheme.foreground
              }}
            />
          </pre>
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{ color: currentTheme.foreground }}
          >
            <i className="ri-file-code-line text-4xl mb-2 text-gray-500"></i>
            <p>Select a file to edit</p>
          </div>
        )}
      </div>
    );
  };

  // VS Code-like tabs for open files
  const renderTabs = () => (
    <div
      className="tabs flex justify-between w-full border-b"
      style={{
        backgroundColor: currentTheme.tabBar,
        borderColor: currentTheme.sidebarBorder
      }}
    >
      <div className="files flex overflow-x-auto">
        {openFiles.map((file, index) => {
          const fileName = file.split('/').pop();
          return (
            <div
              key={index}
              onClick={() => setCurrentFile(file)}
              className={`tab-item flex items-center px-4 py-2 border-r text-sm ${currentFile === file
                ? 'bg-gray-900 border-t-2 border-t-blue-500 text-white'
                : 'text-gray-400 hover:bg-gray-800'
                } cursor-pointer transition-colors`}
              style={{
                borderRightColor: currentTheme.sidebarBorder,
                backgroundColor: currentFile === file ? currentTheme.background : undefined
              }}
            >
              <i className={`ri-${file.endsWith('.js') ? 'javascript-line mr-2 text-yellow-300' :
                file.endsWith('.json') ? 'code-box-line mr-2 text-yellow-300' :
                  file.endsWith('.html') ? 'html5-line mr-2 text-orange-400' :
                    file.endsWith('.css') ? 'css3-line mr-2 text-blue-400' :
                      'file-line mr-2 text-gray-400'
                }`}></i>
              <span className='truncate max-w-xs'>{fileName}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenFiles(openFiles.filter(f => f !== file));
                  if (currentFile === file) {
                    setCurrentFile(openFiles.length > 1 ? openFiles[0] : null);
                  }
                }}
                className="ml-2 text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-700"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="actions flex items-center pr-3 gap-2"
        style={{ backgroundColor: currentTheme.tabBar }}
      >
        <div className="flex gap-1 rounded-md p-1">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1 rounded text-sm ${activeTab === 'editor'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1 rounded text-sm ${activeTab === 'terminal'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            Terminal
          </button>
        </div>

        <button
          onClick={toggleDarkMode}
          className="p-2 text-gray-400 hover:text-white"
          title="Toggle Dark Mode"
        >
          <i className={`ri-${darkMode ? 'sun-line' : 'moon-line'}`}></i>
        </button>

        <button
          onClick={handleRun}
          disabled={!isWebContainerReady || !hasPackageJson || isInstallingDeps}
          className={`px-3 py-1 rounded-md text-sm flex items-center gap-1 ${isWebContainerReady && hasPackageJson && !isInstallingDeps
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-700 cursor-not-allowed text-gray-500'
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
  );

  // VS Code-like status bar
  const renderStatusBar = () => (
    <div
      className="flex justify-between items-center px-4 py-1 text-xs"
      style={{
        backgroundColor: currentTheme.statusBar,
        color: 'white'
      }}
    >
      <div className="flex items-center gap-4">
        <span>{currentFile ? currentFile.split('/').pop() : 'No file selected'}</span>
        <span>{isWebContainerReady ? 'WebContainer Ready' : 'Initializing...'}</span>
        {isInstallingDeps && (
          <span className="flex items-center gap-1">
            <i className="ri-loader-4-line animate-spin"></i>
            <span>Installing dependencies...</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>{project.users?.length || 0} collaborators</span>
        <span>{Object.keys(fileTree).length} files</span>
        <span>{darkMode ? 'Dark' : 'Light'} Mode</span>
      </div>
    </div>
  );

  // File modals for creating files and folders
  const renderFileModals = () => (
    <>
      {/* New File Modal */}
      {showFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg p-6 w-96"
            style={{
              backgroundColor: currentTheme.background,
              color: currentTheme.foreground
            }}
          >
            <h3 className="text-lg font-medium mb-4">Create New File</h3>
            <div className="mb-2 text-sm text-gray-400">
              {currentPath ? `Current directory: ${currentPath}` : 'Root directory'}
            </div>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter filename (e.g., index.js)"
              className="w-full p-2 border rounded mb-4 outline-none"
              style={{
                backgroundColor: currentTheme.inputBackground,
                color: currentTheme.foreground,
                borderColor: currentTheme.sidebarBorder
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowFileModal(false)}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  color: currentTheme.foreground,
                  backgroundColor: currentTheme.inputBackground
                }}
              >
                Cancel
              </button>
              <button
                onClick={createFile}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: currentTheme.buttonBackground,
                  color: 'white'
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg p-6 w-96"
            style={{
              backgroundColor: currentTheme.background,
              color: currentTheme.foreground
            }}
          >
            <h3 className="text-lg font-medium mb-4">Create New Folder</h3>
            <div className="mb-2 text-sm text-gray-400">
              {currentPath ? `Current directory: ${currentPath}` : 'Root directory'}
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="w-full p-2 border rounded mb-4 outline-none"
              style={{
                backgroundColor: currentTheme.inputBackground,
                color: currentTheme.foreground,
                borderColor: currentTheme.sidebarBorder
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  color: currentTheme.foreground,
                  backgroundColor: currentTheme.inputBackground
                }}
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: currentTheme.buttonBackground,
                  color: 'white'
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <ErrorBoundary>
      <main
        className='h-screen w-screen flex overflow-hidden'
        style={{ backgroundColor: currentTheme.background }}
      >
        {/* Left panel - chat section */}
        <section
          className="left relative flex flex-col h-screen w-80 shadow-xl"
          style={{ backgroundColor: currentTheme.sidebar }}
        >
          <header
            className='flex justify-between items-center p-4 w-full border-b'
            style={{
              backgroundColor: currentTheme.activityBar,
              borderColor: currentTheme.sidebarBorder
            }}
          >
            <button
              className='flex gap-2 items-center px-3 py-2 rounded-lg transition-colors'
              style={{
                backgroundColor: currentTheme.buttonBackground,
                color: 'white'
              }}
              onClick={() => setIsModalOpen(true)}
            >
              <i className="ri-add-line"></i>
              <span>Add collaborator</span>
            </button>
            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className='p-2 rounded-full transition-colors'
              style={{
                backgroundColor: currentTheme.buttonBackground,
                color: 'white'
              }}
            >
              <i className="ri-group-line"></i>
            </button>
          </header>

          <div className="conversation-area pt-4 pb-4 flex-grow flex flex-col h-full relative">
            <div
              ref={messageBox}
              className="message-box p-4 flex-grow flex flex-col gap-3 overflow-auto max-h-full"
              style={{
                backgroundColor: currentTheme.sidebar,
                scrollbarColor: `${currentTheme.scrollbar} ${currentTheme.sidebar}`,
                scrollbarWidth: 'thin'
              }}
            >
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`${msg.sender._id === 'ai' ? 'max-w-full' : 'max-w-xs'} ${msg.sender._id === user._id.toString() ? 'ml-auto' : 'mr-auto'
                    } message flex flex-col p-3 rounded-xl ${msg.sender._id === user._id.toString()
                      ? 'bg-blue-600 text-white'
                      : msg.sender._id === 'ai'
                        ? 'bg-gradient-to-r from-indigo-900 to-purple-800 text-white'
                        : 'bg-gray-600 text-white'
                    } shadow-md transition-all hover:shadow-lg`}
                >
                  <small className={`text-xs ${msg.sender._id === user._id.toString()
                    ? 'text-blue-200'
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

            <div
              className="inputField w-full flex p-4 border-t"
              style={{
                backgroundColor: currentTheme.sidebar,
                borderColor: currentTheme.sidebarBorder
              }}
            >
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && send()}
                className='flex-grow p-3 rounded-l-lg border-none outline-none'
                type="text"
                placeholder='Type your message...'
                style={{
                  backgroundColor: currentTheme.inputBackground,
                  color: currentTheme.foreground
                }}
              />
              <button
                onClick={send}
                className='px-5 rounded-r-lg transition-colors'
                style={{
                  backgroundColor: currentTheme.buttonBackground,
                  color: 'white'
                }}
              >
                <i className="ri-send-plane-line"></i>
              </button>
            </div>
          </div>

          {renderStatusBar()}
        </section>

        {/* Right panel - code editor section */}
        <section className="right flex-grow h-full flex">
          {renderFileExplorer()}

          <div className="code-editor flex flex-col flex-grow h-full">
            {renderTabs()}

            <div className="flex flex-col flex-grow max-w-full shrink overflow-hidden">
              {activeTab === 'editor' ? renderEditor() : renderTerminal()}
            </div>
          </div>

          {/* Preview panel */}
          {iframeUrl && webContainer && (
            <div
              className="flex flex-col w-1/3 h-full border-l"
              style={{
                backgroundColor: currentTheme.background,
                borderColor: currentTheme.sidebarBorder
              }}
            >
              <div
                className="preview-header flex justify-between items-center p-3 border-b"
                style={{
                  backgroundColor: currentTheme.tabBar,
                  borderColor: currentTheme.sidebarBorder
                }}
              >
                <h3
                  className="font-medium flex items-center gap-2 text-sm"
                  style={{ color: currentTheme.foreground }}
                >
                  <i className="ri-eye-line"></i>
                  <span>PREVIEW</span>
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIframeUrl(iframeUrl)} // Refresh
                    className="p-1 rounded hover:bg-gray-700"
                    style={{ color: currentTheme.foreground }}
                    title="Refresh"
                  >
                    <i className="ri-refresh-line"></i>
                  </button>
                  <button
                    onClick={() => setIframeUrl(null)}
                    className="p-1 rounded hover:bg-gray-700"
                    style={{ color: currentTheme.foreground }}
                    title="Close"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              </div>
              <div className="preview-content flex-grow relative">
                <iframe
                  src={iframeUrl}
                  className="absolute inset-0 w-full h-full"
                  style={{ backgroundColor: 'white' }}
                  title="Project Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                {!iframeUrl && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: currentTheme.foreground }}
                  >
                    <div className="text-center">
                      <i className="ri-window-line text-4xl mb-2 text-gray-500"></i>
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
            <div
              className="bg-white rounded-xl w-96 max-w-full relative max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              style={{ backgroundColor: currentTheme.background, color: currentTheme.foreground }}
            >
              <header
                className='flex justify-between items-center p-4 border-b'
                style={{ borderColor: currentTheme.sidebarBorder }}
              >
                <h2 className='text-xl font-semibold'>Add Collaborators</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className='p-2 rounded-full hover:bg-gray-700'
                >
                  <i className="ri-close-line"></i>
                </button>
              </header>
              <div
                className="p-4 border-b"
                style={{ borderColor: currentTheme.sidebarBorder }}
              >
                <input
                  type="text"
                  placeholder="Search users..."
                  className="w-full p-2 px-4 rounded-lg outline-none"
                  style={{
                    backgroundColor: currentTheme.inputBackground,
                    color: currentTheme.foreground
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div
                className="users-list flex-grow overflow-y-auto"
                style={{ backgroundColor: currentTheme.background }}
              >
                {users
                  .filter(user => {
                    if (!user) return false; // Skip if user is undefined/null
                    const name = String(user.name || '').toLowerCase();
                    const email = String(user.email || '').toLowerCase();
                    const search = String(searchTerm || '').toLowerCase();
                    return name.includes(search) || email.includes(search);
                  })
                  .map(userItem => (
                    <div
                      key={userItem._id}
                      className={`user p-3 flex items-center gap-3 cursor-pointer ${Array.from(selectedUserId).includes(userItem._id)
                        ? 'bg-blue-900 bg-opacity-30'
                        : 'hover:bg-gray-700'
                        } transition-colors`}
                      onClick={() => handleUserClick(userItem._id)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${Array.from(selectedUserId).includes(userItem._id)
                        ? 'bg-blue-700 text-white'
                        : 'bg-gray-600 text-gray-300'
                        }`}>
                        {userItem.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{userItem.name || 'Unknown User'}</h3>
                        <p className="text-sm truncate" style={{ color: currentTheme.foreground }}>{userItem.email}</p>
                      </div>
                      {Array.from(selectedUserId).includes(userItem._id) && (
                        <i className="ri-check-line text-blue-400"></i>
                      )}
                    </div>
                  ))}
              </div>
              <div
                className="flex justify-end p-4 border-t"
                style={{ borderColor: currentTheme.sidebarBorder }}
              >
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 hover:bg-gray-700 rounded-lg mr-2 transition-colors"
                  style={{ color: currentTheme.foreground }}
                >
                  Cancel
                </button>
                <button
                  onClick={addCollaborators}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: currentTheme.buttonBackground,
                    color: 'white'
                  }}
                >
                  Add Selected
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render file/folder modals */}
        {renderFileModals()}
      </main>
    </ErrorBoundary>
  );
};

export default Project;