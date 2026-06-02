import React from 'react';

export default function SuccessModal({ title, message, onClose, actionText = 'Continue' }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.iconContainer}>
          <div style={styles.successIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
        </div>

        <h2 style={styles.title}>{title}</h2>
        <p style={styles.message}>{message}</p>

        <button onClick={onClose} style={styles.button}>
          {actionText}
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    animation: 'fadeIn 0.2s ease-out'
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center',
    border: '1px solid #2d2d2d',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    animation: 'slideUp 0.3s ease-out'
  },
  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(16, 163, 127, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#10a37f',
    animation: 'scaleIn 0.4s ease-out'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '12px'
  },
  message: {
    fontSize: '16px',
    color: '#b4b4b4',
    lineHeight: '1.6',
    marginBottom: '32px'
  },
  button: {
    width: '100%',
    padding: '14px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  }
};
