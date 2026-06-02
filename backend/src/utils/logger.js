/**
 * Structured Logging System
 * Provides consistent, queryable logging across the application
 */

import config from '../config/index.js';

class Logger {
  constructor() {
    this.level = config.logLevel;
    this.format = config.logFormat;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    
    if (this.format === 'json') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
      });
    }

    // Pretty format for development
    const emoji = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍'
    }[level] || '📝';

    const metaStr = Object.keys(meta).length > 0 
      ? '\n' + JSON.stringify(meta, null, 2)
      : '';

    return `${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }

  // Specialized logging methods
  http(method, path, statusCode, duration, meta = {}) {
    this.info(`${method} ${path} ${statusCode} ${duration}ms`, meta);
  }

  ws(event, meta = {}) {
    this.debug(`WebSocket: ${event}`, meta);
  }

  ai(action, meta = {}) {
    this.info(`AI: ${action}`, meta);
  }

  db(operation, collection, meta = {}) {
    this.debug(`DB: ${operation} on ${collection}`, meta);
  }
}

export default new Logger();
