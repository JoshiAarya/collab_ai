import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api.js';
import config from '../config/index.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setInitialCheckDone] = useState(false);

  useEffect(() => {
    // Check for stored token
    const storedToken = localStorage.getItem('collab-ai-token');
    if (storedToken) {
      apiService.setToken(storedToken);
      verifyToken(storedToken);
    } else {
      setLoading(false);
      setInitialCheckDone(true);
    }
  }, []);

  const verifyToken = async (tokenToVerify) => {
    try {
      const data = await apiService.get(config.api.auth.verify);

      if (data.success) {
        setUser(data.user);
        setToken(tokenToVerify);
      } else {
        localStorage.removeItem('collab-ai-token');
        apiService.clearToken();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('collab-ai-token');
      apiService.clearToken();
    } finally {
      setLoading(false);
      setInitialCheckDone(true);
    }
  };

  const login = async (email, password) => {
    const data = await apiService.post(config.api.auth.login, { email, password });
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Login failed');
    }

    setUser(data.user);
    setToken(data.token);
    apiService.setToken(data.token);
    localStorage.setItem('collab-ai-token', data.token);
    
    return data;
  };

  const register = async (username, email, password) => {
    const data = await apiService.post(config.api.auth.register, { 
      username, 
      email, 
      password 
    });
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Registration failed');
    }

    setUser(data.user);
    setToken(data.token);
    apiService.setToken(data.token);
    localStorage.setItem('collab-ai-token', data.token);
    
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    apiService.clearToken();
    localStorage.removeItem('collab-ai-token');
  };

  // Expose method to manually trigger token verification (for OAuth)
  const refreshAuth = async () => {
    const storedToken = localStorage.getItem('collab-ai-token');
    if (storedToken) {
      setLoading(true);
      apiService.setToken(storedToken);
      await verifyToken(storedToken);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
