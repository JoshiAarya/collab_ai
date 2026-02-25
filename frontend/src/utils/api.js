/**
 * API Utility
 * Centralized API calls using config
 */
import config from '../config/index.js';

/**
 * Make an API request
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export const apiRequest = (endpoint, options = {}) => {
  const url = `${config.apiBaseUrl}${endpoint}`;
  return fetch(url, options);
};

/**
 * Get full API URL for an endpoint
 * @param {string} endpoint - API endpoint
 * @returns {string} Full URL
 */
export const getApiUrl = (endpoint) => {
  return `${config.apiBaseUrl}${endpoint}`;
};

/**
 * Get WebSocket URL
 * @returns {string} WebSocket URL
 */
export const getWsUrl = () => {
  return config.wsBaseUrl;
};

export default apiRequest;
