import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import apiRequest from '../utils/api.js';

const ThemeContext = createContext(null);

export const themes = {
  dark: {
    name: 'dark',
    colors: {
      background: '#0d0d0d',
      surface: '#1a1a1a',
      surfaceHover: '#2d2d2d',
      border: '#2d2d2d',
      text: '#ececec',
      textSecondary: '#b4b4b4',
      textTertiary: '#6b6b6b',
      primary: '#8b5cf6',
      success: '#10a37f',
      error: '#ff6b6b',
      warning: '#ffa500',
      iconBar: '#111111'
    }
  },
  light: {
    name: 'light',
    colors: {
      background: '#ffffff',
      surface: '#f7f7f8',
      surfaceHover: '#ececed',
      border: '#e5e5e5',
      text: '#0d0d0d',
      textSecondary: '#565869',
      textTertiary: '#8e8ea0',
      primary: '#8b5cf6',
      success: '#10a37f',
      error: '#ef4444',
      warning: '#f59e0b',
      iconBar: '#f7f7f8'
    }
  }
};

export function ThemeProvider({ children }) {
  const { user, token } = useAuth();
  const [theme, setTheme] = useState(user?.theme || 'dark');

  useEffect(() => {
    if (user?.theme) {
      setTheme(user.theme);
    }
  }, [user]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    // Update on backend
    if (token) {
      try {
        await apiRequest('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ theme: newTheme })
        });
      } catch (error) {
        console.error('Failed to update theme:', error);
      }
    }
  };

  const currentTheme = themes[theme];

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: currentTheme.colors }}>
      <div style={{
        background: currentTheme.colors.background,
        color: currentTheme.colors.text,
        minHeight: '100vh',
        '--surface-color': currentTheme.colors.surface,
        '--border-color': currentTheme.colors.border,
        '--text-secondary': currentTheme.colors.textSecondary
      }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
