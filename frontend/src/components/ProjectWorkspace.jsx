import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ModelSelector from './ModelSelector';
import Sidebar from './Sidebar';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import apiRequest, { getWsUrl } from '../utils/api.js';
import Dashboard from './Dashboard';

export default function ProjectWorkspace({ project, onBack }) {
  const { user, token } = useAuth();
  const { colors } = useTheme();
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
  const [showAllSummaries, setShowAllSummaries] = useState(false);
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
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingTextRef = useRef('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  
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

  const handleSourceClick = (discussionId, messageId) => {
    if (discussionId && (!currentDiscussion || currentDiscussion._id !== discussionId)) {
      const discussion = discussions.find(d => d._id === discussionId);
      if (discussion) {
        switchDiscussion(discussion);
      }
    }
    setHighlightedMessageId(messageId);
    setShowDashboard(false);
  };

  useEffect(() => {
    if (highlightedMessageId && messages.length > 0) {
      setTimeout(() => {
        const msgElement = document.getElementById(`message-${highlightedMessageId}`);
        if (msgElement) {
          msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          msgElement.style.transition = 'background-color 0.5s ease';
          const originalBg = msgElement.style.backgroundColor;
          msgElement.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
          setTimeout(() => {
            msgElement.style.backgroundColor = originalBg;
            setHighlightedMessageId(null);
          }, 2000);
        }
      }, 100);
    }
  }, [highlightedMessageId, messages]);

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

  // Auto-scroll during streaming — only if user is near bottom, use instant to prevent jitter
  const messagesContainerRef = useRef(null);
  useEffect(() => {
    if (!isStreaming && !aiThinking) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    // Only auto-scroll if user is within 150px of bottom (not scrolled up reading history)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [streamingText, isStreaming, aiThinking]);

  useEffect(() => {
    if (!highlightedMessageId) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Scroll to bottom when returning to chat view
  useEffect(() => {
    if (!showDashboard && !showDocuments && !showSettings && !showSummaries && messages.length > 0) {
      if (highlightedMessageId) return; // Prevent bottom-scroll if we are navigating to a specific message
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [showDashboard, showDocuments, showSettings, showSummaries]);

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
      const data = JSON.parse(e.data);
      
      if (data.type === 'discussion-joined') {
        setMessages(data.messages);
        
        // Initialize saved messages state
        const savedIds = new Set();
        data.messages.forEach(m => {
          if (m.isSaved) savedIds.add(m._id);
        });
        setSavedMessageIds(prev => {
          const next = new Set(prev);
          savedIds.forEach(id => next.add(id));
          return next;
        });
        
        setIsLoadingMessages(false);
      } else if (data.type === 'project-chat') {
        setMessages(prev => prev.some(m => m._id && m._id === data.message._id) ? prev : [...prev, data.message]);
        setIsSendingMessage(false);
        if (data.message.isAI) {
          setAiThinking(false);
        }
      } else if (data.type === 'ai-stream-start') {
        setAiThinking(false);
        setIsStreaming(true);
        setStreamingText('');
        streamingTextRef.current = '';
        setIsSendingMessage(false);
      } else if (data.type === 'ai-stream-chunk') {
        streamingTextRef.current += data.chunk;
        setStreamingText(streamingTextRef.current);
      } else if (data.type === 'ai-stream-end') {
        setIsStreaming(false);
        setStreamingText('');
        streamingTextRef.current = '';
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      } else if (data.type === 'ai-error') {
        setAiThinking(false);
        setIsStreaming(false);
        setStreamingText('');
        streamingTextRef.current = '';
        setIsSendingMessage(false);
      } else if (data.type === 'message-saved') {
        setSavedMessageIds(prev => new Set(prev).add(data.messageId));
      } else if (data.type === 'error') {
        setIsSendingMessage(false);
        setAiThinking(false);
        setIsStreaming(false);
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
    
    // Auto-collapse sidebar on mobile screens
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
    
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

  const [savedMessageIds, setSavedMessageIds] = useState(new Set());
  const [savingMessageIds, setSavingMessageIds] = useState(new Set());

  const handleAddToMemory = async (msg) => {
    if (savedMessageIds.has(msg._id) || savingMessageIds.has(msg._id)) return;
    setSavingMessageIds(prev => new Set(prev).add(msg._id));
    try {
      const response = await apiRequest(`/api/projects/${project._id}/decisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ messageId: msg._id, discussionId: currentDiscussion?._id })
      });
      if (!response.ok) throw new Error('Failed to add to memory');
      setSavedMessageIds(prev => new Set(prev).add(msg._id));
    } catch (err) {
      console.error('Error adding to memory', err);
    } finally {
      setSavingMessageIds(prev => {
        const next = new Set(prev);
        next.delete(msg._id);
        return next;
      });
    }
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
    return <Settings project={project} onClose={() => setShowSettings(false)} token={token} isOwner={isOwner} colors={colors} />;
  }

  if (showDashboard) {
    return <Dashboard project={project} onClose={() => setShowDashboard(false)} token={token} colors={colors} onSourceClick={handleSourceClick} />;
  }

  if (showDocuments) {
    return <Documents project={project} onClose={() => setShowDocuments(false)} token={token} colors={colors} />;
  }

  if (showSummaries && currentDiscussion && !currentDiscussion.isMain) {
    return <Summaries 
      project={project} 
      discussion={currentDiscussion}
      onClose={() => setShowSummaries(false)} 
      token={token}
      colors={colors}
    />;
  }

  if (showAllSummaries) {
    return <AllDiscussionSummaries
      project={project}
      discussions={discussions}
      onClose={() => setShowAllSummaries(false)}
      token={token}
      colors={colors}
    />;
  }

  return (
    <div style={{...styles.container, background: colors.background}}>
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
          <button onClick={onBack} style={{...styles.sidebarHeaderBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Projects</span>
          </button>
          <button 
            onClick={() => setSidebarOpen(false)} 
            style={{...styles.closeSidebarBtn, color: colors.textTertiary}}
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
            <div style={{padding: '20px', textAlign: 'center', color: colors.textSecondary, fontSize: '14px'}}>
              No discussions yet
            </div>
          ) : (
            discussions.map(disc => {
            const isParticipant = disc.participants?.some(p => p._id === user._id) || isOwner;
            const displayTitle = disc.isMain ? '# Main Thread' : disc.title;

            // Stale summary: discussion got 10+ more messages since last summary
            const msgCount = disc.messageCount || 0;
            const summaryMsgCount = disc.latestSummary?.messageCountAtSummary || 0;
            const isStaleSummary = !disc.isMain && disc.latestSummary && (msgCount - summaryMsgCount) >= 10;

            // Relative time for lastActivity
            const relativeTime = (date) => {
              if (!date) return '';
              const diff = Date.now() - new Date(date).getTime();
              const mins = Math.floor(diff / 60000);
              if (mins < 1) return 'just now';
              if (mins < 60) return `${mins}m ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs}h ago`;
              return `${Math.floor(hrs / 24)}d ago`;
            };
            
            return (
              <div
                key={disc._id}
                className="thread-item"
                style={{
                  ...styles.discussionItem,
                  color: colors.text,
                  background: currentDiscussion?._id === disc._id ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                  fontWeight: disc.isMain ? '600' : '400',
                  borderLeft: currentDiscussion?._id === disc._id ? '3px solid #8b5cf6' : disc.isMain ? '3px solid #10a37f' : '3px solid transparent',
                  paddingLeft: '9px',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '2px',
                  borderRadius: '0 8px 8px 0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                    {isStaleSummary && (
                      <span title="Summary may be outdated" style={{ fontSize: '12px', marginLeft: '2px' }}>⚠️</span>
                    )}
                  </div>
                  {isParticipant && !disc.isMain && (
                    <div style={{ display: 'flex', gap: '2px' }}>
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
                    </div>
                  )}
                </div>
                {/* Metadata row */}
                <div style={{ display: 'flex', gap: '8px', paddingLeft: '24px', fontSize: '11px', color: colors.textTertiary }}>
                  {disc.messageCount > 0 && <span>{disc.messageCount} msg</span>}
                  {disc.lastActivity && <span>{relativeTime(disc.lastActivity)}</span>}
                </div>
              </div>
            );
          })
          )}
        </div>
      </Sidebar>

      {/* Main */}
      <div className="main-workspace" style={{...styles.main, marginLeft: sidebarOpen ? '308px' : '48px', minWidth: 0}}>
        {/* Header */}
        <div className="workspace-header-responsive" style={{...styles.header, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
          <div style={styles.headerTitle}>







            <ModelSelector 
              currentModel={currentModel}
              onModelChange={setCurrentModel}
              projectId={project._id}
              token={token}
              colors={colors}
            />
            <h2 style={{...styles.title, color: colors.text}}>{currentDiscussion?.title || project.title}</h2>
          </div>

          <div style={styles.headerActions}>
            <button onClick={() => setShowMenu(!showMenu)} style={{...styles.menuBtn, color: colors.text}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
            
            {showMenu && (
              <div style={{...styles.dropdown, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <button 
                  onClick={() => { setShowDashboard(true); setShowMenu(false); }} 
                  style={{...styles.dropdownItem, color: colors.text}}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  Project Memory
                </button>
                <button 
                  onClick={() => { setShowDocuments(true); setShowMenu(false); }} 
                  style={{...styles.dropdownItem, color: colors.text}}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                  Documents
                </button>
                {currentDiscussion?.isMain ? (
                  <button 
                    onClick={() => { setShowAllSummaries(true); setShowMenu(false); }} 
                    style={{...styles.dropdownItem, color: colors.text}}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                    </svg>
                    Discussion Summaries
                  </button>
                ) : (
                  <button 
                    onClick={() => { setShowSummaries(true); setShowMenu(false); }} 
                    style={{...styles.dropdownItem, color: colors.text}}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                    </svg>
                    Summarize
                  </button>
                )}
                <button 
                  onClick={() => { setShowSettings(true); setShowMenu(false); }} 
                  style={{...styles.dropdownItem, color: colors.text}}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
                  </svg>
                  Settings
                </button>
                <button 
                  onClick={() => { loadDiscussions(); setShowMenu(false); }} 
                  style={{...styles.dropdownItem, color: colors.text}}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>

        <div ref={messagesContainerRef} className="messages-container chat-messages" style={{...styles.messages, background: colors.background}}>
          {isLoadingMessages ? (
            <div style={styles.loadingState}>
              <div style={styles.loadingSpinner}></div>
              <p style={{...styles.loadingText, color: colors.textSecondary}}>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{...styles.empty, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'}}>
              <div style={{width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px'}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h2 style={{...styles.emptyTitle, color: colors.text, fontSize: '20px', fontWeight: '600'}}>{currentDiscussion?.title || project.title}</h2>
              <p style={{...styles.emptyText, color: colors.textSecondary, fontSize: '14px'}}>Start the conversation with your team</p>
              <p style={{...styles.emptyHint, color: colors.textTertiary, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                Type <span style={{background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500'}}>@CollabAI</span> for AI assistance
              </p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => <MessageBubble key={i} message={m} currentUser={user?.username} colors={colors} onAddToMemory={() => handleAddToMemory(m)} isSaving={savingMessageIds.has(m._id)} isSaved={savedMessageIds.has(m._id)} />)}
              {(aiThinking || isStreaming) && (
                <div className="msg-bubble-row ai-message-row" style={{
                  padding: '16px 0', width: '100%',
                  background: colors.surface,
                  borderBottom: `1px solid ${colors.border}`
                }}>
                  <div style={{maxWidth: '48rem', margin: '0 auto', padding: '0 24px', display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
                    <div style={{...styles.aiAvatar, flexShrink: 0, marginTop: '2px'}}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: '14px', fontWeight: '600', color: colors.text, marginBottom: '8px'}}>CollabAI</div>
                      {isStreaming && streamingText ? (
                        <div className="markdown-content" style={{color: colors.text}} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(streamingText)) }} />
                      ) : (
                        <div className="thinking-dots" style={{display: 'flex', gap: '6px', padding: '8px 0'}}>
                          <span></span><span></span><span></span>
                        </div>
                      )}
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

        <div style={{...styles.inputArea, background: colors.surface, borderTop: `1px solid ${colors.border}`}}>
          {showMentions && (
            <div ref={mentionRef} className="mention-box-responsive" style={{...styles.mentionBox, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'}}>
              {getMentionOptions().map((option, i) => (
                <div
                  key={i}
                  onClick={() => insertMention(option.username)}
                  style={{...styles.mentionItem, ':hover': {background: colors.surfaceHover}}}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    ...styles.mentionAvatar,
                    background: option.type === 'ai' ? '#10a37f' : '#5436da'
                  }}>
                    {option.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.mentionInfo}>
                    <div style={{...styles.mentionName, color: colors.text}}>{option.name}</div>
                    <div style={{...styles.mentionUsername, color: colors.textSecondary}}>{option.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="chat-input-wrapper" style={{...styles.inputBox, background: colors.background, border: `1px solid ${colors.border}`, borderRadius: '12px'}}>
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
                <div style={{...styles.attachMenu, background: colors.surface, border: `1px solid ${colors.border}`}}>
                  <label style={{...styles.attachMenuItem, color: colors.text}}>
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
              style={{...styles.textarea, color: colors.text}}
              rows={1}
            />
            
            <button 
              className="send-btn"
              onClick={sendMessage} 
              style={{
                ...styles.sendBtn,
                opacity: input.trim() ? 1 : 0.3
              }}
              disabled={!input.trim()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Create Discussion Modal */}
      {showCreateDiscussion && (
        <CreateDiscussionModal
          colors={colors}
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
          colors={colors}
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

function MessageBubble({ message, currentUser, colors, onAddToMemory, isSaving, isSaved }) {
  const isAI = message.user === 'CollabAI';
  const isCurrentUser = message.user === currentUser;
  const safeHTML = DOMPurify.sanitize(marked.parse(message.text || ''));
  const avatarColor = getAvatarColor(message.user);
  
  const timeStr = message.time ? new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  
  return (
    <div id={`message-${message._id}`} className={`msg-bubble-row ${isAI ? 'ai-message-row' : ''}`} style={{
      padding: '16px 0',
      width: '100%',
      background: isAI ? colors.surface : 'transparent',
      borderBottom: `1px solid ${colors.border}`,
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '48rem',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        gap: '12px',
        flexDirection: isCurrentUser && !isAI ? 'row-reverse' : 'row',
        alignItems: 'flex-start'
      }}>
        <div style={{ flexShrink: 0, paddingTop: '2px' }}>
          {isAI ? (
            <div style={styles.aiAvatar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: avatarColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              {getInitials(message.user)}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: isCurrentUser && !isAI ? 'right' : 'left' }}>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            marginBottom: '4px',
            justifyContent: isCurrentUser && !isAI ? 'flex-end' : 'flex-start'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>{message.user}</span>
            <span style={{ fontSize: '11px', color: colors.textTertiary }}>{timeStr}</span>
          </div>
          <div 
            className="markdown-content"
            style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6' }}
            dangerouslySetInnerHTML={{ __html: safeHTML }}
          />
        </div>
        {/* Memory button — absolutely positioned, only visible on hover */}
        {!isAI && onAddToMemory && (
          <button 
            className={isSaved || isSaving ? 'memory-btn-visible' : 'memory-btn'}
            onClick={onAddToMemory}
            disabled={isSaving || isSaved}
            style={{
              position: 'absolute',
              top: '8px',
              right: '24px',
              background: isSaved ? 'rgba(16,185,129,0.1)' : colors.surface,
              border: `1px solid ${isSaved ? '#10b981' : colors.border}`,
              borderRadius: '6px',
              fontSize: '11px',
              padding: '3px 8px',
              color: isSaved ? '#10b981' : colors.textSecondary,
              cursor: isSaved || isSaving ? 'default' : 'pointer',
              transition: 'opacity 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            title={isSaved ? 'Saved to Project Memory' : 'Save to Project Memory'}
          >
            {isSaved ? '✓ Saved' : isSaving ? '...' : (
              <>+<span className="memory-btn-text"> Memory</span></>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CreateDiscussionModal({ onClose, onCreate, colors }) {
  const [name, setName] = useState('');

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}} onClick={(e) => e.stopPropagation()}>
        <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
          <h3 style={{...styles.modalTitle, color: colors.text}}>Create New Discussion</h3>
          <button onClick={onClose} style={{...styles.modalClose, color: colors.textTertiary}}>
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
            style={{...styles.modalInput, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
            autoFocus
          />
          <div style={styles.modalActions}>
            <button onClick={onClose} style={{...styles.modalCancel, border: `1px solid ${colors.border}`, color: colors.text}}>Cancel</button>
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

function InviteToDiscussionModal({ project, discussionId, token, onClose, onInvite, colors }) {
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
      <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}} onClick={(e) => e.stopPropagation()}>
        <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
          <h3 style={{...styles.modalTitle, color: colors.text}}>Invite to {discussion?.title || 'Discussion'}</h3>
          <button onClick={onClose} style={{...styles.modalClose, color: colors.textTertiary}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: colors.textSecondary }}>Loading...</div>
        ) : (
          <div style={styles.modalBody}>
            {/* Tabs */}
            <div style={{...styles.tabs, borderBottom: `1px solid ${colors.border}`}}>
              <button
                onClick={() => setActiveTab('members')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'members' ? '2px solid #8b5cf6' : '2px solid transparent',
                  color: activeTab === 'members' ? colors.text : colors.textTertiary
                }}
              >
                Project Members
              </button>
              <button
                onClick={() => setActiveTab('external')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'external' ? '2px solid #8b5cf6' : '2px solid transparent',
                  color: activeTab === 'external' ? colors.text : colors.textTertiary
                }}
              >
                External Invite
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'members' ? (
              <div style={styles.tabContent}>
                {availableMembers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: colors.textSecondary }}>
                    All project members are already in this discussion
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {availableMembers.map(member => {
                      const avatarColor = getAvatarColor(member.username || 'User');
                      const initials = getInitials(member.username || 'User');
                      return (
                        <div key={member._id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: colors.background,
                          borderRadius: '8px',
                          marginBottom: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: avatarColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: '600',
                              flexShrink: 0
                            }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>
                                {member.username || 'Unknown'}
                              </div>
                              <div style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '2px' }}>
                                {member.email || ''}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddMember(member._id)}
                            style={{
                              padding: '8px 16px',
                              background: '#8b5cf6',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#7c3aed'}
                            onMouseLeave={(e) => e.target.style.background = '#8b5cf6'}
                          >
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.tabContent}>
                <p style={{...styles.inviteDesc, color: colors.textSecondary}}>
                  Share this link with people outside the project:
                </p>

                <div style={{...styles.linkBox, background: colors.background, border: `1px solid ${colors.border}`}}>
                  <code style={styles.linkText}>{inviteLink}</code>
                  <button onClick={handleCopyLink} style={{...styles.copyLinkBtn, border: `1px solid ${colors.border}`, color: colors.text}} title="Copy link">
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

                <div style={{...styles.divider, color: colors.textSecondary}}>
                  <span style={styles.dividerText}>OR</span>
                </div>

                <div style={styles.emailSection}>
                  <label style={{...styles.emailLabel, color: colors.text}}>Send via email</label>
                  <div style={styles.emailInputGroup}>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      style={{...styles.emailInput, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
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
                  <p style={{...styles.emailHint, color: colors.textSecondary}}>
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

function Documents({ project, onClose, token, colors }) {
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
    <div style={{...styles.fullPage, background: colors.background}}>
      <div className="page-header-responsive" style={{...styles.pageHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
        <button onClick={onClose} style={{...styles.backButton, border: `1px solid ${colors.border}`, color: colors.text}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={{...styles.pageTitle, color: colors.text}}>Documents</h1>
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

      <div className="page-content-responsive" style={styles.pageContent}>
        {documents.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>No documents uploaded yet</p>
            <p style={{...styles.emptyHint, color: colors.textTertiary}}>Upload .txt or .md files to provide context for AI</p>
          </div>
        ) : (
          <div style={styles.documentsList}>
            {documents.map(doc => {
              const contentSize = doc.content ? (doc.content.length / 1024).toFixed(1) : '0';
              const hasEmbeddings = doc.chunks && doc.chunks.length > 0;
              
              return (
                <div key={doc._id} style={{...styles.documentCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                  <div style={styles.documentInfo}>
                    <div style={{...styles.documentName, color: colors.text}}>{doc.title}</div>
                    <div style={{...styles.documentMeta, color: colors.textSecondary}}>
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

function Settings({ project, onClose, token, isOwner, colors }) {
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
      <div className="settings-modal-responsive" style={{...styles.settingsModal, background: colors.surface, border: `1px solid ${colors.border}`}}>
        <div style={{...styles.settingsHeader, borderBottom: `1px solid ${colors.border}`}}>
          <h2 style={{...styles.settingsTitle, color: colors.text}}>Project Settings</h2>
          <button onClick={onClose} style={{...styles.settingsClose, color: colors.textSecondary}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={styles.settingsBody}>
          <div style={styles.settingSection}>
            <h3 style={{...styles.sectionTitle, color: colors.text}}>Project Information</h3>
            <div style={styles.infoRow}>
              <span style={{...styles.infoLabel, color: colors.textSecondary}}>Title:</span>
              <span style={{...styles.infoValue, color: colors.text}}>{project.title}</span>
            </div>
          </div>

          <div style={styles.settingSection}>
            <h3 style={{...styles.sectionTitle, color: colors.text}}>Invite Link</h3>
            <p style={{...styles.sectionDesc, color: colors.textSecondary}}>Share this link with team members</p>
            <div style={styles.codeBox}>
              <code style={{...styles.code, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text, wordBreak: 'break-all', fontSize: '13px'}}>{`${window.location.origin}/join/${project.inviteCode}`}</code>
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
            
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${colors.border}` }}>
              <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '12px' }}>
                Or send invitation via email:
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder="teammate@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.text,
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
            <h3 style={{...styles.sectionTitle, color: colors.text}}>Members ({members.length})</h3>
            <div style={styles.membersList}>
              {members.map((member, i) => {
                const username = member.userId?.username || 'Unknown';
                const role = member.role || 'member';
                const avatarColor = getAvatarColor(username);
                const initials = getInitials(username);
                return (
                  <div key={i} style={{...styles.memberItem, background: colors.surface, border: `1px solid ${colors.border}`}}>
                    <div style={{
                      ...styles.memberAvatar,
                      background: avatarColor
                    }}>
                      {initials}
                    </div>
                    <div style={styles.memberInfo}>
                      <div style={{...styles.memberName, color: colors.text}}>{username}</div>
                      <div style={{...styles.memberRole, color: colors.textSecondary}}>{role === 'owner' ? 'Owner' : 'Member'}</div>
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

function Summaries({ project, discussion, onClose, token, colors }) {
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
    <div style={{...styles.fullPage, background: colors.background}}>
      <div className="page-header-responsive" style={{...styles.pageHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
        <button onClick={onClose} style={{...styles.backButton, border: `1px solid ${colors.border}`, color: colors.text}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={{...styles.pageTitle, color: colors.text}}>Summaries - {discussion.title}</h1>
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

      <div className="page-content-responsive" style={styles.pageContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>Loading summaries...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>No summaries yet</p>
            <p style={{...styles.emptyHint, color: colors.textTertiary}}>Generate a summary to capture key points from this discussion</p>
          </div>
        ) : (
          <div style={styles.summariesList}>
            {summaries.map(summary => (
              <div key={summary._id} style={{...styles.summaryCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <div style={styles.summaryHeader}>
                  <div style={styles.summaryMeta}>
                    <span style={{...styles.summaryDate, color: colors.text}}>
                      {new Date(summary.createdAt).toLocaleDateString()}
                    </span>
                    <span style={{...styles.summaryProvider, color: colors.textSecondary}}>
                      via {summary.generatedBy}
                    </span>
                  </div>
                  <div style={styles.summaryActions}>
                    <button 
                      onClick={() => setEditingSummary(summary._id)}
                      style={{...styles.summaryActionBtn, color: colors.text}}
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
                
                <div style={{...styles.summaryContent, color: colors.text}}>
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

function AllDiscussionSummaries({ project, discussions, onClose, token, colors }) {
  const [summariesByDisc, setSummariesByDisc] = useState({});
  const [loading, setLoading] = useState(true);

  const parallelDiscussions = discussions.filter(d => !d.isMain);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/summaries`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        // Group by discussionId
        const grouped = {};
        data.summaries.forEach(s => {
          const key = s.discussionId;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(s);
        });
        setSummariesByDisc(grouped);
      }
    } catch (err) {
      console.error('Error loading all summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const relativeTime = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{...styles.fullPage, background: colors.background}}>
      <div className="page-header-responsive" style={{...styles.pageHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
        <button onClick={onClose} style={{...styles.backButton, border: `1px solid ${colors.border}`, color: colors.text}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={{...styles.pageTitle, color: colors.text}}>Discussion Summaries</h1>
        <div style={{ width: '100px' }} />
      </div>

      <div className="page-content-responsive" style={styles.pageContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <p style={{color: colors.textSecondary}}>Loading...</p>
          </div>
        ) : parallelDiscussions.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{color: colors.textSecondary}}>No parallel discussions yet</p>
          </div>
        ) : (
          <div style={styles.summariesList}>
            {parallelDiscussions.map(disc => {
              const discSummaries = summariesByDisc[disc._id] || [];
              const msgCount = disc.messageCount || 0;
              const latestSummary = discSummaries[0];
              const isStaleSummary = latestSummary && (msgCount - (latestSummary.messageCountAtSummary || 0)) >= 10;

              return (
                <div key={disc._id} style={{...styles.summaryCard, background: colors.surface, border: `1px solid ${colors.border}`, marginBottom: '20px'}}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span style={{ color: colors.text, fontWeight: '600', fontSize: '15px' }}>{disc.title}</span>
                      {isStaleSummary && (
                        <span title="Summary may be outdated — discussion has grown significantly" style={{ fontSize: '13px' }}>⚠️ stale</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: colors.textTertiary }}>
                      {msgCount > 0 && <span>{msgCount} messages</span>}
                      {disc.lastActivity && <span>active {relativeTime(disc.lastActivity)}</span>}
                    </div>
                  </div>

                  {discSummaries.length === 0 ? (
                    <p style={{ color: colors.textTertiary, fontSize: '13px', fontStyle: 'italic' }}>No summary yet</p>
                  ) : (
                    discSummaries.map(s => (
                      <div key={s._id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                            {new Date(s.createdAt).toLocaleDateString()} · via {s.generatedBy}
                          </span>
                          {s.messageCountAtSummary > 0 && (
                            <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                              at {s.messageCountAtSummary} messages
                            </span>
                          )}
                        </div>
                        <div style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                          {s.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
    width: '100%'
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
    gap: '12px',
    marginLeft: '8px',
    minWidth: 0,
    flexWrap: 'wrap',
    position: 'relative'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0
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
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  inputArea: {
    padding: '12px 0 16px',
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
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '13px',
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
    padding: '16px'
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
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexWrap: 'wrap',
    gap: '4px'
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
    alignItems: 'center',
    flexWrap: 'wrap'
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
    gap: '16px',
    padding: '16px',
    background: '#0d0d0d',
    borderRadius: '8px',
    border: '1px solid #2d2d2d'
  },
  memberAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
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
    zIndex: 2000,
    padding: '16px'
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
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
    width: '100%',
    height: '100vh',
    background: '#0d0d0d',
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 24px',
    borderBottom: '1px solid #2d2d2d',
    background: '#171717',
    flexWrap: 'wrap'
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
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0
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
    gap: '16px',
    padding: '16px',
    background: '#40414f',
    borderRadius: '8px'
  },
  memberAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
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
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexWrap: 'wrap',
    gap: '8px'
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
    background: '#16171f',
    flexWrap: 'wrap',
    gap: '12px'
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
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s'
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
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
  viewAllBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #3d3d3d',
    borderRadius: '6px',
    color: '#8e8ea0',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  // New Dashboard Redesign Styles
  healthBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
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
    gridTemplateColumns: 'minmax(80px, 140px) 1fr 40px',
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
