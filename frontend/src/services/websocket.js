/**
 * WebSocket Service
 * Manages WebSocket connection lifecycle, reconnection, and message handling
 */

import config from '../config/index.js';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = config.wsBaseUrl;
    this.token = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.messageQueue = [];
    this.listeners = new Map();
    this.status = 'disconnected'; // disconnected, connecting, connected, reconnecting
    this.isIntentionalClose = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.token = token;
    this.isIntentionalClose = false;
    this.status = 'connecting';
    this.emit('status', 'connecting');

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.ws.onopen = () => {
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.emit('status', 'connected');

      // Authenticate
      if (this.token) {
        this.send({ type: 'auth', token: this.token });
      }

      // Send queued messages
      this.flushMessageQueue();

      // Start heartbeat
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      this.status = 'disconnected';
      this.emit('status', 'disconnected');
      this.stopHeartbeat();

      if (!this.isIntentionalClose) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    // Emit to specific event listeners
    if (data.type) {
      this.emit(data.type, data);
    }

    // Emit to general message listeners
    this.emit('message', data);
  }

  /**
   * Send message
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Queue message if not connected
      if (this.messageQueue.length < config.ws.messageQueueSize) {
        this.messageQueue.push(data);
      }
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  handleReconnect() {
    if (this.reconnectAttempts >= config.ws.reconnectMaxAttempts) {
      this.emit('max-reconnect-attempts');
      return;
    }

    this.status = 'reconnecting';
    this.emit('status', 'reconnecting');

    const delay = Math.min(
      config.ws.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(this.token);
    }, delay);
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, config.ws.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.isIntentionalClose = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.status = 'disconnected';
    this.emit('status', 'disconnected');
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.status === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Join project discussion
   */
  joinProject(projectId, discussionId) {
    this.send({
      type: 'join-project',
      projectId,
      discussionId
    });
  }

  /**
   * Send chat message
   */
  sendMessage(text) {
    this.send({
      type: 'project-chat',
      text
    });
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
