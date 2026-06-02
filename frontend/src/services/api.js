/**
 * API Service
 * Centralized HTTP client with interceptors and error handling
 */

import config from '../config/index.js';

class APIService {
  constructor() {
    this.baseURL = config.apiBaseUrl;
    this.token = null;
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
  }

  /**
   * Get headers for request
   */
  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Handle API response
   */
  async handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
      // Handle error response
      const error = new Error(data.error?.message || 'Request failed');
      error.code = data.error?.code;
      error.details = data.error?.details;
      error.statusCode = response.status;
      throw error;
    }

    return data;
  }

  /**
   * Handle API error
   */
  handleError(error) {
    // Network error
    if (!error.statusCode) {
      const networkError = new Error('Network error. Please check your connection.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }

    // Re-throw API errors
    throw error;
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(options.headers),
        ...options
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(options.headers),
        body: JSON.stringify(body),
        ...options
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PUT',
        headers: this.getHeaders(options.headers),
        body: JSON.stringify(body),
        ...options
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * PATCH request
   */
  async patch(endpoint, body, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'PATCH',
        headers: this.getHeaders(options.headers),
        body: JSON.stringify(body),
        ...options
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders(options.headers),
        ...options
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Upload file
   */
  async upload(endpoint, file, additionalData = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });

      const headers = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData
      });

      return await this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Create singleton instance
const apiService = new APIService();

export default apiService;
