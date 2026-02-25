/**
 * Frontend Configuration
 * Centralized configuration for API endpoints and app settings
 */

const env = import.meta.env.MODE || 'development';

// Determine base URLs based on environment
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  // If explicitly set to empty string or in production, use same origin
  if (envUrl === '' || (env === 'production' && !envUrl)) {
    return window.location.origin;
  }
  return envUrl || 'http://localhost:8080';
};

const getWsBaseUrl = () => {
  const envUrl = import.meta.env.VITE_WS_BASE_URL;
  // If explicitly set to empty string or in production, derive from current location
  if (envUrl === '' || (env === 'production' && !envUrl)) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return envUrl || 'ws://localhost:8080';
};

const config = {
  // Environment
  isDevelopment: env === 'development',
  isProduction: env === 'production',

  // API Configuration
  apiBaseUrl: getApiBaseUrl(),
  wsBaseUrl: getWsBaseUrl(),

  // API Endpoints
  api: {
    auth: {
      register: '/api/auth/register',
      login: '/api/auth/login',
      verify: '/api/auth/verify',
      google: '/api/auth/google'
    },
    projects: {
      list: '/api/projects',
      create: '/api/projects',
      get: (id) => `/api/projects/${id}`,
      update: (id) => `/api/projects/${id}`,
      join: '/api/projects/join',
      discussions: (id) => `/api/projects/${id}/discussions`,
      documents: (id) => `/api/projects/${id}/documents`,
      summary: (id) => `/api/projects/${id}/summary`,
      insights: (id) => `/api/projects/${id}/insights`
    },
    discussions: {
      create: (projectId) => `/api/projects/${projectId}/discussions`,
      get: (projectId, discussionId) => `/api/projects/${projectId}/discussions/${discussionId}`,
      messages: (projectId, discussionId) => `/api/projects/${projectId}/discussions/${discussionId}/messages`
    },
    documents: {
      upload: (projectId) => `/api/projects/${projectId}/documents`,
      delete: (projectId, docId) => `/api/projects/${projectId}/documents/${docId}`
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
  },

  // Feature Flags
  features: {
    offlineMode: true,
    optimisticUpdates: true,
    aiStreaming: false, // Coming soon
    voiceInput: false // Coming soon
  }
};

export default config;
