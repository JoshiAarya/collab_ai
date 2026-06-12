/**
 * Frontend Configuration
 * Centralized configuration for API endpoints and app settings
 */

const env = import.meta.env.MODE || 'development';

const config = {
  // Environment
  isDevelopment: env === 'development',
  isProduction: env === 'production',

  // API Configuration - uses VITE_API_BASE_URL from .env files
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080',

  // API Endpoints
  api: {
    auth: {
      register: '/api/auth/register',
      login: '/api/auth/login',
      verify: '/api/auth/verify',
      google: '/api/auth/google'
    }
  },

  // WebSocket Configuration
  ws: {
    reconnectInterval: 3000,
    reconnectMaxAttempts: 10,
    heartbeatInterval: 30000,
    messageQueueSize: 100
  },

  // UI Configuration
  ui: {
    toastDuration: 5000,
    messageLoadLimit: 50,
    documentMaxSize: 10 * 1024 * 1024, // 10MB
    autoScrollThreshold: 100
  }
};

export default config;
