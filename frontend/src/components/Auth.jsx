import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#10a37f"/>
            <path d="M20 10L28 16V24L20 30L12 24V16L20 10Z" fill="white"/>
          </svg>
        </div>
        
        <h1 style={styles.title}>
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
                autoFocus={!isLogin}
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              autoFocus={isLogin}
            />
          </div>

          <div style={styles.inputGroup}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Continue' : 'Sign up')}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR</span>
        </div>

        <button style={styles.googleButton} disabled>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div style={styles.footer}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={styles.link}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#343541',
    padding: '20px'
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '48px 40px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 2px 16px rgba(0,0,0,0.1)'
  },
  logo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '32px',
    textAlign: 'center',
    color: '#2d333a'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  input: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid #c2c8d0',
    background: '#fff',
    color: '#2d333a',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit'
  },
  button: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#10a37f',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'background 0.2s',
    fontFamily: 'inherit'
  },
  error: {
    padding: '12px 16px',
    borderRadius: '8px',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: '14px',
    border: '1px solid #fecaca'
  },
  divider: {
    position: 'relative',
    textAlign: 'center',
    margin: '24px 0',
    '::before': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      height: '1px',
      background: '#e5e7eb'
    }
  },
  dividerText: {
    position: 'relative',
    background: '#fff',
    padding: '0 12px',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '500'
  },
  googleButton: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid #c2c8d0',
    background: '#fff',
    color: '#2d333a',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    opacity: 0.6,
    fontFamily: 'inherit'
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '14px',
    color: '#6b7280'
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#10a37f',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0,
    fontFamily: 'inherit'
  }
};
