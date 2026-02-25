import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ModelSelector from './ModelSelector';
import Sidebar from './Sidebar';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import apiRequest, { getWsUrl } from '../utils/api.js';

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
  const [showSummaries, setShowSummaries] = useState(false);
  const [showCreateDiscussion, setShowCreateDiscussion] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showInviteToDiscussion, setShowInviteToDiscussion] = useState(false);
  const [inviteDiscussionId, setInviteDiscussionId] = useState(null);
  const [currentModel, setCurrentModel] = useState(project.activeLLM || { provider: 'groq', model: 'llama-3.1-8b-instant' });
  
  // State awareness
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting, connected, disconnected, reconnecting
  const [aiThinking, setAiThinking] = useState(false);
  
  const { token, user } = useAuth();
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const mentionRef = useRef(null);

  const isOwner = project.ownerId._id === user._id;

  useEffect(() => {
    loadDiscussions();
  }, [project]);

  // Check for pending discussion ID from invite link
  useEffect(() => {
    const pendingDiscussionId = sessionStorage.getItem('pendingDiscussionId');
    if (pendingDiscussionId && discussions.length > 0) {
      const discussion = discussions.find(d => d._id === pendingDiscussionId);
      if (discussion) {
        setCurrentDiscussion(discussion);
        sessionStorage.removeItem('pendingDiscussionId');
      }
    }
  }, [discussions]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    if (currentDiscussion && ws && ws.readyState === WebSocket.OPEN) {
      console.log('Joining discussion:', currentDiscussion._id);
      ws.send(JSON.stringify({
        type: 'join-project',
        projectId: project._id,
        discussionId: currentDiscussion._id
      }));
    }
  }, [currentDiscussion, ws, ws?.readyState]);

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
    setIsLoadingDiscussions(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        const userDiscussions = data.discussions.filter(d => {
          if (isOwner) return true;
          if (d.isMain) return true;
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
    } finally {
      setIsLoadingDiscussions(false);
    }
  };

  const connectWebSocket = () => {
    setWsStatus('connecting');
    const wsUrl = getWsUrl();
    console.log('Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      socket.send(JSON.stringify({ type: 'auth', token }));
      
      // If we already have a current discussion, join it
      if (currentDiscussion) {
        console.log('Auto-joining discussion on connect:', currentDiscussion._id);
        socket.send(JSON.stringify({
          type: 'join-project',
          projectId: project._id,
          discussionId: currentDiscussion._id
        }));
      }
    };

    socket.onmessage = (e) => {
      console.log('WebSocket message received:', e.data);
      const data = JSON.parse(e.data);
      
      if (data.type === 'discussion-joined') {
        setMessages(data.messages);
        setIsLoadingMessages(false);
      } else if (data.type === 'project-chat') {
        setMessages(prev => [...prev, data.message]);
        setIsSendingMessage(false);
        
        // Check if AI is responding
        if (data.message.isAI) {
          setAiThinking(false);
        }
      } else if (data.type === 'ai-error') {
        // Stop AI thinking state on error
        setAiThinking(false);
        setIsSendingMessage(false);
      } else if (data.type === 'error') {
        setIsSendingMessage(false);
        setAiThinking(false);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setWsStatus('disconnected');
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (wsStatus !== 'connected') {
          setWsStatus('reconnecting');
          connectWebSocket();
        }
      }, 3000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('disconnected');
    };

    setWs(socket);
  };

  const switchDiscussion = (discussion) => {
    setCurrentDiscussion(discussion);
    setMessages([]);
    setIsLoadingMessages(true);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'join-project',
        projectId: project._id,
        discussionId: discussion._id
      }));
    }
  };

  const sendMessage = () => {
    console.log('sendMessage called', { 
      hasInput: !!input.trim(), 
      wsState: ws?.readyState, 
      isSending: isSendingMessage 
    });
    
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN || isSendingMessage) {
      console.log('Message not sent - conditions not met');
      return;
    }
    
    setIsSendingMessage(true);
    
    // Check if mentioning AI
    if (input.includes('@CollabAI')) {
      setAiThinking(true);
    }
    
    const message = {
      type: 'project-chat',
      text: input
    };
    
    console.log('Sending WebSocket message:', message);
    ws.send(JSON.stringify(message));
    
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

  if (showSummaries && currentDiscussion) {
    return <Summaries 
      project={project} 
      discussion={currentDiscussion}
      onClose={() => setShowSummaries(false)} 
      token={token} 
    />;
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        iconBarContent={
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

            <div style={{
              ...styles.iconBarUser,
              background: getAvatarColor(user?.username)
            }}>
              {getInitials(user?.username)}
            </div>
          </>
        }
      >
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
          
          {isLoadingDiscussions ? (
            <div style={{padding: '20px', textAlign: 'center'}}>
              <div style={{...styles.loadingSpinner, margin: '0 auto'}}></div>
            </div>
          ) : discussions.length === 0 ? (
            <div style={{padding: '20px', textAlign: 'center', color: '#8e8ea0', fontSize: '14px'}}>
              No discussions yet
            </div>
          ) : (
            discussions.map(disc => {
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
          })
          )}
        </div>
      </Sidebar>

      {/* Main */}
      <div style={{...styles.main, marginLeft: sidebarOpen ? '308px' : '48px'}}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <ModelSelector 
              currentModel={currentModel}
              onModelChange={setCurrentModel}
              projectId={project._id}
              token={token}
            />
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
                <button onClick={() => { setShowSummaries(true); setShowMenu(false); }} style={styles.dropdownItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                  </svg>
                  Summaries
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
          {isLoadingMessages ? (
            <div style={styles.loadingState}>
              <div style={styles.loadingSpinner}></div>
              <p style={styles.loadingText}>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={styles.empty}>
              <h2 style={styles.emptyTitle}>{currentDiscussion?.title || project.title}</h2>
              <p style={styles.emptyText}>Start the conversation</p>
              <p style={styles.emptyHint}>Use @CollabAI to get AI assistance</p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => <MessageBubble key={i} message={m} currentUser={user?.username} />)}
              {aiThinking && (
                <div style={styles.aiThinkingIndicator}>
                  <div style={{maxWidth: '48rem', margin: '0 auto', padding: '0 24px', display: 'flex', gap: '24px'}}>
                    <div style={styles.aiAvatar}>C</div>
                    <div className="thinking-dots" style={styles.thinkingDots}>
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={endRef}></div>
        </div>

        {/* Connection Status Banner */}
        {wsStatus !== 'connected' && (
          <div style={styles.statusBanner}>
            {wsStatus === 'connecting' && '🔄 Connecting...'}
            {wsStatus === 'reconnecting' && '🔄 Reconnecting...'}
            {wsStatus === 'disconnected' && '⚠️ Disconnected - Attempting to reconnect...'}
          </div>
        )}

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
                            await apiRequest(
                              `/api/projects/${project._id}/documents`,
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                  title: file.name,
                                  content: event.target.result,
                                  fileType: file.type || 'text/plain'
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
              const response = await apiRequest(
                `/api/projects/${project._id}/discussions`,
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

function MessageBubble({ message, currentUser }) {
  const isAI = message.user === 'CollabAI';
  const isCurrentUser = message.user === currentUser;
  const safeHTML = DOMPurify.sanitize(marked.parse(message.text || ''));
  const avatarColor = getAvatarColor(message.user);
  
  return (
    <div style={{
      padding: '24px 0',
      width: '100%',
      background: isAI ? '#1a1a1a' : 'transparent',
      borderBottom: '1px solid #2d2d2d'
    }}>
      <div style={{
        maxWidth: '48rem',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        gap: '16px',
        flexDirection: isCurrentUser && !isAI ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        justifyContent: isCurrentUser && !isAI ? 'flex-end' : 'flex-start'
      }}>
        <div style={{
          flexShrink: 0,
          paddingTop: '4px'
        }}>
          {isAI ? (
            <div style={styles.aiAvatar}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
          ) : (
            <div style={{
              ...styles.messageUserAvatar,
              background: avatarColor
            }}>
              {getInitials(message.user)}
            </div>
          )}
        </div>
        <div style={{
          flex: 1,
          minWidth: 0,
          maxWidth: '100%',
          textAlign: isCurrentUser && !isAI ? 'right' : 'left'
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#ececec',
            marginBottom: '8px'
          }}>
            {message.user}
          </div>
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
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Create New Discussion</h3>
          <button onClick={onClose} style={styles.modalClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div style={styles.modalBody}>
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
    </div>
  );
}

function InviteToDiscussionModal({ project, discussionId, token, onClose, onInvite }) {
  const [discussion, setDiscussion] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('members'); // 'members' or 'external'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load discussion
      const discResponse = await apiRequest(
        `/api/projects/${project._id}/discussions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const discData = await discResponse.json();
      if (discData.success) {
        const disc = discData.discussions.find(d => d._id === discussionId);
        setDiscussion(disc);
      }

      // Load project members
      const projectResponse = await apiRequest(
        `/api/projects/${project._id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const projectData = await projectResponse.json();
      if (projectData.success && projectData.project) {
        setMembers(projectData.project.members || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussionId}/invite`,
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
        loadData(); // Refresh
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const inviteLink = `${window.location.origin}/join/${project.inviteCode}?discussion=${discussionId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim()) {
      alert('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussionId}/invite-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            email: emailInput.trim(),
            discussionTitle: discussion?.title || 'Discussion'
          })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Invitation sent to ${emailInput}!`);
        setEmailInput('');
      } else {
        alert(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const participantIds = discussion?.participants?.map(p => p._id || p) || [];
  const availableMembers = members
    .map(m => m.userId || m)
    .filter(m => m && m._id && !participantIds.includes(m._id));

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Invite to {discussion?.title || 'Discussion'}</h3>
          <button onClick={onClose} style={styles.modalClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#b4b4b4' }}>Loading...</div>
        ) : (
          <div style={styles.modalBody}>
            {/* Tabs */}
            <div style={styles.tabs}>
              <button
                onClick={() => setActiveTab('members')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'members' ? '2px solid #8b5cf6' : '2px solid transparent',
                  color: activeTab === 'members' ? '#ececec' : '#6b6b6b'
                }}
              >
                Project Members
              </button>
              <button
                onClick={() => setActiveTab('external')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'external' ? '2px solid #8b5cf6' : '2px solid transparent',
                  color: activeTab === 'external' ? '#ececec' : '#6b6b6b'
                }}
              >
                External Invite
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'members' ? (
              <div style={styles.tabContent}>
                {availableMembers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#b4b4b4' }}>
                    All project members are already in this discussion
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {availableMembers.map(member => (
                      <div key={member._id} style={styles.memberItem}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={styles.memberAvatar}>
                            {member.username ? member.username.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div>
                            <div style={{ color: '#ececec', fontSize: '14px' }}>{member.username || 'Unknown'}</div>
                            <div style={{ color: '#b4b4b4', fontSize: '12px' }}>{member.email || ''}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddMember(member._id)}
                          style={styles.addBtn}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.tabContent}>
                <p style={styles.inviteDesc}>
                  Share this link with people outside the project:
                </p>

                <div style={styles.linkBox}>
                  <code style={styles.linkText}>{inviteLink}</code>
                  <button onClick={handleCopyLink} style={styles.copyLinkBtn} title="Copy link">
                    {copied ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>

                <div style={styles.divider}>
                  <span style={styles.dividerText}>OR</span>
                </div>

                <div style={styles.emailSection}>
                  <label style={styles.emailLabel}>Send via email</label>
                  <div style={styles.emailInputGroup}>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      style={styles.emailInput}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendEmail()}
                    />
                    <button 
                      onClick={handleSendEmail} 
                      style={styles.sendEmailBtn}
                      disabled={sendingEmail || !emailInput.trim()}
                    >
                      {sendingEmail ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  <p style={styles.emailHint}>
                    They'll receive an email with the invite link
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
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
    setLoading(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/dashboard`,
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

  const getStageColor = (stage) => {
    const colors = {
      'ideation': '#8b5cf6',
      'design': '#3b82f6',
      'discussion': '#10b981',
      'blocked': '#ef4444',
      'completed': '#06b6d4'
    };
    return colors[stage] || '#6b7280';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'high': '#ef4444',
      'medium': '#f59e0b',
      'low': '#6b7280'
    };
    return colors[severity] || '#6b7280';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate momentum (messages per discussion)
  const momentum = dashboard ? Math.round(dashboard.totalMessages / Math.max(dashboard.activeDiscussions, 1)) : 0;

  // Filter valid blockers (remove garbage entries)
  const getValidBlockers = (blockers) => {
    if (!blockers || !Array.isArray(blockers)) return [];
    return blockers.filter(b => {
      const text = b.text || b;
      if (!text || typeof text !== 'string') return false;
      const normalized = text.toLowerCase().trim();
      return !(
        normalized === 'none' || 
        normalized === 'none mentioned' || 
        normalized === 'no blockers' ||
        normalized === 'n/a' ||
        normalized.startsWith('no ') ||
        normalized.length < 5
      );
    });
  };

  const validBlockers = dashboard ? getValidBlockers(dashboard.openQuestions) : [];

  // Calculate topic distribution
  const topicData = dashboard?.topics ? 
    (Array.isArray(dashboard.topics[0]) ? dashboard.topics : dashboard.topics.map(t => ({ name: t, count: 1 })))
    : [];
  const sortedTopics = topicData.sort((a, b) => (b.count || 0) - (a.count || 0));
  const topTopics = sortedTopics.slice(0, 5);
  const remainingTopics = sortedTopics.length - 5;
  const maxCount = Math.max(...topTopics.map(t => t.count || 1), 1);

  return (
    <div style={styles.dashboardPage}>
      {/* Header */}
      <div style={styles.dashboardHeader}>
        <div style={styles.dashboardHeaderLeft}>
          <button onClick={onClose} style={styles.dashboardBackBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div>
            <h1 style={styles.dashboardTitle}>Dashboard</h1>
            <p style={styles.dashboardSubtitle}>{project.title}</p>
          </div>
        </div>
        <button onClick={loadDashboard} style={styles.dashboardRefreshBtn} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Refresh
        </button>
      </div>

      {loading && !dashboard ? (
        <div style={styles.dashboardLoading}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading insights...</p>
        </div>
      ) : dashboard ? (
        <div style={styles.dashboardContent}>
          {/* Project Health Bar */}
          <div style={styles.healthBar}>
            <div style={styles.healthCell}>
              <div style={styles.healthLabel}>Stage</div>
              <div style={{...styles.healthValue, color: getStageColor(project.stage)}}>
                {project.stage.charAt(0).toUpperCase() + project.stage.slice(1)}
              </div>
            </div>
            <div style={styles.healthCell}>
              <div style={styles.healthLabel}>Momentum</div>
              <div style={styles.healthValue}>{momentum} msg/disc</div>
            </div>
            <div style={{
              ...styles.healthCell,
              background: validBlockers.length > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
            }}>
              <div style={styles.healthLabel}>Open Blockers</div>
              <div style={{
                ...styles.healthValue,
                color: validBlockers.length > 0 ? '#ef4444' : '#10b981'
              }}>
                {validBlockers.length}
              </div>
            </div>
            <div style={styles.healthCell}>
              <div style={styles.healthLabel}>Action Items</div>
              <div style={styles.healthValue}>{dashboard.actionItems?.length || 0}</div>
            </div>
            <div style={styles.healthCell}>
              <div style={styles.healthLabel}>Active Discussions</div>
              <div style={styles.healthValue}>{dashboard.activeDiscussions}</div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div style={styles.dashboardGrid}>
            {/* Left Column - Intelligence */}
            <div style={styles.dashboardLeftCol}>
              {/* Topic Distribution */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Topic Distribution</h3>
                {topTopics.length > 0 ? (
                  <div style={styles.topicBars}>
                    {topTopics.map((topic, i) => (
                      <div key={i} style={styles.topicBarRow}>
                        <div style={styles.topicName}>{topic.name || topic}</div>
                        <div style={styles.topicBarContainer}>
                          <div style={{
                            ...styles.topicBarFill,
                            width: `${((topic.count || 1) / maxCount) * 100}%`
                          }}></div>
                        </div>
                        <div style={styles.topicCount}>{topic.count || 1}</div>
                      </div>
                    ))}
                    {remainingTopics > 0 && (
                      <div style={styles.topicMore}>+{remainingTopics} more topics</div>
                    )}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No topics identified yet</div>
                )}
              </div>

              {/* Key Decisions */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Key Decisions</h3>
                {dashboard.decisions?.length > 0 ? (
                  <div style={styles.timelineList}>
                    {dashboard.decisions.slice(0, 5).map((decision, i) => (
                      <div key={i} style={styles.timelineItem}>
                        <div style={styles.timelineDot}></div>
                        <div style={styles.timelineContent}>
                          <div style={styles.timelineText}>{decision.text || decision}</div>
                          <div style={styles.timelineMeta}>
                            {decision.timestamp && formatTimestamp(decision.timestamp)}
                            {decision.discussionId && ' • Main Discussion'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No decisions recorded yet</div>
                )}
              </div>

              {/* Blockers */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Blockers</h3>
                {validBlockers.length > 0 ? (
                  <div style={styles.blockersList}>
                    {['high', 'medium', 'low'].map(severity => {
                      const items = validBlockers.filter(b => 
                        (b.severity || 'medium') === severity
                      );
                      return items.map((blocker, i) => (
                        <div key={`${severity}-${i}`} style={styles.blockerItem}>
                          <div style={{
                            ...styles.severityDot,
                            background: getSeverityColor(severity)
                          }}></div>
                          <div style={styles.blockerText}>{blocker.text || blocker}</div>
                        </div>
                      ));
                    })}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No blockers</div>
                )}
              </div>

              {/* Action Items */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Action Items</h3>
                {dashboard.actionItems?.length > 0 ? (
                  <div style={styles.actionList}>
                    {dashboard.actionItems.slice(0, 5).map((action, i) => (
                      <div key={i} style={styles.actionItem}>
                        <div style={styles.actionCheckbox}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            {action.status === 'completed' && <polyline points="20 6 9 17 4 12"/>}
                          </svg>
                        </div>
                        <div style={styles.actionText}>{action.text || action}</div>
                        <div style={{
                          ...styles.statusBadge,
                          background: action.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' :
                                     action.status === 'in-progress' ? 'rgba(59, 130, 246, 0.1)' :
                                     'rgba(107, 114, 128, 0.1)',
                          color: action.status === 'completed' ? '#10b981' :
                                 action.status === 'in-progress' ? '#3b82f6' :
                                 '#6b7280'
                        }}>
                          {action.status || 'open'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No action items</div>
                )}
              </div>
            </div>

            {/* Right Column - Project State */}
            <div style={styles.dashboardRightCol}>
              {/* Stage Panel */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Current Stage</h3>
                <div style={styles.stageDisplay}>
                  <div style={{
                    ...styles.stageBadge,
                    background: getStageColor(project.stage)
                  }}>
                    {project.stage.charAt(0).toUpperCase() + project.stage.slice(1)}
                  </div>
                  {dashboard.lastUpdated && (
                    <div style={styles.stageUpdated}>
                      Last updated {formatTimestamp(dashboard.lastUpdated)}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Graph */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Activity</h3>
                <div style={styles.activityChartCompact}>
                  <div style={styles.chartBarsCompact}>
                    {[12, 25, 18, 32, 28, 40, 35].map((value, i) => (
                      <div key={i} style={styles.chartBarWrapperCompact}>
                        <div style={styles.chartBarCompact}>
                          <div style={{
                            ...styles.chartBarFillCompact,
                            height: `${(value / 40) * 100}%`,
                            background: i === 6 ? '#667eea' : 'rgba(102, 126, 234, 0.3)'
                          }}></div>
                        </div>
                        <div style={styles.chartBarLabelCompact}>
                          {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Participants</h3>
                <div style={styles.participantsListCompact}>
                  {project.members?.slice(0, 5).map((member, i) => {
                    const username = member.userId?.username || 'Unknown';
                    const timeAgo = ['5m ago', '10m ago', '25m ago', '1h ago', '2h ago'][i];
                    return (
                      <div key={i} style={styles.participantItemCompact}>
                        <div style={styles.participantAvatarCompact}>
                          {username.charAt(0).toUpperCase()}
                        </div>
                        <div style={styles.participantInfoCompact}>
                          <div style={styles.participantNameCompact}>{username}</div>
                          <div style={styles.participantTimeCompact}>{timeAgo}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats Summary */}
              <div style={styles.dashboardCard}>
                <h3 style={styles.cardTitleNew}>Summary</h3>
                <div style={styles.statsSummary}>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Total Messages</span>
                    <span style={styles.summaryValue}>{dashboard.totalMessages}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Documents</span>
                    <span style={styles.summaryValue}>{dashboard.documentCount}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Data Source</span>
                    <span style={{
                      ...styles.summaryValue,
                      color: dashboard.source === 'persistent' ? '#10b981' : '#f59e0b'
                    }}>
                      {dashboard.source === 'persistent' ? 'Cached' : 'Live'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.dashboardError}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Failed to load dashboard</p>
          <button onClick={loadDashboard} style={styles.retryBtn}>Retry</button>
        </div>
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
      const response = await apiRequest(
        `/api/projects/${project._id}/documents`,
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

    // Check for duplicate
    const isDuplicate = documents.some(doc => doc.title === file.name);
    if (isDuplicate) {
      alert(`A document named "${file.name}" already exists. Please rename the file or delete the existing document first.`);
      e.target.value = ''; // Reset file input
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const response = await apiRequest(
          `/api/projects/${project._id}/documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              title: file.name,
              content: event.target.result,
              fileType: file.type || 'text/plain'
            })
          }
        );

        const data = await response.json();
        if (data.success) {
          loadDocuments();
        } else {
          alert(`Upload failed: ${data.error}`);
        }
      } catch (error) {
        console.error('Error uploading document:', error);
        alert('Failed to upload document. Please try again.');
      } finally {
        setUploading(false);
        e.target.value = ''; // Reset file input
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
            {documents.map(doc => {
              const contentSize = doc.content ? (doc.content.length / 1024).toFixed(1) : '0';
              const hasEmbeddings = doc.chunks && doc.chunks.length > 0;
              
              return (
                <div key={doc._id} style={styles.documentCard}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                  <div style={styles.documentInfo}>
                    <div style={styles.documentName}>{doc.title}</div>
                    <div style={styles.documentMeta}>
                      {contentSize} KB • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{
                      ...styles.documentMeta,
                      color: hasEmbeddings ? '#10b981' : '#f59e0b',
                      fontSize: '11px',
                      marginTop: '4px'
                    }}>
                      {hasEmbeddings ? '✓ Embeddings ready' : '⏳ Processing embeddings...'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ project, onClose, token, isOwner }) {
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const copyInviteCode = () => {
    const inviteLink = `${window.location.origin}/join/${project.inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInviteEmail = async () => {
    if (!emailInput.trim()) {
      alert('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/invite-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: emailInput.trim() })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        alert(`Invitation sent to ${emailInput}!`);
        setEmailInput('');
      } else {
        alert(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setSendingEmail(false);
    }
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
            <h3 style={styles.sectionTitle}>Invite Link</h3>
            <p style={styles.sectionDesc}>Share this link with team members</p>
            <div style={styles.codeBox}>
              <code style={styles.code}>{`${window.location.origin}/join/${project.inviteCode}`}</code>
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
            
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2d2d2d' }}>
              <p style={{ fontSize: '14px', color: '#b4b4b4', marginBottom: '12px' }}>
                Or send invitation via email:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder="teammate@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: '#0d0d0d',
                    border: '1px solid #2d2d2d',
                    borderRadius: '6px',
                    color: '#ececec',
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                <button
                  onClick={handleSendInviteEmail}
                  disabled={sendingEmail || !emailInput.trim()}
                  style={{
                    padding: '10px 20px',
                    background: '#8b5cf6',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: sendingEmail || !emailInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: sendingEmail || !emailInput.trim() ? 0.5 : 1,
                    fontFamily: 'inherit'
                  }}
                >
                  {sendingEmail ? 'Sending...' : 'Send'}
                </button>
              </div>
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

function Summaries({ project, discussion, onClose, token }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingSummary, setEditingSummary] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/summaries`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        // Filter summaries for current discussion
        const discSummaries = data.summaries.filter(
          s => s.discussionId === discussion._id
        );
        setSummaries(discSummaries);
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (prompt = null) => {
    setGenerating(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summarize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ customPrompt: prompt })
        }
      );
      const data = await response.json();
      if (data.success) {
        loadSummaries();
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setGenerating(false);
    }
  };

  const regenerateSummary = async (summaryId) => {
    if (!customPrompt.trim()) {
      alert('Please enter refinement instructions');
      return;
    }

    setRegenerating(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summaries/${summaryId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ customPrompt })
        }
      );
      const data = await response.json();
      if (data.success) {
        setEditingSummary(null);
        setCustomPrompt('');
        loadSummaries();
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const deleteSummary = async (summaryId) => {
    if (!confirm('Delete this summary?')) return;

    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summaries/${summaryId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        loadSummaries();
      }
    } catch (error) {
      console.error('Error deleting summary:', error);
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
        <h1 style={styles.pageTitle}>Summaries - {discussion.title}</h1>
        <button 
          onClick={() => generateSummary()} 
          style={styles.uploadButton}
          disabled={generating}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      <div style={styles.pageContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>Loading summaries...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No summaries yet</p>
            <p style={styles.emptyHint}>Generate a summary to capture key points from this discussion</p>
          </div>
        ) : (
          <div style={styles.summariesList}>
            {summaries.map(summary => (
              <div key={summary._id} style={styles.summaryCard}>
                <div style={styles.summaryHeader}>
                  <div style={styles.summaryMeta}>
                    <span style={styles.summaryDate}>
                      {new Date(summary.createdAt).toLocaleDateString()}
                    </span>
                    <span style={styles.summaryProvider}>
                      via {summary.generatedBy}
                    </span>
                  </div>
                  <div style={styles.summaryActions}>
                    <button 
                      onClick={() => setEditingSummary(summary._id)}
                      style={styles.summaryActionBtn}
                      title="Refine summary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => deleteSummary(summary._id)}
                      style={{...styles.summaryActionBtn, color: '#ef4444'}}
                      title="Delete summary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div style={styles.summaryContent}>
                  {summary.content}
                </div>

                {editingSummary === summary._id && (
                  <div style={styles.refineBox}>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="How would you like to refine this summary? (e.g., 'Make it more concise', 'Focus on technical decisions', 'Add action items')"
                      style={styles.refineInput}
                      rows={3}
                    />
                    <div style={styles.refineActions}>
                      <button 
                        onClick={() => {
                          setEditingSummary(null);
                          setCustomPrompt('');
                        }}
                        style={styles.refineCancelBtn}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => regenerateSummary(summary._id)}
                        style={styles.refineSubmitBtn}
                        disabled={regenerating || !customPrompt.trim()}
                      >
                        {regenerating ? 'Refining...' : 'Refine Summary'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#0d0d0d',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  iconBar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '48px',
    height: '100vh',
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: '8px',
    zIndex: 200,
    borderRight: '1px solid #2d2d2d'
  },
  iconBarBtn: {
    width: '40px',
    height: '40px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#6b6b6b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    '&:hover': {
      background: 'rgba(255,255,255,0.05)',
      color: '#ececec'
    }
  },
  iconBarUser: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
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
    background: '#171717',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #2d2d2d'
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderBottom: '1px solid #2d2d2d'
  },
  sidebarHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '6px',
    color: '#ececec',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  closeSidebarBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
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
    color: '#ececec',
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
    borderTop: '1px solid #2d2d2d',
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
    background: '#8b5cf6',
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
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    marginTop: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-left 0.2s',
    position: 'relative',
    background: '#0d0d0d'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #2d2d2d',
    position: 'relative'
  },
  headerTitle: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginLeft: '16px'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececec',
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
    color: '#ececec',
    cursor: 'pointer'
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '8px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
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
    flexDirection: 'column',
    background: '#0d0d0d'
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
    color: '#ececec',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#b4b4b4',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#6b6b6b'
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #2d2d2d',
    borderTop: '3px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '14px',
    color: '#b4b4b4'
  },
  aiThinkingIndicator: {
    padding: '24px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  thinkingDots: {
    display: 'flex',
    gap: '4px',
    padding: '12px'
  },
  statusBanner: {
    padding: '8px 16px',
    background: '#f59e0b',
    color: '#000',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '500'
  },
  aiAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '4px',
    background: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  messageUserAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  inputArea: {
    padding: '12px 0 24px',
    background: '#0d0d0d',
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
    background: '#1a1a1a',
    borderRadius: '12px',
    border: '1px solid #2d2d2d',
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
    color: '#6b6b6b',
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
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    minWidth: '200px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
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
    color: '#ececec',
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
    color: '#ececec',
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
    color: '#8b5cf6',
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
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  settingsModal: {
    background: '#1a1a1a',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    border: '1px solid #2d2d2d'
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
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '12px',
    minWidth: '500px',
    maxWidth: '90%',
    border: '1px solid #2d2d2d'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #2d2d2d'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  modalBody: {
    padding: '24px'
  },
  modalInput: {
    width: '100%',
    padding: '12px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
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
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  modalSubmit: {
    padding: '10px 20px',
    background: '#8b5cf6',
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
    background: '#0d0d0d',
    overflowY: 'auto'
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 24px',
    borderBottom: '1px solid #2d2d2d',
    background: '#171717'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '6px',
    color: '#ececec',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px'
  },
  pageTitle: {
    flex: 1,
    fontSize: '24px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0
  },
  refreshButton: {
    padding: '8px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '6px',
    color: '#ececec',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#8b5cf6',
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
    color: '#b4b4b4'
  },
  pageError: {
    padding: '40px',
    textAlign: 'center',
    color: '#ef4444'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  statCard: {
    background: '#1a1a1a',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d2d2d'
  },
  statLabel: {
    fontSize: '14px',
    color: '#b4b4b4',
    marginBottom: '8px'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#ececec',
    textTransform: 'capitalize'
  },
  insightSection: {
    background: '#1a1a1a',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d2d2d',
    marginBottom: '16px'
  },
  insightTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '12px'
  },
  topicsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  topicTag: {
    padding: '6px 12px',
    background: '#0d0d0d',
    borderRadius: '16px',
    fontSize: '14px',
    color: '#ececec',
    border: '1px solid #2d2d2d'
  },
  listItem: {
    padding: '8px 0',
    fontSize: '14px',
    color: '#ececec',
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
    background: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2d2d2d'
  },
  documentInfo: {
    flex: 1
  },
  documentName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '4px'
  },
  documentMeta: {
    fontSize: '12px',
    color: '#b4b4b4'
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
    color: '#6b6b6b',
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
  inviteDesc: {
    fontSize: '14px',
    color: '#8e8ea0',
    marginBottom: '16px',
    lineHeight: '1.5'
  },
  linkBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px'
  },
  linkText: {
    flex: 1,
    fontSize: '13px',
    color: '#10a37f',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  },
  copyLinkBtn: {
    padding: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
    color: '#8e8ea0'
  },
  dividerText: {
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  emailSection: {
    marginTop: '20px'
  },
  emailLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececf1',
    marginBottom: '8px'
  },
  emailInputGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  },
  emailInput: {
    flex: 1,
    padding: '10px 12px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  sendEmailBtn: {
    padding: '10px 20px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  emailHint: {
    fontSize: '12px',
    color: '#b4b4b4',
    margin: 0
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #2d2d2d',
    marginBottom: '20px'
  },
  tab: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },
  tabContent: {
    marginTop: '20px'
  },
  memberItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '8px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d'
  },
  memberAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  addBtn: {
    padding: '8px 16px',
    background: '#8b5cf6',
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
  },
  summariesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  summaryCard: {
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '20px',
    transition: 'border-color 0.2s'
  },
  summaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  summaryMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  summaryDate: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '500'
  },
  summaryProvider: {
    fontSize: '12px',
    color: '#565869',
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px'
  },
  summaryActions: {
    display: 'flex',
    gap: '8px'
  },
  summaryActionBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    padding: '6px',
    color: '#ececf1',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  summaryContent: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  refineBox: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  refineInput: {
    width: '100%',
    padding: '12px',
    background: '#343541',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#ececf1',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    marginBottom: '12px'
  },
  refineActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  refineCancelBtn: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  refineSubmitBtn: {
    padding: '8px 16px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  // Dashboard Styles
  dashboardPage: {
    minHeight: '100vh',
    background: '#1a1b26',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  dashboardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 32px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    background: '#16171f'
  },
  dashboardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  dashboardBackBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },
  dashboardTitle: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    color: '#fff'
  },
  dashboardSubtitle: {
    fontSize: '14px',
    color: '#8e8ea0',
    margin: '4px 0 0 0'
  },
  dashboardRefreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.2s'
  },
  dashboardLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px'
  },
  dashboardContent: {
    padding: '32px',
    maxWidth: '1600px',
    margin: '0 auto'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  statCardNew: {
    padding: '24px',
    borderRadius: '12px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    color: '#ececec',
    position: 'relative',
    overflow: 'hidden'
  },
  statIconBox: {
    width: '48px',
    height: '48px',
    background: '#8b5cf6',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    color: '#fff'
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  statLabelNew: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#b4b4b4'
  },
  statValueNew: {
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: 1,
    color: '#ececec'
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: '65fr 35fr',
    gap: '24px',
    alignItems: 'start'
  },
  dashboardLeftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  dashboardRightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  dashboardCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    padding: '24px'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #2d2d2d'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: 0,
    color: '#ececec'
  },
  cardMenuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    transition: 'background 0.2s'
  },
  updateBadge: {
    fontSize: '12px',
    color: '#b4b4b4',
    padding: '4px 12px',
    background: '#0d0d0d',
    borderRadius: '12px',
    border: '1px solid #2d2d2d'
  },
  cardSection: {
    marginBottom: '24px'
  },
  sectionLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b6b6b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px'
  },
  topicsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  topicBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#ececec',
    fontWeight: '500'
  },
  decisionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  decisionItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#0d0d0d',
    borderRadius: '8px',
    border: '1px solid #2d2d2d'
  },
  decisionNumber: {
    width: '28px',
    height: '28px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0
  },
  decisionText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.5',
    flex: 1
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  questionItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  questionIcon: {
    width: '32px',
    height: '32px',
    background: 'rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f87171',
    flexShrink: 0
  },
  questionText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.5',
    flex: 1
  },
  questionBadge: {
    fontSize: '11px',
    color: '#8e8ea0',
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    whiteSpace: 'nowrap'
  },
  nextStepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  nextStepItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px',
    background: 'rgba(16, 185, 129, 0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(16, 185, 129, 0.2)'
  },
  nextStepIcon: {
    width: '24px',
    height: '24px',
    background: 'rgba(16, 185, 129, 0.2)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#10b981',
    flexShrink: 0
  },
  nextStepText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.5'
  },
  updateTime: {
    fontSize: '12px',
    color: '#565869',
    marginTop: '16px',
    textAlign: 'right'
  },
  emptyMessage: {
    fontSize: '14px',
    color: '#565869',
    padding: '20px',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  stageSelector: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px'
  },
  stageOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    textTransform: 'capitalize',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  activityChart: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  chartLabel: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '500'
  },
  chartBars: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '120px',
    gap: '8px'
  },
  chartBarWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  chartBar: {
    width: '100%',
    height: '100px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px 6px 0 0',
    position: 'relative',
    overflow: 'hidden'
  },
  chartBarFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: '6px 6px 0 0',
    transition: 'height 0.3s ease'
  },
  chartBarLabel: {
    fontSize: '11px',
    color: '#565869',
    fontWeight: '500'
  },
  participantsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  participantItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  participantAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    flexShrink: 0
  },
  participantInfo: {
    flex: 1
  },
  participantName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececf1',
    marginBottom: '2px'
  },
  participantTime: {
    fontSize: '12px',
    color: '#565869'
  },
  viewAllBtn: {
    width: '100%',
    padding: '10px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#8e8ea0',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },
  progressBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  progressItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#ececf1',
    fontWeight: '500'
  },
  progressPercent: {
    color: '#8e8ea0'
  },
  progressBar: {
    height: '8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  dashboardError: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px',
    color: '#8e8ea0'
  },
  retryBtn: {
    padding: '10px 24px',
    background: '#667eea',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  // New Dashboard Redesign Styles
  healthBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '1px',
    background: '#2d2d2d',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '32px',
    border: '1px solid #2d2d2d'
  },
  healthCell: {
    padding: '16px 20px',
    background: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    transition: 'background 0.2s'
  },
  healthLabel: {
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600'
  },
  healthValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ececec'
  },
  cardTitleNew: {
    fontSize: '15px',
    fontWeight: '600',
    margin: '0 0 20px 0',
    color: '#ececec',
    letterSpacing: '-0.01em'
  },
  topicBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  topicBarRow: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr 40px',
    alignItems: 'center',
    gap: '12px'
  },
  topicName: {
    fontSize: '13px',
    color: '#ececec',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  topicBarContainer: {
    height: '8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  topicBarFill: {
    height: '100%',
    background: '#667eea',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  topicCount: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '600',
    textAlign: 'right'
  },
  topicMore: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    fontStyle: 'italic'
  },
  timelineList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  timelineItem: {
    display: 'flex',
    gap: '12px',
    position: 'relative'
  },
  timelineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#667eea',
    marginTop: '6px',
    flexShrink: 0
  },
  timelineContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  timelineText: {
    fontSize: '14px',
    color: '#ececec',
    lineHeight: '1.5'
  },
  timelineMeta: {
    fontSize: '12px',
    color: '#6b7280'
  },
  blockersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  blockerItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  severityDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '6px',
    flexShrink: 0
  },
  blockerText: {
    fontSize: '14px',
    color: '#ececec',
    lineHeight: '1.5',
    flex: 1
  },
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  actionCheckbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid #4b5563',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#10b981'
  },
  actionText: {
    fontSize: '14px',
    color: '#ececec',
    lineHeight: '1.4',
    flex: 1
  },
  statusBadge: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  emptyState: {
    fontSize: '13px',
    color: '#6b7280',
    padding: '24px',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  stageDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  stageBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
    alignSelf: 'flex-start'
  },
  stageUpdated: {
    fontSize: '12px',
    color: '#6b7280'
  },
  activityChartCompact: {
    padding: '12px 0'
  },
  chartBarsCompact: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '80px',
    gap: '6px'
  },
  chartBarWrapperCompact: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px'
  },
  chartBarCompact: {
    width: '100%',
    height: '60px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px 4px 0 0',
    position: 'relative',
    overflow: 'hidden'
  },
  chartBarFillCompact: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease'
  },
  chartBarLabelCompact: {
    fontSize: '10px',
    color: '#6b7280',
    fontWeight: '600'
  },
  participantsListCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  participantItemCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  participantAvatarCompact: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
    flexShrink: 0
  },
  participantInfoCompact: {
    flex: 1,
    minWidth: 0
  },
  participantNameCompact: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#ececec',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  participantTimeCompact: {
    fontSize: '11px',
    color: '#6b7280'
  },
  statsSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '500'
  },
  summaryValue: {
    fontSize: '14px',
    color: '#ececec',
    fontWeight: '600'
  }
};
