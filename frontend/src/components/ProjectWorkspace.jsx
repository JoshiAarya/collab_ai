import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export default function ProjectWorkspace({ project, onBack }) {
  const [discussions, setDiscussions] = useState([]);
  const [currentDiscussion, setCurrentDiscussion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showCreateDiscussion, setShowCreateDiscussion] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showInviteToDiscussion, setShowInviteToDiscussion] = useState(false);
  const [inviteDiscussionId, setInviteDiscussionId] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState(project.activeLLM || { provider: 'groq', model: 'llama-3.1-8b-instant' });
  const { token, user } = useAuth();
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const mentionRef = useRef(null);

  const isOwner = project.ownerId._id === user._id;

  useEffect(() => {
    loadDiscussions();
  }, [project]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    if (currentDiscussion && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'join-project',
        projectId: project._id,
        discussionId: currentDiscussion._id
      }));
    }
  }, [currentDiscussion, ws]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Check for @ mentions
  useEffect(() => {
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === input.length - 1) {
      setShowMentions(true);
      setMentionSearch('');
    } else if (lastAtIndex !== -1) {
      const afterAt = input.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setShowMentions(true);
        setMentionSearch(afterAt.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [input]);

  const loadDiscussions = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/projects/${project._id}/discussions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        // Filter discussions to only show ones user is a participant in (or owner sees all)
        const userDiscussions = data.discussions.filter(d => {
          if (isOwner) return true; // Owner sees all
          if (d.isMain) return true; // Everyone sees main
          // Check if user is a participant
          return d.participants?.some(p => p._id === user._id);
        });
        
        setDiscussions(userDiscussions);
        const main = userDiscussions.find(d => d.isMain);
        if (main && !currentDiscussion) {
          setCurrentDiscussion(main);
        }
      }
    } catch (error) {
      console.error('Error loading discussions:', error);
    }
  };

  const connectWebSocket = () => {
    const socket = new WebSocket('ws://localhost:8080');
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token }));
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      
      if (data.type === 'discussion-joined') {
        setMessages(data.messages);
      } else if (data.type === 'project-chat') {
        setMessages(prev => [...prev, data.message]);
      }
    };

    setWs(socket);
  };

  const switchDiscussion = (discussion) => {
    setCurrentDiscussion(discussion);
    setMessages([]);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'join-project',
        projectId: project._id,
        discussionId: discussion._id
      }));
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
      type: 'project-chat',
      text: input
    }));
    
    setInput('');
    setShowMentions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const insertMention = (mention) => {
    const lastAtIndex = input.lastIndexOf('@');
    const newInput = input.slice(0, lastAtIndex) + mention + ' ';
    setInput(newInput);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const getMentionOptions = () => {
    const options = [
      { name: 'CollabAI', username: '@CollabAI', type: 'ai' }
    ];

    // Add members if they exist and are populated
    if (project.members && Array.isArray(project.members)) {
      project.members.forEach(m => {
        if (m.userId && m.userId.username) {
          options.push({
            name: m.userId.username,
            username: `@${m.userId.username}`,
            type: 'user'
          });
        }
      });
    }

    if (mentionSearch) {
      return options.filter(o => 
        o.name.toLowerCase().includes(mentionSearch) ||
        o.username.toLowerCase().includes(mentionSearch)
      );
    }
    return options;
  };

  if (showSettings) {
    return <Settings project={project} onClose={() => setShowSettings(false)} token={token} isOwner={isOwner} />;
  }

  if (showDashboard) {
    return <Dashboard project={project} onClose={() => setShowDashboard(false)} token={token} />;
  }

  if (showDocuments) {
    return <Documents project={project} onClose={() => setShowDocuments(false)} token={token} />;
  }

  return (
    <div style={styles.container}>
      {/* Icon Bar (always visible) */}
      <div style={styles.iconBar}>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          style={styles.iconBarBtn}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18"/>
          </svg>
        </button>

        {!sidebarOpen && (
          <>
            <button onClick={onBack} style={styles.iconBarBtn} title="Back to projects">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              </svg>
            </button>

            <button 
              onClick={() => setShowCreateDiscussion(true)} 
              style={styles.iconBarBtn}
              title="New discussion"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>

            <div style={{ flex: 1 }}></div>

            <div style={styles.iconBarUser}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
          </>
        )}
      </div>

      {/* Sidebar (slides in/out) */}
      {sidebarOpen && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <button onClick={onBack} style={styles.sidebarHeaderBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Projects</span>
            </button>
            <button 
              onClick={() => setSidebarOpen(false)} 
              style={styles.closeSidebarBtn}
              title="Close sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div style={styles.discussionsList}>
            <div style={styles.discussionsHeader}>
              <span style={styles.discussionsLabel}>Discussions</span>
              <button 
                onClick={() => setShowCreateDiscussion(true)}
                style={styles.addDiscussionBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
            
            {discussions.map(disc => {
              const isParticipant = disc.participants?.some(p => p._id === user._id) || isOwner;
              const displayTitle = disc.isMain ? '# Main Thread' : disc.title;
              
              return (
                <div
                  key={disc._id}
                  style={{
                    ...styles.discussionItem,
                    background: currentDiscussion?._id === disc._id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    fontWeight: disc.isMain ? '600' : '400',
                    borderLeft: disc.isMain ? '3px solid #10a37f' : 'none',
                    paddingLeft: disc.isMain ? '9px' : '12px'
                  }}
                >
                  <div 
                    onClick={() => switchDiscussion(disc)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, cursor: 'pointer' }}
                  >
                    {disc.isMain ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16l-8-4-8 4z"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    )}
                    <span style={styles.discussionName}>{displayTitle}</span>
                  </div>
                  {isParticipant && !disc.isMain && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInviteDiscussionId(disc._id);
                        setShowInviteToDiscussion(true);
                      }}
                      style={styles.inviteDiscussionBtn}
                      title="Invite member to discussion"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <line x1="20" y1="8" x2="20" y2="14"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={styles.sidebarFooter}>
            <div style={styles.userSection}>
              <div style={styles.userAvatar}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div style={styles.userInfo}>
                <div style={styles.userName}>{user?.username}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{...styles.main, marginLeft: sidebarOpen ? '308px' : '48px'}}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            {/* Model Selector */}
            <div style={{ position: 'relative', marginRight: '16px' }}>
              <button 
                onClick={() => setShowModelSelector(!showModelSelector)}
                style={styles.modelSelector}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
                </svg>
                <span>{currentModel.provider === 'groq' ? 'Groq' : currentModel.provider}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {showModelSelector && (
                <div style={styles.modelDropdown}>
                  <input
                    type="text"
                    placeholder="Search models..."
                    style={styles.modelSearch}
                    autoFocus
                  />
                  
                  <div style={styles.modelProviderSection}>
                    <div 
                      onClick={() => {
                        setCurrentModel({ provider: 'groq', model: 'llama-3.1-8b-instant' });
                        setShowModelSelector(false);
                      }}
                      style={styles.modelProvider}
                    >
                      <div style={styles.modelProviderIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#f55036">
                          <circle cx="12" cy="12" r="10"/>
                        </svg>
                      </div>
                      <span style={styles.modelProviderName}>Groq</span>
                      <div style={{ flex: 1 }}></div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </div>

                  <div style={styles.modelProviderSection}>
                    <div style={{...styles.modelProvider, opacity: 0.5, cursor: 'not-allowed'}}>
                      <div style={styles.modelProviderIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 8v8M8 12h8"/>
                        </svg>
                      </div>
                      <span style={styles.modelProviderName}>OpenAI</span>
                      <span style={styles.comingSoon}>Coming soon</span>
                    </div>
                  </div>

                  <div style={styles.modelProviderSection}>
                    <div style={{...styles.modelProvider, opacity: 0.5, cursor: 'not-allowed'}}>
                      <div style={styles.modelProviderIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#d4a574">
                          <rect x="4" y="4" width="16" height="16" rx="2"/>
                        </svg>
                      </div>
                      <span style={styles.modelProviderName}>Anthropic</span>
                      <span style={styles.comingSoon}>Coming soon</span>
                    </div>
                  </div>

                  <div style={styles.modelProviderSection}>
                    <div style={{...styles.modelProvider, opacity: 0.5, cursor: 'not-allowed'}}>
                      <div style={styles.modelProviderIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285f4">
                          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                        </svg>
                      </div>
                      <span style={styles.modelProviderName}>Google</span>
                      <span style={styles.comingSoon}>Coming soon</span>
                    </div>
                  </div>

                  <div style={styles.modelProviderSection}>
                    <div style={{...styles.modelProvider, opacity: 0.5, cursor: 'not-allowed'}}>
                      <div style={styles.modelProviderIcon}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff9d00">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                      <span style={styles.modelProviderName}>HuggingFace</span>
                      <span style={styles.comingSoon}>Coming soon</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h2 style={styles.title}>{currentDiscussion?.title || project.title}</h2>
          </div>

          <div style={styles.headerActions}>
            <button onClick={() => setShowMenu(!showMenu)} style={styles.menuBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
            
            {showMenu && (
              <div style={styles.dropdown}>
                {isOwner && (
                  <button onClick={() => { setShowDashboard(true); setShowMenu(false); }} style={styles.dropdownItem}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    Dashboard
                  </button>
                )}
                <button onClick={() => { setShowDocuments(true); setShowMenu(false); }} style={styles.dropdownItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                  Documents
                </button>
                <button onClick={() => { setShowSettings(true); setShowMenu(false); }} style={styles.dropdownItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
                  </svg>
                  Settings
                </button>
                <button onClick={() => { loadDiscussions(); setShowMenu(false); }} style={styles.dropdownItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={styles.messages}>
          {messages.length === 0 ? (
            <div style={styles.empty}>
              <h2 style={styles.emptyTitle}>{currentDiscussion?.title || project.title}</h2>
              <p style={styles.emptyText}>Start the conversation</p>
            </div>
          ) : (
            messages.map((m, i) => <MessageBubble key={i} message={m} />)
          )}
          <div ref={endRef}></div>
        </div>

        <div style={styles.inputArea}>
          {showMentions && (
            <div ref={mentionRef} style={styles.mentionBox}>
              {getMentionOptions().map((option, i) => (
                <div
                  key={i}
                  onClick={() => insertMention(option.username)}
                  style={styles.mentionItem}
                >
                  <div style={{
                    ...styles.mentionAvatar,
                    background: option.type === 'ai' ? '#10a37f' : '#5436da'
                  }}>
                    {option.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.mentionInfo}>
                    <div style={styles.mentionName}>{option.name}</div>
                    <div style={styles.mentionUsername}>{option.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.inputBox}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                style={styles.attachBtn}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              
              {showAttachMenu && (
                <div style={styles.attachMenu}>
                  <label style={styles.attachMenuItem}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                    </svg>
                    Upload Document
                    <input
                      type="file"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          try {
                            await fetch(
                              `http://localhost:8080/api/projects/${project._id}/documents`,
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                  name: file.name,
                                  content: event.target.result,
                                  type: file.type || 'text/plain'
                                })
                              }
                            );
                            setShowAttachMenu(false);
                          } catch (error) {
                            console.error('Error uploading:', error);
                          }
                        };
                        reader.readAsText(file);
                      }}
                      accept=".txt,.md"
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}
            </div>
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              style={styles.textarea}
              rows={1}
            />
            
            <button 
              onClick={sendMessage} 
              style={{
                ...styles.sendBtn,
                opacity: input.trim() ? 1 : 0.3
              }}
              disabled={!input.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Create Discussion Modal */}
      {showCreateDiscussion && (
        <CreateDiscussionModal
          onClose={() => setShowCreateDiscussion(false)}
          onCreate={async (name) => {
            try {
              const response = await fetch(
                `http://localhost:8080/api/projects/${project._id}/discussions`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ name })
                }
              );
              const data = await response.json();
              if (data.success) {
                loadDiscussions();
                setShowCreateDiscussion(false);
              }
            } catch (error) {
              console.error('Error creating discussion:', error);
            }
          }}
        />
      )}

      {/* Invite to Discussion Modal */}
      {showInviteToDiscussion && (
        <InviteToDiscussionModal
          project={project}
          discussionId={inviteDiscussionId}
          token={token}
          onClose={() => {
            setShowInviteToDiscussion(false);
            setInviteDiscussionId(null);
          }}
          onInvite={() => {
            loadDiscussions();
          }}
        />
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  const isAI = message.user === 'CollabAI';
  const safeHTML = DOMPurify.sanitize(marked.parse(message.text || ''));
  
  return (
    <div style={{
      ...styles.messageRow,
      background: isAI ? '#444654' : 'transparent'
    }}>
      <div style={styles.messageContent}>
        <div style={styles.avatar}>
          {isAI ? (
            <div style={styles.aiAvatar}>
              C
            </div>
          ) : (
            <div style={styles.messageUserAvatar}>
              {message.user.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={styles.messageBody}>
          <div style={styles.messageName}>{message.user}</div>
          <div 
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: safeHTML }}
          />
        </div>
      </div>
    </div>
  );
}

function CreateDiscussionModal({ onClose, onCreate }) {
  const [name, setName] = useState('');

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Create New Discussion</h3>
        <input
          type="text"
          placeholder="Discussion name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.modalInput}
          autoFocus
        />
        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.modalCancel}>Cancel</button>
          <button 
            onClick={() => name.trim() && onCreate(name.trim())} 
            style={styles.modalSubmit}
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteToDiscussionModal({ project, discussionId, token, onClose, onInvite }) {
  const [members, setMembers] = useState([]);
  const [discussion, setDiscussion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load discussion details
      const discResponse = await fetch(
        `http://localhost:8080/api/projects/${project._id}/discussions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const discData = await discResponse.json();
      if (discData.success) {
        const disc = discData.discussions.find(d => d._id === discussionId);
        setDiscussion(disc);
      }

      // Load full project data with populated members
      const projectResponse = await fetch(
        `http://localhost:8080/api/projects/${project._id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const projectData = await projectResponse.json();
      if (projectData.success && projectData.project) {
        setMembers(projectData.project.members || []);
      } else {
        // Fallback to project prop
        setMembers(project.members || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback to project prop
      setMembers(project.members || []);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (userId) => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/projects/${project._id}/discussions/${discussionId}/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        }
      );
      const data = await response.json();
      if (data.success) {
        onInvite();
        loadData(); // Refresh to show updated participants
      }
    } catch (error) {
      console.error('Error inviting member:', error);
    }
  };

  const participantIds = discussion?.participants?.map(p => p._id || p) || [];
  const availableMembers = members
    .map(m => m.userId || m) // Extract userId if it's nested
    .filter(m => m && m._id && !participantIds.includes(m._id));

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Invite to {discussion?.title}</h3>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#8e8ea0' }}>Loading...</div>
        ) : availableMembers.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#8e8ea0' }}>
            All project members are already in this discussion
          </div>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {availableMembers.map(member => (
              <div key={member._id} style={styles.memberInviteItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={styles.memberAvatar}>
                    {member.username ? member.username.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div style={{ color: '#ececf1', fontSize: '14px' }}>{member.username || 'Unknown'}</div>
                    <div style={{ color: '#8e8ea0', fontSize: '12px' }}>{member.email || ''}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleInvite(member._id)}
                  style={styles.inviteBtn}
                >
                  Invite
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.modalCancel}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ project, onClose, token }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/projects/${project._id}/dashboard`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setDashboard(data.dashboard);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.fullPage}>
      <div style={styles.pageHeader}>
        <button onClick={onClose} style={styles.backButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={styles.pageTitle}>Dashboard</h1>
        <button onClick={loadDashboard} style={styles.refreshButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>

      {loading ? (
        <div style={styles.pageLoading}>Loading...</div>
      ) : dashboard ? (
        <div style={styles.pageContent}>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Messages</div>
              <div style={styles.statValue}>{dashboard.totalMessages}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Discussions</div>
              <div style={styles.statValue}>{dashboard.activeDiscussions}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Documents</div>
              <div style={styles.statValue}>{dashboard.documentCount}</div>
            </div>
          </div>

          <div style={styles.insightSection}>
            <h3 style={styles.insightTitle}>Current Topics</h3>
            <div style={styles.topicsList}>
              {dashboard.topics?.length > 0 ? (
                dashboard.topics.map((topic, i) => (
                  <div key={i} style={styles.topicTag}>{topic}</div>
                ))
              ) : (
                <p style={styles.emptyText}>No topics identified yet</p>
              )}
            </div>
          </div>

          <div style={styles.insightSection}>
            <h3 style={styles.insightTitle}>Key Decisions</h3>
            {dashboard.decisions?.length > 0 ? (
              dashboard.decisions.map((decision, i) => (
                <div key={i} style={styles.listItem}>• {decision}</div>
              ))
            ) : (
              <p style={styles.emptyText}>No decisions recorded yet</p>
            )}
          </div>

          <div style={styles.insightSection}>
            <h3 style={styles.insightTitle}>Open Questions</h3>
            {dashboard.openQuestions?.length > 0 ? (
              dashboard.openQuestions.map((question, i) => (
                <div key={i} style={styles.listItem}>• {question}</div>
              ))
            ) : (
              <p style={styles.emptyText}>No open questions</p>
            )}
          </div>

          {dashboard.suggestedNextSteps && (
            <div style={styles.insightSection}>
              <h3 style={styles.insightTitle}>Suggested Next Steps</h3>
              <p style={styles.suggestionText}>{dashboard.suggestedNextSteps}</p>
            </div>
          )}
        </div>
      ) : (
        <div style={styles.pageError}>Failed to load dashboard</div>
      )}
    </div>
  );
}

function Documents({ project, onClose, token }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/projects/${project._id}/documents`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const uploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const response = await fetch(
          `http://localhost:8080/api/projects/${project._id}/documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: file.name,
              content: event.target.result,
              type: file.type || 'text/plain'
            })
          }
        );

        const data = await response.json();
        if (data.success) {
          loadDocuments();
        }
      } catch (error) {
        console.error('Error uploading document:', error);
      } finally {
        setUploading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div style={styles.fullPage}>
      <div style={styles.pageHeader}>
        <button onClick={onClose} style={styles.backButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={styles.pageTitle}>Documents</h1>
        <label htmlFor="file-upload" style={styles.uploadButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          {uploading ? 'Uploading...' : 'Upload'}
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={uploadDocument}
          accept=".txt,.md"
          style={{ display: 'none' }}
          disabled={uploading}
        />
      </div>

      <div style={styles.pageContent}>
        {documents.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No documents uploaded yet</p>
            <p style={styles.emptyHint}>Upload .txt or .md files to provide context for AI</p>
          </div>
        ) : (
          <div style={styles.documentsList}>
            {documents.map(doc => (
              <div key={doc._id} style={styles.documentCard}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                </svg>
                <div style={styles.documentInfo}>
                  <div style={styles.documentName}>{doc.name}</div>
                  <div style={styles.documentMeta}>
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ project, onClose, token, isOwner }) {
  const [copied, setCopied] = useState(false);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(project.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const members = project.members || [];

  return (
    <div style={styles.settingsOverlay}>
      <div style={styles.settingsModal}>
        <div style={styles.settingsHeader}>
          <h2 style={styles.settingsTitle}>Project Settings</h2>
          <button onClick={onClose} style={styles.settingsClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={styles.settingsBody}>
          <div style={styles.settingSection}>
            <h3 style={styles.sectionTitle}>Project Information</h3>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Title:</span>
              <span style={styles.infoValue}>{project.title}</span>
            </div>
          </div>

          <div style={styles.settingSection}>
            <h3 style={styles.sectionTitle}>Invite Code</h3>
            <p style={styles.sectionDesc}>Share this code with team members</p>
            <div style={styles.codeBox}>
              <code style={styles.code}>{project.inviteCode}</code>
              <button onClick={copyInviteCode} style={styles.copyBtn}>
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={styles.settingSection}>
            <h3 style={styles.sectionTitle}>Members ({members.length})</h3>
            <div style={styles.membersList}>
              {members.map((member, i) => {
                const username = member.userId?.username || 'Unknown';
                const role = member.role || 'member';
                return (
                  <div key={i} style={styles.memberItem}>
                    <div style={styles.memberAvatar}>
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.memberInfo}>
                      <div style={styles.memberName}>{username}</div>
                      <div style={styles.memberRole}>{role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#343541',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  iconBar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '48px',
    height: '100vh',
    background: '#171717',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: '8px',
    zIndex: 200,
    borderRight: '1px solid rgba(255,255,255,0.1)'
  },
  iconBarBtn: {
    width: '40px',
    height: '40px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#8e8ea0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    '&:hover': {
      background: 'rgba(255,255,255,0.1)',
      color: '#ececf1'
    }
  },
  iconBarUser: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#5436da',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  sidebar: {
    position: 'fixed',
    left: '48px',
    top: 0,
    width: '260px',
    height: '100vh',
    background: '#202123',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.1)'
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  sidebarHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  closeSidebarBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  discussionsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  },
  discussionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#ececf1',
    fontSize: '14px',
    marginBottom: '2px',
    transition: 'background 0.2s'
  },
  discussionName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sidebarFooter: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    padding: '12px'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px',
    borderRadius: '8px',
    background: 'transparent'
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    background: '#5436da',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  userInfo: {
    flex: 1,
    overflow: 'hidden'
  },
  userName: {
    fontSize: '14px',
    color: '#ececf1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-left 0.2s',
    position: 'relative'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    position: 'relative'
  },
  headerTitle: {
    flex: 1,
    display: 'flex',
    alignItems: 'center'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececf1',
    margin: 0
  },
  headerActions: {
    position: 'relative'
  },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    color: '#fff',
    cursor: 'pointer'
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '8px',
    background: '#202123',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    minWidth: '180px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#8e8ea0'
  },
  messageRow: {
    padding: '24px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  messageContent: {
    maxWidth: '48rem',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    gap: '24px'
  },
  avatar: {
    flexShrink: 0,
    paddingTop: '4px'
  },
  aiAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '2px',
    background: '#10a37f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff'
  },
  messageBody: {
    flex: 1,
    minWidth: 0
  },
  messageName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '8px'
  },
  inputArea: {
    padding: '12px 0 24px',
    background: '#343541',
    position: 'relative'
  },
  mentionBox: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '48rem',
    width: 'calc(100% - 48px)',
    background: '#202123',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    marginBottom: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  mentionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  mentionAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  mentionInfo: {
    flex: 1
  },
  mentionName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '2px'
  },
  mentionUsername: {
    fontSize: '12px',
    color: '#8e8ea0'
  },
  messageUserAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '2px',
    background: '#5436da',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  inputBox: {
    maxWidth: '48rem',
    margin: '0 auto',
    padding: '0 24px',
    position: 'relative',
    background: '#40414f',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '12px'
  },
  attachBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    color: '#8e8ea0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  attachMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: '8px',
    background: '#202123',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    minWidth: '200px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000
  },
  attachMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ececf1',
    fontSize: '16px',
    resize: 'none',
    maxHeight: '200px',
    fontFamily: 'inherit',
    lineHeight: '24px'
  },
  sendBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    color: '#ececf1',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.2s'
  },
  settingsOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  settingsModal: {
    background: '#343541',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  settingsTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#ececf1',
    margin: 0
  },
  settingsClose: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    padding: '4px'
  },
  settingsBody: {
    padding: '24px'
  },
  settingSection: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '12px'
  },
  sectionDesc: {
    fontSize: '14px',
    color: '#8e8ea0',
    marginBottom: '12px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  infoLabel: {
    fontSize: '14px',
    color: '#8e8ea0'
  },
  infoValue: {
    fontSize: '14px',
    color: '#ececf1',
    fontWeight: '500'
  },
  codeBox: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  code: {
    flex: 1,
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '16px',
    fontFamily: 'monospace',
    color: '#ececf1',
    letterSpacing: '2px'
  },
  copyBtn: {
    background: '#10a37f',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  memberItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#40414f',
    borderRadius: '8px'
  },
  memberAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '2px',
    background: '#5436da',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600'
  },
  memberInfo: {
    flex: 1
  },
  memberName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '2px'
  },
  memberRole: {
    fontSize: '12px',
    color: '#8e8ea0',
    textTransform: 'capitalize'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  },
  modal: {
    background: '#343541',
    borderRadius: '12px',
    padding: '24px',
    minWidth: '400px',
    maxWidth: '90%'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '16px'
  },
  modalInput: {
    width: '100%',
    padding: '12px',
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#ececf1',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: '16px'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  modalCancel: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    color: '#ececf1',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  modalSubmit: {
    padding: '10px 20px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: '600'
  },
  fullPage: {
    width: '100vw',
    height: '100vh',
    background: '#343541',
    overflowY: 'auto'
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    background: '#202123'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px'
  },
  pageTitle: {
    flex: 1,
    fontSize: '24px',
    fontWeight: '600',
    color: '#ececf1',
    margin: 0
  },
  refreshButton: {
    padding: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '600'
  },
  pageContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px'
  },
  pageLoading: {
    padding: '40px',
    textAlign: 'center',
    color: '#8e8ea0'
  },
  pageError: {
    padding: '40px',
    textAlign: 'center',
    color: '#f87171'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  statCard: {
    background: '#40414f',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  statLabel: {
    fontSize: '14px',
    color: '#8e8ea0',
    marginBottom: '8px'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#ececf1',
    textTransform: 'capitalize'
  },
  insightSection: {
    background: '#40414f',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '16px'
  },
  insightTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '12px'
  },
  topicsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  topicTag: {
    padding: '6px 12px',
    background: '#202123',
    borderRadius: '16px',
    fontSize: '14px',
    color: '#ececf1'
  },
  listItem: {
    padding: '8px 0',
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.6'
  },
  suggestionText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.6'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#8e8ea0',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#565869'
  },
  documentsList: {
    display: 'grid',
    gap: '12px'
  },
  documentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#40414f',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  documentInfo: {
    flex: 1
  },
  documentName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '4px'
  },
  documentMeta: {
    fontSize: '12px',
    color: '#8e8ea0'
  },
  discussionsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    marginBottom: '8px'
  },
  discussionsLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#8e8ea0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  addDiscussionBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px'
  },
  inviteDiscussionBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'color 0.2s'
  },
  memberInviteItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  inviteBtn: {
    padding: '8px 16px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: '600'
  },
  modelSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#ececf1',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  modelDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '8px',
    background: '#2f2f2f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    minWidth: '320px',
    maxHeight: '500px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  modelSearch: {
    width: '100%',
    padding: '12px 16px',
    background: '#40414f',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px 12px 0 0',
    color: '#ececf1',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  modelProviderSection: {
    padding: '4px 0'
  },
  modelProvider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  modelProviderIcon: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  modelProviderName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececf1'
  },
  comingSoon: {
    fontSize: '12px',
    color: '#8e8ea0',
    marginLeft: 'auto'
  }
};
