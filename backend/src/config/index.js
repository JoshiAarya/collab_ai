/**
 * Centralized Configuration Management
 * Single source of truth for all environment variables and system configuration
 */

import dotenv from 'dotenv';

dotenv.config();

class Config {
  constructor() {
    this.validateRequired();
  }

  // Server Configuration
  get port() {
    return parseInt(process.env.PORT || '8080', 10);
  }

  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  }

  get isDevelopment() {
    return this.nodeEnv === 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  // Database Configuration
  get mongoUri() {
    return process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-chat';
  }

  get mongoOptions() {
    return {
      maxPoolSize: this.isProduction ? 50 : 10,
      minPoolSize: this.isProduction ? 10 : 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
  }

  // AI Configuration
  get groqApiKey() {
    return process.env.GROQ_API_KEY || process.env.CHATBOT_API_KEY;
  }

  get defaultLLMProvider() {
    return 'groq';
  }

  get defaultLLMModel() {
    return 'llama-3.1-8b-instant';
  }

  // Security Configuration
  get jwtSecret() {
    return process.env.JWT_SECRET || 'dev-secret-change-in-production';
  }

  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '7d';
  }

  get bcryptRounds() {
    return parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  }

  // WebSocket Configuration
  get wsHeartbeatInterval() {
    return parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10);
  }

  get wsReconnectTimeout() {
    return parseInt(process.env.WS_RECONNECT_TIMEOUT || '5000', 10);
  }

  // Rate Limiting
  get rateLimitWindow() {
    return parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10); // 1 minute
  }

  get rateLimitMaxRequests() {
    return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
  }

  get wsRateLimitMaxMessages() {
    return parseInt(process.env.WS_RATE_LIMIT_MAX_MESSAGES || '30', 10); // per minute
  }

  // Context & RAG Configuration
  get maxContextTokens() {
    return parseInt(process.env.MAX_CONTEXT_TOKENS || '6000', 10);
  }

  get maxDocumentChunkSize() {
    return parseInt(process.env.MAX_DOCUMENT_CHUNK_SIZE || '1000', 10);
  }

  get embeddingDimensions() {
    return parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10);
  }

  // Logging Configuration
  get logLevel() {
    return process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info');
  }

  get logFormat() {
    return this.isDevelopment ? 'pretty' : 'json';
  }

  // CORS Configuration
  get corsOrigins() {
    const origins = process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000';
    return origins.split(',').map(o => o.trim());
  }

  // Validation
  validateRequired() {
    const required = [
      { key: 'groqApiKey', name: 'GROQ_API_KEY or CHATBOT_API_KEY' }
    ];

    const missing = required.filter(({ key }) => !this[key]);

    if (missing.length > 0) {
      const missingNames = missing.map(m => m.name).join(', ');
      throw new Error(`Missing required environment variables: ${missingNames}`);
    }

    // In production, refuse to start with a missing or default JWT secret.
    if (this.isProduction) {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-in-production') {
        throw new Error('JWT_SECRET must be set to a strong unique value in production');
      }
      if (!process.env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY must be set in production (openssl rand -hex 32)');
      }
    }
  }

  // Get all config as object (for debugging)
  toObject() {
    return {
      port: this.port,
      nodeEnv: this.nodeEnv,
      mongoUri: this.mongoUri.replace(/\/\/.*@/, '//***@'), // Hide credentials
      defaultLLM: {
        provider: this.defaultLLMProvider,
        model: this.defaultLLMModel
      },
      logLevel: this.logLevel,
      corsOrigins: this.corsOrigins
    };
  }
}

export default new Config();
