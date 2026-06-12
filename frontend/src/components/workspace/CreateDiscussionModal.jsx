import React, { useState } from 'react';
import styles from './workspaceStyles';

export default function CreateDiscussionModal({ onClose, onCreate, colors }) {
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
