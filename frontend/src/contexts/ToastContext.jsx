import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++toastId;
    
    setToasts(prev => [...prev, {
      id,
      message,
      type,
      duration
    }]);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((message, duration) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message, duration) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message, duration) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message, duration) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem
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

function ToastItem({ message, type = 'info', duration = 5000, onClose }) {
  const [isExiting, setIsExiting] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

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

const styles = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '400px',
    pointerEvents: 'none'
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
    minWidth: '300px',
    pointerEvents: 'auto'
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
