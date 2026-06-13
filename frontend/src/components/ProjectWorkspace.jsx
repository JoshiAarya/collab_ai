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
import MessageBubble from './workspace/MessageBubble';
import CreateDiscussionModal from './workspace/CreateDiscussionModal';
import InviteToDiscussionModal from './workspace/InviteToDiscussionModal';
import Documents from './workspace/Documents';
import Settings from './workspace/Settings';
import Summaries from './workspace/Summaries';
import AllDiscussionSummaries from './workspace/AllDiscussionSummaries';
import styles from './workspace/workspaceStyles';

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
  const [mentionIndex, setMentionIndex] = useState(0);
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
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const prependingRef = useRef(false); // suppress bottom-scroll when older messages are prepended
  
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
    if (prependingRef.current) {
      prependingRef.current = false;
      return; // older history was prepended — keep the user's scroll position
    }
    if (!highlightedMessageId) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Fetch the page of messages before the oldest one currently loaded
  const loadOlderMessages = async () => {
    if (isLoadingOlder || !hasMoreMessages || !currentDiscussion) return;
    const oldest = messages.find(m => m._id);
    if (!oldest) return;

    setIsLoadingOlder(true);
    const container = messagesContainerRef.current;
    const prevHeight = container ? container.scrollHeight : 0;

    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${currentDiscussion._id}/messages?before=${oldest._id}&limit=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setHasMoreMessages(data.hasMore);
        if (data.messages.length > 0) {
          const older = data.messages.map(m => ({
            _id: m._id, user: m.user, text: m.text,
            time: m.timestamp, isAI: m.isAI, isSaved: !!m.isSaved
          }));
          setSavedMessageIds(prev => {
            const next = new Set(prev);
            older.forEach(m => { if (m.isSaved) next.add(m._id); });
            return next;
          });
          prependingRef.current = true;
          setMessages(prev => [...older, ...prev]);
          // Keep the viewport anchored on the message the user was reading
          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevHeight;
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleMessagesScroll = (e) => {
    if (e.currentTarget.scrollTop < 80) {
      loadOlderMessages();
    }
  };

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
    setMentionIndex(0);
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
        setHasMoreMessages(data.messages.length >= 50);

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
    setHasMoreMessages(false);
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
    
    // Check if mentioning AI (case-insensitive, matching the backend trigger)
    if (/^\s*@collabai\b/i.test(input)) {
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
    if (showMentions) {
      const options = getMentionOptions();
      if (options.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setMentionIndex(i => (i + 1) % options.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setMentionIndex(i => (i - 1 + options.length) % options.length);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          insertMention(options[Math.min(mentionIndex, options.length - 1)].username);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowMentions(false);
          return;
        }
      }
    }
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
    return <Settings project={project} onClose={() => setShowSettings(false)} token={token} isOwner={isOwner} colors={colors} onProjectGone={onBack} />;
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

        <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="messages-container chat-messages" style={{...styles.messages, background: colors.background}}>
          {!isLoadingMessages && messages.length > 0 && hasMoreMessages && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              {isLoadingOlder ? (
                <span style={{ fontSize: '13px', color: colors.textTertiary }}>Loading earlier messages…</span>
              ) : (
                <button
                  onClick={loadOlderMessages}
                  style={{
                    background: 'transparent', border: `1px solid ${colors.border}`,
                    borderRadius: '6px', padding: '6px 14px', fontSize: '13px',
                    color: colors.textSecondary, cursor: 'pointer'
                  }}
                >
                  Load earlier messages
                </button>
              )}
            </div>
          )}
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
                  style={{...styles.mentionItem, background: i === mentionIndex ? colors.surfaceHover : 'transparent'}}
                  onMouseEnter={() => setMentionIndex(i)}
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
                  body: JSON.stringify({ title: name })
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
