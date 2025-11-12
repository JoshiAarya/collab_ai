import React, { useEffect, useState, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const endRef = useRef(null);

  // Initialize username from localStorage or show modal
  useEffect(() => {
    const savedUsername = localStorage.getItem('collab-ai-username');
    if (savedUsername) {
      setUsername(savedUsername);
    } else {
      setShowUsernameModal(true);
    }
  }, []);

  // connect websocket
  useEffect(() => {
    if (!username) return; // Don't connect until username is set
    
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => console.log("✅ Connected to server");
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "init") {
        setMessages(data.messages);
        setCurrentRoom(data.currentRoom || 'general');
      }
      else if (data.type === "rooms") setRooms(data.rooms);
      else if (data.type === "room-switched") {
        setMessages(data.messages);
        setCurrentRoom(data.currentRoom);
      }
      else if (data.type === "chat") setMessages((m) => [...m, data.message]);
    };
    setSocket(ws);
    return () => ws.close();
  }, [username]);

  // Fetch online users periodically
  useEffect(() => {
    if (!username) return;
    
    const fetchOnlineUsers = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/users/online');
        const data = await response.json();
        if (data.success) {
          setOnlineUsers(data.users);
        }
      } catch (error) {
        console.error('Error fetching online users:', error);
      }
    };

    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [username]);

  // auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket || socket.readyState !== WebSocket.OPEN || !username) return;
    socket.send(JSON.stringify({ type: "chat", user: username, text: input }));
    setInput("");
  };

  const saveUsername = (newUsername) => {
    const trimmedUsername = newUsername.trim();
    if (trimmedUsername) {
      setUsername(trimmedUsername);
      localStorage.setItem('collab-ai-username', trimmedUsername);
      setShowUsernameModal(false);
    }
  };

  const changeUsername = () => {
    setShowUsernameModal(true);
  };

  const joinRoom = (roomId) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "join-room", roomId }));
  };

  const createRoom = async (name, description = '') => {
    try {
      const response = await fetch('http://localhost:8080/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, createdBy: username })
      });
      
      if (response.ok) {
        // Refresh rooms list
        const roomsResponse = await fetch('http://localhost:8080/api/rooms');
        const roomsData = await roomsResponse.json();
        if (roomsData.success) {
          setRooms(roomsData.rooms);
        }
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const insertCollabAI = () => {
    if (!input.startsWith("@CollabAI ")) {
      setInput("@CollabAI ");
    }
  };

  // Don't render main app until username is set
  if (showUsernameModal) {
    return <UsernameModal onSave={saveUsername} />;
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={{...styles.sidebar, width: sidebarOpen ? 250 : 0}}>
        <div style={styles.sidebarHeader}>
          <h3>Rooms</h3>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={styles.toggleBtn}
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>
        {sidebarOpen && (
          <div style={styles.roomList}>
            {rooms.map((room) => (
              <div
                key={room.name}
                onClick={() => joinRoom(room.name)}
                style={{
                  ...styles.roomItem,
                  backgroundColor: currentRoom === room.name ? '#238636' : 'transparent'
                }}
              >
                <div style={styles.roomName}>#{room.name}</div>
                <div style={styles.roomDesc}>{room.description}</div>
                {room.messageCount > 0 && (
                  <div style={styles.messageCount}>{room.messageCount}</div>
                )}
              </div>
            ))}
            
            <button 
              onClick={() => {
                const name = prompt('Room name:');
                const desc = prompt('Description (optional):');
                if (name) createRoom(name, desc);
              }}
              style={styles.createRoomBtn}
            >
              + Create Room
            </button>

            {/* Online Users Section */}
            <div style={styles.onlineSection}>
              <h4 style={styles.sectionTitle}>Online Users ({onlineUsers.length})</h4>
              <div style={styles.usersList}>
                {onlineUsers.slice(0, 10).map((user) => (
                  <div key={user.username} style={styles.onlineUser}>
                    <span style={styles.onlineIndicator}>●</span>
                    {user.username}
                  </div>
                ))}
                {onlineUsers.length > 10 && (
                  <div style={styles.moreUsers}>
                    +{onlineUsers.length - 10} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toggle button when sidebar is closed */}
      {!sidebarOpen && (
        <button 
          onClick={() => setSidebarOpen(true)}
          style={styles.sidebarToggle}
        >
          →
        </button>
      )}

      {/* Main Chat */}
      <div style={{...styles.chatWindow, marginLeft: sidebarOpen ? 250 : 0}}>
        <div style={styles.header}>
          <div>
            <h2>#{currentRoom}</h2>
            <small onClick={changeUsername} style={styles.usernameBtn}>
              {username} (click to change)
            </small>
          </div>
        </div>
        <div style={styles.messages}>
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} isAI={m.user === "CollabAI 🤖"} />
          ))}
          <div ref={endRef}></div>
        </div>

        <div style={styles.inputBox}>
          <div style={styles.inputContainer}>
            {input.startsWith("@CollabAI") && (
              <span style={styles.mentionTag}>@CollabAI</span>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${currentRoom}...`}
              style={{
                ...styles.textarea,
                paddingLeft: input.startsWith("@CollabAI") ? 95 : 12,
              }}
              rows={2}
            />
          </div>

          <button onClick={insertCollabAI} style={styles.mentionBtn}>
            ⚡ CollabAI
          </button>
          <button onClick={sendMessage} style={styles.sendBtn}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

function UsernameModal({ onSave }) {
  const [inputUsername, setInputUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputUsername.trim()) {
      onSave(inputUsername.trim());
    }
  };

  const generateRandomUsername = () => {
    const adjectives = ['Cool', 'Smart', 'Fast', 'Bright', 'Quick', 'Sharp', 'Bold', 'Swift'];
    const nouns = ['Coder', 'Dev', 'User', 'Ninja', 'Pro', 'Ace', 'Star', 'Guru'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${noun}${num}`;
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h2>Welcome to CollabAI Chat! 🤖</h2>
        <p>Choose your username to get started:</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={inputUsername}
            onChange={(e) => setInputUsername(e.target.value)}
            placeholder="Enter your username..."
            style={styles.usernameInput}
            autoFocus
            maxLength={20}
          />
          
          <div style={styles.modalButtons}>
            <button
              type="button"
              onClick={() => setInputUsername(generateRandomUsername())}
              style={styles.randomBtn}
            >
              🎲 Random Name
            </button>
            
            <button
              type="submit"
              disabled={!inputUsername.trim()}
              style={{
                ...styles.saveBtn,
                opacity: inputUsername.trim() ? 1 : 0.5
              }}
            >
              Start Chatting
            </button>
          </div>
        </form>
        
        <small style={styles.modalNote}>
          Your username will be saved locally and persist across sessions
        </small>
      </div>
    </div>
  );
}

function MessageBubble({ message, isAI }) {
  const safeHTML = DOMPurify.sanitize(marked.parse(message.text || ""));
  return (
    <div
      style={{
        ...styles.bubble,
        alignSelf: isAI ? "flex-start" : "flex-end",
        background: isAI ? "#2d2f33" : "#005ce6",
      }}
    >
      <div style={styles.user}>{message.user}</div>
      <div
        className="msg-content"
        dangerouslySetInnerHTML={{ __html: safeHTML }}
        style={styles.msgText}
      ></div>
      <div style={styles.time}>
        {new Date(message.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "#0d1117",
    color: "#fff",
    height: "100vh",
    display: "flex",
    fontFamily: "Inter, sans-serif",
    position: "relative",
  },
  sidebar: {
    background: "#161b22",
    borderRight: "1px solid #30363d",
    height: "100vh",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 1000,
    transition: "width 0.3s ease",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "15px 20px",
    borderBottom: "1px solid #30363d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#21262d",
  },
  toggleBtn: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
    padding: 5,
  },
  sidebarToggle: {
    position: "fixed",
    left: 10,
    top: 20,
    background: "#238636",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    padding: "8px 12px",
    cursor: "pointer",
    zIndex: 1001,
  },
  roomList: {
    padding: 10,
  },
  roomItem: {
    padding: "12px 15px",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 5,
    transition: "background 0.2s",
    position: "relative",
  },
  roomName: {
    fontWeight: "bold",
    fontSize: 14,
  },
  roomDesc: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  messageCount: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "#238636",
    borderRadius: 10,
    padding: "2px 6px",
    fontSize: 11,
    minWidth: 18,
    textAlign: "center",
  },
  createRoomBtn: {
    width: "100%",
    padding: "10px 15px",
    background: "#238636",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 10,
    fontSize: 14,
  },
  chatWindow: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    height: "100vh",
    background: "#161b22",
    transition: "margin-left 0.3s ease",
  },
  header: {
    padding: "15px 20px",
    background: "#21262d",
    borderBottom: "1px solid #30363d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  inputBox: {
    borderTop: "1px solid #30363d",
    display: "flex",
    alignItems: "center",
    padding: 10,
    background: "#0d1117",
    gap: 8,
  },
  inputContainer: {
    position: "relative",
    flex: 1,
  },
  mentionTag: {
    position: "absolute",
    left: 12,
    top: 10,
    background: "#23863633",
    color: "#00ff95",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 13,
    pointerEvents: "none",
  },
  textarea: {
    width: "100%",
    resize: "none",
    border: "none",
    outline: "none",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: "15px",
    color: "#fff",
    background: "#161b22",
    minHeight: 44,
  },
  mentionBtn: {
    background: "#23863622",
    color: "#00ff95",
    border: "1px solid #00ff95",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 14,
    cursor: "pointer",
    transition: "0.2s",
  },
  sendBtn: {
    background: "#238636",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 18,
    cursor: "pointer",
  },
  bubble: {
    maxWidth: "75%",
    padding: "10px 14px",
    borderRadius: 10,
    wordWrap: "break-word",
    whiteSpace: "pre-wrap",
    display: "flex",
    flexDirection: "column",
  },
  user: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 1.4,
  },
  time: {
    fontSize: 10,
    opacity: 0.5,
    textAlign: "right",
    marginTop: 4,
  },
  usernameBtn: {
    cursor: "pointer",
    opacity: 0.8,
    transition: "opacity 0.2s",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
  },
  modal: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 12,
    padding: 30,
    maxWidth: 400,
    width: "90%",
    textAlign: "center",
    color: "#fff",
  },
  form: {
    marginTop: 20,
  },
  usernameInput: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid #30363d",
    background: "#0d1117",
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
    outline: "none",
  },
  modalButtons: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
  },
  randomBtn: {
    padding: "10px 16px",
    background: "#21262d",
    border: "1px solid #30363d",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  saveBtn: {
    padding: "10px 20px",
    background: "#238636",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalNote: {
    display: "block",
    marginTop: 15,
    opacity: 0.7,
    fontSize: 12,
  },
  onlineSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTop: "1px solid #30363d",
  },
  sectionTitle: {
    margin: "0 0 10px 0",
    fontSize: 12,
    opacity: 0.8,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  usersList: {
    maxHeight: 150,
    overflowY: "auto",
  },
  onlineUser: {
    display: "flex",
    alignItems: "center",
    padding: "4px 8px",
    fontSize: 13,
    opacity: 0.9,
  },
  onlineIndicator: {
    color: "#00ff95",
    marginRight: 8,
    fontSize: 8,
  },
  moreUsers: {
    padding: "4px 8px",
    fontSize: 12,
    opacity: 0.6,
    fontStyle: "italic",
  },
};
