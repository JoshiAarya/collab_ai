/**
 * WebSocket Connection Manager
 * Handles WebSocket lifecycle, authentication, and message routing
 */

import { WebSocketServer } from 'ws';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import authService from './authService.js';
import projectService from './projectService.js';
import discussionService from './discussionService.js';
import aiService from './aiService.js';


class ConnectionManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> metadata
    this.heartbeatInterval = null;
    this.messageRateLimits = new Map(); // clientId -> { count, resetTime }
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat mechanism
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    
    // Initialize client metadata
    this.clients.set(ws, {
      id: clientId,
      userId: null,
      username: null,
      projectId: null,
      discussionId: null,
      isAlive: true,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    });

    logger.ws('Client connected', { clientId, ip: req.socket.remoteAddress });

    // Setup pong handler for heartbeat
    ws.on('pong', () => {
      const meta = this.clients.get(ws);
      if (meta) {
        meta.isAlive = true;
        meta.lastActivity = Date.now();
      }
    });

    // Handle messages
    ws.on('message', async (msg) => {
      await this.handleMessage(ws, msg);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
    });
  }

  /**
   * Handle incoming message
   */
  async handleMessage(ws, msg) {
    const meta = this.clients.get(ws);
    if (!meta) return;

    try {
      const data = JSON.parse(msg);
      
      // Update activity timestamp
      meta.lastActivity = Date.now();

      // Rate limiting
      if (!this.checkRateLimit(meta.id)) {
        this.sendError(ws, 'Rate limit exceeded. Please slow down.');
        return;
      }

      // Route message based on type
      switch (data.type) {
        case 'auth':
          await this.handleAuth(ws, data);
          break;

        case 'join-project':
          await this.handleJoinProject(ws, data);
          break;

        case 'project-chat':
          await this.handleProjectChat(ws, data);
          break;

        case 'ping':
          this.send(ws, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          logger.warn('Unknown message type', { type: data.type, clientId: meta.id });
      }

    } catch (error) {
      logger.error('Error handling message', { 
        clientId: meta.id, 
        error: error.message 
      });
      this.sendError(ws, 'Failed to process message');
    }
  }

  /**
   * Handle authentication
   */
  async handleAuth(ws, data) {
    const meta = this.clients.get(ws);
    
    try {
      const decoded = authService.verifyToken(data.token);
      meta.userId = decoded.userId;
      meta.username = decoded.username;
      
      this.send(ws, { 
        type: 'auth-success', 
        user: { 
          userId: decoded.userId, 
          username: decoded.username 
        }
      });

      logger.ws('Client authenticated', { 
        clientId: meta.id, 
        userId: meta.userId 
      });

    } catch (error) {
      this.sendError(ws, 'Invalid token', 'auth-error');
      logger.warn('Authentication failed', { clientId: meta.id });
    }
  }

  /**
   * Handle join project
   */
  async handleJoinProject(ws, data) {
    const meta = this.clients.get(ws);
    const { projectId, discussionId } = data;

    try {
      // Verify membership
      if (meta.userId) {
        const isMember = await projectService.isProjectMember(projectId, meta.userId);
        if (!isMember) {
          this.sendError(ws, 'Not a project member');
          return;
        }
      }

      // Update metadata
      meta.projectId = projectId;
      meta.discussionId = discussionId;

      // Load and send discussion messages
      const messages = await discussionService.getDiscussionMessages(discussionId, 50);
      const formattedMessages = messages.map(m => ({
        _id: m._id,
        user: m.user,
        text: m.text,
        time: m.timestamp,
        isAI: m.isAI
      }));

      this.send(ws, { 
        type: 'discussion-joined', 
        messages: formattedMessages,
        discussionId
      });

      logger.ws('Client joined discussion', { 
        clientId: meta.id, 
        projectId, 
        discussionId 
      });

    } catch (error) {
      logger.error('Error joining project', { 
        clientId: meta.id, 
        error: error.message 
      });
      this.sendError(ws, 'Failed to join discussion');
    }
  }

  /**
   * Handle project chat message
   */
  async handleProjectChat(ws, data) {
    const meta = this.clients.get(ws);
    const { text } = data;
    const { projectId, discussionId, userId, username } = meta;

    if (!projectId || !discussionId) {
      this.sendError(ws, 'Not in a project discussion');
      return;
    }

    try {
      // Save message
      const message = await discussionService.addMessage(
        discussionId,
        projectId,
        userId,
        username,
        text,
        false
      );

      // Broadcast to discussion
      this.broadcastToDiscussion(discussionId, {
        type: 'project-chat',
        message: {
          _id: message._id,
          user: message.user,
          text: message.text,
          time: message.timestamp,
          isAI: false
        }
      });

      logger.ws('Message sent', { 
        clientId: meta.id, 
        discussionId, 
        messageLength: text.length 
      });

      // Semantic search indexing — non-blocking. Worker will backfill failures.
      this._embedMessage(message, projectId, discussionId).catch(err => {
        logger.warn('Message embedding failed (worker will retry)', {
          messageId: message._id, error: err.message
        });
      });

      // Check for AI invocation
      if (text.startsWith('@CollabAI')) {
        const meta = this.clients.get(ws);
        await this.handleAIInvocation(ws, text, projectId, discussionId, meta?.userId);
      }

    } catch (error) {
      logger.error('Error handling chat message', { 
        clientId: meta.id, 
        error: error.message 
      });
      this.sendError(ws, 'Failed to send message');
    }
  }

  /**
   * Handle AI invocation
   */
  async handleAIInvocation(ws, text, projectId, discussionId, userId = null) {
    const prompt = text.replace('@CollabAI', '').trim();
    
    try {
      const project = await projectService.getProjectById(projectId);
      const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;
      
      // Notify clients that AI is starting to stream
      this.broadcastToDiscussion(discussionId, {
        type: 'ai-stream-start'
      });

      // Stream the response — each chunk is broadcast in real-time
      const fullResponse = await AIOrchestrator.handleStreamingRequest(
        {
          projectId,
          discussionId,
          prompt,
          llmConfig: project.activeLLM,
          userId
        },
        (chunk) => {
          // Broadcast each chunk to all clients in the discussion
          this.broadcastToDiscussion(discussionId, {
            type: 'ai-stream-chunk',
            chunk
          });
        }
      );

      // Save the complete AI message to DB
      const aiMessage = await discussionService.addMessage(
        discussionId,
        projectId,
        null,
        'CollabAI',
        fullResponse,
        true
      );

      // Broadcast the final saved message (with _id for memory button)
      this.broadcastToDiscussion(discussionId, {
        type: 'ai-stream-end',
        message: {
          _id: aiMessage._id,
          user: aiMessage.user,
          text: aiMessage.text,
          time: aiMessage.timestamp,
          isAI: true
        }
      });

      logger.ai('Streaming response complete', { 
        projectId, 
        discussionId, 
        promptLength: prompt.length,
        responseLength: fullResponse.length
      });

    } catch (error) {
      logger.error('AI generation error', { 
        projectId, 
        discussionId, 
        error: error.message,
        statusCode: error.statusCode
      });
      
      let errorText = `⚠️ ${error.message}`;
      if (error.statusCode === 429 && error.retryAfter) {
        errorText = `⚠️ Rate limit exceeded. Please try again in ${error.retryAfter} seconds.`;
      }
      
      const errorMessage = await discussionService.addMessage(
        discussionId,
        projectId,
        null,
        'System',
        errorText,
        false
      );

      this.broadcastToDiscussion(discussionId, {
        type: 'project-chat',
        message: {
          user: errorMessage.user,
          text: errorMessage.text,
          time: errorMessage.timestamp,
          isAI: false
        }
      });

      this.broadcastToDiscussion(discussionId, {
        type: 'ai-error',
        message: error.message
      });
    }
  }

  /**
   * Broadcast message to all clients in a discussion
   */
  broadcastToDiscussion(discussionId, payload) {
    let count = 0;
    
    this.clients.forEach((meta, ws) => {
      if (ws.readyState === 1 && meta.discussionId === discussionId) {
        this.send(ws, payload);
        count++;
      }
    });

    logger.debug(`Broadcast to ${count} clients in discussion ${discussionId}`);
  }

  /**
   * Send message to specific client
   */
  send(ws, payload) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Send error to client
   */
  sendError(ws, message, type = 'error') {
    this.send(ws, { type, message });
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(ws) {
    const meta = this.clients.get(ws);
    if (meta) {
      logger.ws('Client disconnected', { 
        clientId: meta.id, 
        userId: meta.userId,
        duration: Date.now() - meta.connectedAt
      });
      this.clients.delete(ws);
      this.messageRateLimits.delete(meta.id);
    }
  }

  /**
   * Heartbeat mechanism to detect dead connections
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((meta, ws) => {
        if (!meta.isAlive) {
          logger.ws('Terminating dead connection', { clientId: meta.id });
          ws.terminate();
          return;
        }

        meta.isAlive = false;
        ws.ping();
      });
    }, config.wsHeartbeatInterval);

    logger.info('Heartbeat mechanism started');
  }

  /**
   * Rate limiting check
   */
  checkRateLimit(clientId) {
    const now = Date.now();
    const limit = this.messageRateLimits.get(clientId);

    if (!limit || now > limit.resetTime) {
      this.messageRateLimits.set(clientId, {
        count: 1,
        resetTime: now + config.rateLimitWindow
      });
      return true;
    }

    if (limit.count >= config.wsRateLimitMaxMessages) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Embed and save message for semantic search
   * Non-blocking, fail-safe
   */
  async _embedMessage(message, projectId, discussionId) {
    try {
      if (!message.text || message.text.length < 20) return;
      if (message.text.startsWith('@CollabAI')) return;
      if (message.isAI) return;

      const [{ default: EmbeddingService }, { default: MessageEmbedding }] = await Promise.all([
        import('../core/embeddings/EmbeddingService.js'),
        import('../models/MessageEmbedding.js')
      ]);

      const embedding = await EmbeddingService.embedText(message.text);
      if (!embedding) return;

      await MessageEmbedding.create({
        projectId,
        discussionId,
        messageId: message._id,
        content: message.text,
        embedding: embedding,
        userId: message.user?._id || message.user,
        username: message.user?.username || 'Unknown',
        timestamp: message.timestamp || Date.now()
      });
    } catch (error) {
      logger.warn('Failed to embed message (non-critical)', {
        messageId: message._id,
        projectId,
        error: error.message
      });
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const stats = {
      totalConnections: this.clients.size,
      authenticated: 0,
      inDiscussions: 0,
      byProject: {}
    };

    this.clients.forEach((meta) => {
      if (meta.userId) stats.authenticated++;
      if (meta.discussionId) stats.inDiscussions++;
      if (meta.projectId) {
        stats.byProject[meta.projectId] = (stats.byProject[meta.projectId] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Shutdown gracefully
   */
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((meta, ws) => {
      this.send(ws, { type: 'server-shutdown', message: 'Server is shutting down' });
      ws.close();
    });

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }
}

export default new ConnectionManager();
