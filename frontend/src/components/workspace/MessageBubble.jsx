import React, { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getAvatarColor, getInitials } from '../../utils/avatarColors';
import styles from './workspaceStyles';

function SourceAttribution({ sources, colors, onNavigateToDashboard, onNavigateToMessage }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources) return null;

  const totalCount =
    (sources.decisions?.length || 0) +
    (sources.messages?.length || 0) +
    (sources.summaries?.length || 0) +
    (sources.documents?.length || 0);

  if (totalCount === 0) return null;

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const sectionStyle = {
    marginTop: '12px',
    borderTop: `1px solid ${colors.border}`,
    paddingTop: '8px',
  };

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    fontSize: '12px',
    color: colors.textSecondary,
    background: 'rgba(139, 92, 246, 0.08)',
    border: `1px solid rgba(139, 92, 246, 0.2)`,
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontWeight: '500',
    letterSpacing: '0.01em',
  };

  const sourceGroupStyle = {
    marginTop: '10px',
    paddingLeft: '0',
  };

  const groupLabelStyle = {
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: colors.textTertiary,
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const sourceItemStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    color: colors.textSecondary,
    lineHeight: '1.5',
    transition: 'background 0.15s ease',
    cursor: 'default',
  };

  const clickableItemStyle = {
    ...sourceItemStyle,
    cursor: 'pointer',
  };

  const iconSize = 14;

  return (
    <div style={sectionStyle}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={pillStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {totalCount} {totalCount === 1 ? 'source' : 'sources'} referenced
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div style={{
          marginTop: '10px',
          padding: '12px',
          background: colors.surface,
          borderRadius: '10px',
          border: `1px solid ${colors.border}`,
          borderLeft: '3px solid rgba(139, 92, 246, 0.5)',
        }}>
          {/* Decisions */}
          {sources.decisions?.length > 0 && (
            <div style={sourceGroupStyle}>
              <div style={groupLabelStyle}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Decisions ({sources.decisions.length})
              </div>
              {sources.decisions.map((d, i) => (
                <div
                  key={`dec-${i}`}
                  style={clickableItemStyle}
                  onClick={onNavigateToDashboard}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title="View in Project Memory"
                >
                  <span style={{ color: '#10b981', flexShrink: 0, marginTop: '1px' }}>•</span>
                  <div>
                    <span style={{ color: colors.text, fontWeight: '500' }}>{d.text}</span>
                    <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.7 }}>
                      — {d.proposedBy}{d.timestamp ? `, ${formatDate(d.timestamp)}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          {sources.messages?.length > 0 && (
            <div style={{ ...sourceGroupStyle, marginTop: sources.decisions?.length > 0 ? '14px' : '10px' }}>
              <div style={groupLabelStyle}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Messages ({sources.messages.length})
              </div>
              {sources.messages.map((m, i) => (
                <div
                  key={`msg-${i}`}
                  style={clickableItemStyle}
                  onClick={() => {
                    if (m.discussionId && m.messageId && onNavigateToMessage) {
                      onNavigateToMessage(m.discussionId, m.messageId);
                    }
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  title={m.discussionId && m.messageId ? 'Jump to message' : ''}
                >
                  <span style={{ color: '#8b5cf6', flexShrink: 0, marginTop: '1px' }}>•</span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: '500', color: colors.text }}>{m.username}</span>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}> in {m.discussionTitle}</span>
                    {m.snippet && (
                      <div style={{
                        fontSize: '11px',
                        color: colors.textTertiary,
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '400px'
                      }}>
                        "{m.snippet}{m.snippet.length >= 100 ? '…' : ''}"
                      </div>
                    )}
                    {m.timestamp && (
                      <span style={{ fontSize: '10px', opacity: 0.5 }}>{formatTime(m.timestamp)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summaries */}
          {sources.summaries?.length > 0 && (
            <div style={{ ...sourceGroupStyle, marginTop: (sources.decisions?.length > 0 || sources.messages?.length > 0) ? '14px' : '10px' }}>
              <div style={groupLabelStyle}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Summaries ({sources.summaries.length})
              </div>
              {sources.summaries.map((s, i) => (
                <div
                  key={`sum-${i}`}
                  style={sourceItemStyle}
                >
                  <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }}>•</span>
                  <div>
                    <span style={{ color: colors.text, fontWeight: '500' }}>Summary of {s.discussionTitle}</span>
                    {s.createdAt && (
                      <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '6px' }}>{formatDate(s.createdAt)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Documents */}
          {sources.documents?.length > 0 && (
            <div style={{ ...sourceGroupStyle, marginTop: (sources.decisions?.length > 0 || sources.messages?.length > 0 || sources.summaries?.length > 0) ? '14px' : '10px' }}>
              <div style={groupLabelStyle}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
                Documents ({sources.documents.length})
              </div>
              {sources.documents.map((doc, i) => (
                <div
                  key={`doc-${i}`}
                  style={sourceItemStyle}
                >
                  <span style={{ color: '#3b82f6', flexShrink: 0, marginTop: '1px' }}>•</span>
                  <span style={{ color: colors.text, fontWeight: '500' }}>{doc.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, currentUser, colors, onAddToMemory, isSaving, isSaved, onNavigateToDashboard, onNavigateToMessage }) {
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
          {/* Source Attribution — only for AI messages with sources */}
          {isAI && message.sources && (
            <SourceAttribution
              sources={message.sources}
              colors={colors}
              onNavigateToDashboard={onNavigateToDashboard}
              onNavigateToMessage={onNavigateToMessage}
            />
          )}
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
