import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { getAvatarColor, getInitials } from '../../utils/avatarColors';
import styles from './workspaceStyles';

export default function MessageBubble({ message, currentUser, colors, onAddToMemory, isSaving, isSaved }) {
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
