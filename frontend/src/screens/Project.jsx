import React, { useState, useEffect, useContext, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from "../context/user.context.js";
import { initializeSocket, receiveMessage, sendMessage } from '../utils/socket';
import Markdown from 'markdown-to-jsx';
import SyntaxHighlightedCode from '../components/SyntaxHighlightedCode';

const Project = () => {
  const location = useLocation();
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(new Set());
  const [project, setProject] = useState(location.state.project);
  const [message, setMessage] = useState('');
  const { user } = useContext(UserContext);
  const messageBox = useRef();
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);

  const handleUserClick = (id) => {
    setSelectedUserId((prevSelectedUserId) => {
      const newSelectedUserId = new Set(prevSelectedUserId);
      if (newSelectedUserId.has(id)) {
        newSelectedUserId.delete(id);
      } else {
        newSelectedUserId.add(id);
      }
      return newSelectedUserId;
    });
  };

  const addCollaborators = () => {
    axios
      .put('/projects/add-user', {
        projectId: location.state.project._id,
        users: Array.from(selectedUserId),
      })
      .then((res) => {
        console.log(res.data);
        setIsModalOpen(false);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const send = () => {
    sendMessage('project-message', {
      message,
      sender: user,
    });
    setMessages((prevMessages) => [...prevMessages, { sender: user, message }]);
    setMessage('');
  };

  useEffect(() => {
    initializeSocket(project._id);

    receiveMessage('project-message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    axios
      .get(`/projects/get-project/${location.state.project._id}`)
      .then((res) => {
        console.log(res.data.project);
        setProject(res.data.project);
      })
      .catch((err) => console.log(err));

    axios
      .get('/users/all')
      .then((res) => setUsers(res.data.users))
      .catch((err) => console.log(err));
  }, []);

  useEffect(() => {
    if (messageBox.current) {
      messageBox.current.scrollTop = messageBox.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main className='h-screen w-screen flex'>
      <section className='left relative flex flex-col h-screen min-w-96 bg-slate-100'>
        <header className='flex justify-between items-center p-2 px-4 w-full bg-white shadow'>
          <button className='flex gap-2 items-center' onClick={() => setIsModalOpen(true)}>
            <i className='ri-add-fill mr-1'></i>
            <p>Add collaborator</p>
          </button>
          <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}>
            <i className='ri-group-fill'></i>
          </button>
        </header>

        <div className='conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative'>
          <div
            ref={messageBox}
            className='message-box p-1 flex-grow flex flex-col gap-1 overflow-auto max-h-full scrollbar-hide'
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message flex flex-col p-2 rounded-md shadow-sm ${
                  msg.sender._id === user._id ? 'ml-auto bg-blue-100' : 'bg-gray-200'
                } max-w-80`}
              >
                <small className='opacity-65 text-xs'>{msg.sender.email}</small>
                <p className='text-sm'>
                  <Markdown
                    children={msg.message}
                    options={{
                      overrides: {
                        code: SyntaxHighlightedCode,
                      },
                    }}
                  />
                </p>
              </div>
            ))}
          </div>

          <footer className='p-2 bg-white flex gap-2 items-center'>
            <input
              type='text'
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className='flex-grow border p-2 rounded shadow-sm'
              placeholder='Type your message...'
            />
            <button onClick={send} className='bg-blue-500 text-white px-4 py-2 rounded'>
              Send
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
};

export default Project;
