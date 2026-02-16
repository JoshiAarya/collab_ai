/**
 * Toast Notification Component
 * Displays temporary notification messages
 */

import React, { useState, useEffect } from 'react';

export function Toast({ message, type = 'info', duration = 5000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const colors = {
    success: '#10a37f',
    error: '#ff6b6b',
    warning: '#ffa500',
    info: '#4a9eff'
  };

  return (
    <div 
      style={{
        ...styles.toast,
        borderLeft: `4px solid ${colors[type]}`,
        animation: isExiting ? 'slideOut 0.3s ease-out' : 'slideIn 0.3s ease-out'
      }}
    >
      <div style={{...styles.icon, color: colors[type]}}>
        {icons[type]}
      </div>
      <div style={styles.message}>{message}</div>
      <button onClick={handleClose} style={styles.closeButton}>
        ✕
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '400px'
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#1e1e1e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    minWidth: '300px'
  },
  icon: {
    fontSize: '20px',
    fontWeight: 'bold',
    flexShrink: 0
  },
  message: {
    flex: 1,
    color: '#ececf1',
    fontSize: '14px',
    lineHeight: '1.4'
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
    flexShrink: 0,
    transition: 'color 0.2s'
  }
};

// Add keyframe animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(styleSheet);

export default Toast;
