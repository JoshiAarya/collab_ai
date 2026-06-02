/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console in development
    if (import.meta.env.MODE === 'development') {
      console.error('Error Boundary caught:', error, errorInfo);
    }

    // In production, you would send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.icon}>⚠️</div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              We're sorry for the inconvenience. The application encountered an unexpected error.
            </p>
            
            {import.meta.env.MODE === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details (Development Only)</summary>
                <pre style={styles.errorText}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div style={styles.actions}>
              <button onClick={this.handleReset} style={styles.button}>
                Try Again
              </button>
              <button 
                onClick={() => window.location.href = '/'} 
                style={{...styles.button, ...styles.secondaryButton}}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    padding: '20px'
  },
  content: {
    maxWidth: '600px',
    width: '100%',
    background: '#161b22',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center'
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '12px'
  },
  message: {
    fontSize: '16px',
    color: '#8e8ea0',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  details: {
    marginTop: '24px',
    marginBottom: '24px',
    textAlign: 'left',
    background: '#0d1117',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '16px'
  },
  summary: {
    cursor: 'pointer',
    color: '#ececf1',
    fontWeight: '500',
    marginBottom: '12px'
  },
  errorText: {
    fontSize: '12px',
    color: '#ff6b6b',
    overflow: 'auto',
    maxHeight: '200px',
    fontFamily: 'monospace'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  button: {
    padding: '12px 24px',
    background: '#10a37f',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontFamily: 'inherit'
  },
  secondaryButton: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#ececf1'
  }
};

export default ErrorBoundary;
