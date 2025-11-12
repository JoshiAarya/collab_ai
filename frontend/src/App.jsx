import React, { useEffect, useState, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const username = useRef("User" + Math.floor(Math.random() * 1000));
  const endRef = useRef(null);

  // connect websocket
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => console.log("✅ Connected to server");
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "init") setMessages(data.messages);
      else if (data.type === "chat") setMessages((m) => [...m, data.message]);
    };
    setSocket(ws);
    return () => ws.close();
  }, []);

  // auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "chat", user: username.current, text: input }));
    setInput("");
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

  return (
    <div style={styles.container}>
      <div style={styles.chatWindow}>
        <div style={styles.header}>
          <h2>🤖 CollabAI Chat</h2>
          <small>{username.current}</small>
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
              placeholder="Type your message..."
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
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Inter, sans-serif",
  },
  chatWindow: {
    display: "flex",
    flexDirection: "column",
    width: "90%",
    maxWidth: 700,
    height: "90vh",
    borderRadius: 12,
    overflow: "hidden",
    background: "#161b22",
    border: "1px solid #30363d",
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
};
