

=== backend\src\config\database.js ===

import mongoose from 'mongoose';
import config from './index.js';
import logger from '../utils/logger.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, config.mongoOptions);

    logger.info(`MongoDB Connected: ${conn.connection.host}`, {
      database: conn.connection.name,
      poolSize: config.mongoOptions.maxPoolSize
    });
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    logger.error('MongoDB connection failed', { error: error.message });
    process.exit(1);
  }
};

export default connectDB;

=== backend\src\config\index.js ===

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


=== backend\src\config\swagger.js ===

import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CollabAI API',
      version: '1.0.0',
      description: 'CollabAI Collaborative Intelligence API'
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:8080',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js'], // your route files
}

export const swaggerSpec = swaggerJsdoc(options)

=== backend\src\core\embeddings\EmbeddingService.js ===

/**
 * Embedding Service - PHASE 2 (Updated for Local Embeddings)
 * Generates text embeddings using local Hugging Face models
 * Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
 * No API key required - runs locally using @xenova/transformers
 */

import { pipeline } from '@xenova/transformers';
import logger from '../../utils/logger.js';

class EmbeddingService {
  constructor() {
    this.model = process.env.HF_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    this.dimensions = 384;
    this.extractor = null;
    this.initPromise = null;
  }

  /**
   * Initialize the embedding pipeline (lazy loading)
   */
  async initialize() {
    if (this.extractor) {
      return this.extractor;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        logger.info('Initializing local embedding model', { model: this.model });
        
        // Create feature extraction pipeline
        this.extractor = await pipeline('feature-extraction', this.model);
        
        logger.info('Embedding model initialized successfully', { 
          model: this.model,
          dimensions: this.dimensions
        });
        
        return this.extractor;
      } catch (error) {
        logger.error('Failed to initialize embedding model', {
          model: this.model,
          error: error.message
        });
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Embed a single text string
   */
  async embedText(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Invalid text input for embedding');
    }

    const startTime = Date.now();

    try {
      // Initialize model if needed
      const extractor = await this.initialize();

      // Generate embedding
      const output = await extractor(text.trim(), { pooling: 'mean', normalize: true });
      
      // Convert to regular array
      const embedding = Array.from(output.data);
      const duration = Date.now() - startTime;

      // Validate embedding
      if (!Array.isArray(embedding) || embedding.length !== this.dimensions) {
        throw new Error(`Invalid embedding dimensions: expected ${this.dimensions}, got ${embedding?.length}`);
      }

      logger.ai('Embedding generated', {
        model: this.model,
        textLength: text.length,
        vectorLength: embedding.length,
        duration: `${duration}ms`
      });

      return embedding;

    } catch (error) {
      logger.error('Embedding generation failed', {
        model: this.model,
        error: error.message,
        textLength: text?.length
      });
      throw error;
    }
  }

  /**
   * Embed multiple text strings in batch
   */
  async embedBatch(textArray) {
    if (!Array.isArray(textArray) || textArray.length === 0) {
      throw new Error('Invalid text array for batch embedding');
    }

    logger.ai('Batch embedding started', {
      model: this.model,
      batchSize: textArray.length
    });

    const startTime = Date.now();
    const embeddings = [];

    try {
      // Initialize model once
      await this.initialize();

      // Process each text
      for (let i = 0; i < textArray.length; i++) {
        const embedding = await this.embedText(textArray[i]);
        embeddings.push(embedding);
      }

      const duration = Date.now() - startTime;

      logger.ai('Batch embedding completed', {
        model: this.model,
        batchSize: textArray.length,
        totalDuration: `${duration}ms`,
        avgDuration: `${Math.round(duration / textArray.length)}ms`
      });

      return embeddings;

    } catch (error) {
      logger.error('Batch embedding failed', {
        model: this.model,
        batchSize: textArray.length,
        processedCount: embeddings.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get embedding dimensions
   */
  getDimensions() {
    return this.dimensions;
  }

  /**
   * Get model name
   */
  getModel() {
    return this.model;
  }
}

export default new EmbeddingService();


=== backend\src\core\orchestrator\AIOrchestrator.js ===

import Groq from 'groq-sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';
import logger from '../../utils/logger.js';
import documentService from '../../services/documentService.js';
import summaryService from '../../services/summaryService.js';
import discussionService from '../../services/discussionService.js';
import projectService from '../../services/projectService.js';
import EmbeddingService from '../embeddings/EmbeddingService.js';
import VectorStore from '../vector/VectorStore.js';
import TokenManager from '../stability/TokenManager.js';
import RateLimiter, { RateLimitError } from '../stability/RateLimiter.js';
import EncryptionService from '../stability/EncryptionService.js';
import LLMGuardrails from '../stability/LLMGuardrails.js';
import Decision from '../../models/Decision.js';
import ProjectState from '../../models/ProjectState.js';

class AIOrchestrator {
  constructor() {
    this.modelConfigs = {
      'groq': { maxTokens: 8192, contextWindow: 8000, supportsStreaming: true },
      'server': { maxTokens: 8192, contextWindow: 8000, supportsStreaming: true },
      'openai': { maxTokens: 4096, contextWindow: 16000, supportsStreaming: true },
      'anthropic': { maxTokens: 4096, contextWindow: 100000, supportsStreaming: true },
      'google': { maxTokens: 8192, contextWindow: 32000, supportsStreaming: true }
    };
  }

  /**
   * Prepare context and messages for a request (shared by streaming and non-streaming)
   */
  async _prepareRequest(params) {
    const { projectId, discussionId, prompt, llmConfig, userId } = params;
    const requestId = randomUUID();

    logger.ai('Orchestrator received request', {
      requestId, projectId, discussionId, provider: llmConfig.provider, model: llmConfig.model, promptLength: prompt.length
    });

    if (userId) {
      RateLimiter.checkLimits(userId, projectId);
    }

    const selectedModel = this.selectModel(llmConfig);
    const isCatchMeUp = /catch me up|what's the current state|what have we decided|summarize the project|onboard me/i.test(prompt);
    const context = await this.buildProjectContext({ projectId, discussionId, prompt });

    let systemPrompt = null;
    if (isCatchMeUp) {
      const contextPrompt = this.buildSystemPrompt(context);
      systemPrompt = contextPrompt + `\n## Your Task\nYou are onboarding a team member. Using ALL the project context above, give a structured summary covering:\n1. **What's being built** — from the project description\n2. **Key decisions made** — from the Verified Ground Truth section above\n3. **Current work & discussions** — from parallel discussions and recent messages\n4. **Unresolved items** — anything still open or debated\n\nBe clear, concise, and professional. Only reference information that appears in the context above.`;
    } else {
      systemPrompt = this.buildSystemPrompt(context);
    }

    let messages = this.constructMessages(context, prompt, systemPrompt, isCatchMeUp);
    const { messages: trimmedMessages } = TokenManager.trimContext(context, messages, selectedModel.model, requestId);
    messages = trimmedMessages;

    return { requestId, selectedModel, context, messages, systemPrompt };
  }

  async handleRequest(params) {
    const { projectId, userId } = params;
    try {
      const { requestId, selectedModel, context, messages } = await this._prepareRequest(params);

      const response = await this.callProvider({
        requestId,
        provider: selectedModel.provider,
        model: selectedModel.model,
        context,
        prompt: params.prompt,
        systemPrompt: null,
        messagesOverride: messages,
        projectId,
        userId,
        maxTokens: 1024
      });

      logger.ai('Response generated', { requestId, provider: selectedModel.provider, responseLength: response.length });
      return response;

    } catch (error) {
      if (!(error instanceof RateLimitError)) {
        logger.error('Orchestrator error', { projectId, error: error.message, stack: error.stack });
      }
      throw error;
    }
  }

  /**
   * Streaming request — calls onChunk(text) for each token chunk
   * Returns the full accumulated response text
   */
  async handleStreamingRequest(params, onChunk) {
    const { projectId, userId } = params;
    try {
      const { requestId, selectedModel, messages } = await this._prepareRequest(params);
      const apiKey = await this.getApiKey(selectedModel.provider, projectId);

      // Streaming is only supported for Groq/server for now
      const provider = selectedModel.provider;
      if (provider === 'groq' || provider === 'server') {
        const fullText = await this.callGroqStreaming({
          model: selectedModel.model, messages, maxTokens: 1024, apiKey
        }, onChunk);
        logger.ai('Streaming response complete', { requestId, provider, responseLength: fullText.length });
        return fullText;
      }

      // Fallback: non-streaming for other providers
      const response = await this.callProvider({
        requestId, provider, model: selectedModel.model, context: null,
        prompt: params.prompt, messagesOverride: messages, projectId, userId, maxTokens: 1024
      });
      onChunk(response); // send as single chunk
      return response;

    } catch (error) {
      if (!(error instanceof RateLimitError)) {
        logger.error('Streaming orchestrator error', { projectId, error: error.message });
      }
      throw error;
    }
  }

  selectModel(llmConfig) {
    if (!llmConfig || !llmConfig.provider) return { provider: 'groq', model: 'llama-3.1-8b-instant' };
    
    // The 'server' model from the frontend needs to be mapped to an actual Groq model
    if (llmConfig.provider === 'server' && llmConfig.model === 'server') {
      return { provider: 'server', model: 'llama-3.1-8b-instant' };
    }
    
    return llmConfig;
  }

  async buildProjectContext({ projectId, discussionId, prompt }) {
    const [
      project,
      discussion,
      allDiscussions,
      summaries,
      recentMessages
    ] = await Promise.all([
      projectService.getProjectById(projectId),
      discussionService.getDiscussionById(discussionId),
      discussionService.getProjectDiscussions(projectId),
      summaryService.getDiscussionSummaries(discussionId, 3),
      discussionService.getDiscussionMessages(discussionId, 30)
    ]);

    let pastMessages = [];
    let documents = [];
    let relevantDecisions = [];

    if (prompt) {
      try {
        const queryEmbedding = await EmbeddingService.embedText(prompt);
        pastMessages = await VectorStore.searchMessages(projectId, queryEmbedding, 15);
        
        // Semantic decision retrieval — replaces pinnedContext monolith
        relevantDecisions = await VectorStore.searchDecisions(projectId, queryEmbedding, 8);

        const chunkCount = await VectorStore.count(projectId);
        if (chunkCount > 0) {
          const docChunks = await VectorStore.search(projectId, queryEmbedding, 5);
          documents = docChunks.map(c => ({
            title: c.metadata?.title || c.metadata?.documentTitle,
            content: c.content,
            similarity: c.similarity
          }));
        } else {
           const docs = await documentService.getProjectDocuments(projectId);
           documents = docs.slice(0, 3).map(d => ({
             title: d.title,
             content: d.content.substring(0, 2000)
           }));
        }
      } catch (err) {
        logger.warn('Semantic search failed in context builder', { error: err.message });
      }
    }

    // Fallback: if no semantic results, load all decisions (for projects with unembedded decisions)
    if (relevantDecisions.length === 0) {
      try {
        const Decision = (await import('../../models/Decision.js')).default;
        const allDecisions = await Decision.find({ projectId }).sort({ timestamp: -1 }).limit(15).lean();
        relevantDecisions = allDecisions.map(d => ({
          text: d.text,
          rationale: d.rationale,
          proposedBy: d.proposedBy,
          timestamp: d.timestamp,
          similarity: null // no ranking
        }));
      } catch (err) {
        logger.warn('Fallback decision load failed', { error: err.message });
      }
    }

    const otherDiscussions = [];
    for (const disc of allDiscussions) {
      if (disc._id.toString() === discussionId.toString()) continue;
      const discSummaries = await summaryService.getDiscussionSummaries(disc._id, 1);
      if (discSummaries.length > 0) {
        otherDiscussions.push({ title: disc.title, summary: discSummaries[0].content });
      }
    }

    return {
      project: project ? {
        title: project.title,
        description: project.problemStatement,
      } : null,
      discussion: discussion ? {
        title: discussion.title,
        isMain: discussion.isMain
      } : null,
      decisions: relevantDecisions,
      otherDiscussions,
      recentMessages: recentMessages.map(m => ({ user: m.user, text: m.text, timestamp: m.timestamp })),
      pastMessages,
      documents,
      summaries: summaries.map(s => s.content)
    };
  }

  buildSystemPrompt(context) {
    let prompt = `You are CollabAI, a helpful AI assistant for team collaboration.
Be conversational, concise, and natural. Use the project context below to give accurate, relevant responses.\n\n`;

    if (context.project) {
      prompt += `Project: ${context.project.title}\n`;
      if (context.project.description) prompt += `${context.project.description}\n\n`;
    }

    if (context.discussion) {
      prompt += `Current Discussion: ${context.discussion.title}${context.discussion.isMain ? ' (main thread)' : ''}\n\n`;
    }

    // LAYER 1: Relevant Decisions — semantically retrieved, not a monolith
    if (context.decisions?.length > 0) {
      prompt += `## Verified Ground Truth — Project Decisions\nThese are human-verified decisions captured by team members. Treat as authoritative facts.\n`;
      context.decisions.forEach((d, i) => {
        const date = d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '';
        const who = d.proposedBy?.username || 'team';
        prompt += `${i+1}. ${d.text}`;
        if (d.rationale) prompt += ` (rationale: ${d.rationale})`;
        prompt += ` — ${who}, ${date}\n`;
      });
      prompt += `\n`;
    }

    // LAYER 2: Parallel Discussion Summaries
    if (context.otherDiscussions?.length > 0) {
      prompt += `## Parallel Discussions\n`;
      context.otherDiscussions.forEach(disc => {
        prompt += `\n[${disc.title}]\n${disc.summary}\n`;
      });
      prompt += `\n`;
    }

    // LAYER 4: Semantic Past Messages
    if (context.pastMessages?.length > 0) {
      prompt += `## Semantically Relevant Past Messages\n`;
      context.pastMessages.forEach(m => {
        prompt += `[${new Date(m.timestamp).toLocaleString()}] ${m.user}: ${m.text}\n`;
      });
      prompt += `\n`;
    }

    // LAYER 5: Semantic Documents
    if (context.documents?.length > 0) {
      prompt += `## Relevant Documents\n`;
      context.documents.forEach(doc => {
        prompt += `\n${doc.title}:\n${doc.content}\n`;
      });
      prompt += `\n`;
    }

    return prompt;
  }

  constructMessages(context, prompt, systemPrompt, isCatchMeUp = false) {
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add conversation history if not in catch-me-up mode
    if (!isCatchMeUp && context && context.recentMessages) {
      context.recentMessages.forEach(m => {
        if (m.user === 'System') return;
        if (m.user === 'CollabAI') {
          messages.push({ role: 'assistant', content: m.text });
        } else {
          messages.push({ role: 'user', content: `${m.user}: ${m.text}` });
        }
      });
    }

    messages.push({ role: 'user', content: prompt });
    return messages;
  }

  async callProvider(params) {
    let { 
      requestId, provider, model, context, prompt, 
      messagesOverride, systemPrompt = null,
      temperature = 0.7, maxTokens = null, projectId 
    } = params;

    if (provider === 'server' && model === 'server') {
      model = 'llama-3.1-8b-instant';
    }

    const providerMaxTokens = { groq: 1024, server: 8192, openai: 4096, anthropic: 8192, google: 8192 };
    const resolvedMaxTokens = maxTokens ?? (providerMaxTokens[provider] || 1024);

    let messages = messagesOverride || this.constructMessages(context, prompt, systemPrompt);
    const { messages: trimmedMessages } = TokenManager.trimContext(context, messages, model, requestId);
    messages = trimmedMessages;

    const result = await LLMGuardrails.guardedCall(
      { requestId, provider, model, messages, projectId },
      async () => {
        const apiKey = await this.getApiKey(provider, projectId);
        switch (provider) {
          case 'groq':
          case 'server':
            return await this.callGroq({ model, messages, temperature, maxTokens: resolvedMaxTokens, apiKey });
          case 'openai':
            return await this.callOpenAI({ model, messages, temperature, maxTokens: resolvedMaxTokens, apiKey });
          case 'anthropic':
            return await this.callAnthropic({ model, messages, temperature, maxTokens: resolvedMaxTokens, apiKey });
          case 'google':
            return await this.callGoogle({ model, messages, temperature, maxTokens: resolvedMaxTokens, apiKey });
          default:
      throw new Error(`Unsupported provider: ${provider}`);
        }
      }
    );

    return result.content || result;
  }

  async getApiKey(provider, projectId) {
    if (provider === 'groq' || provider === 'server') {
      const encryptedKey = process.env.GROQ_API_KEY || process.env.CHATBOT_API_KEY;
      return EncryptionService.decryptForUse(encryptedKey);
    }
    const project = await projectService.getProjectById(projectId);
    const key = project.apiKeys?.[provider];
    if (!key) throw new Error(`No API key configured for provider: ${provider}`);
    return EncryptionService.decryptForUse(key);
  }

  async callGroq({ model, messages, temperature, maxTokens, apiKey }) {
    const client = new Groq({ apiKey });
    const completion = await client.chat.completions.create({ model, messages, temperature, max_tokens: maxTokens });
    return { content: completion.choices[0]?.message?.content || 'No response generated.', usage: completion.usage || null };
  }

  /**
   * Streaming Groq call — yields chunks via onChunk callback
   */
  async callGroqStreaming({ model, messages, maxTokens, apiKey }, onChunk) {
    const client = new Groq({ apiKey });
    const stream = await client.chat.completions.create({
      model, messages, max_tokens: maxTokens, temperature: 0.7, stream: true
    });
    let fullText = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }
    return fullText || 'No response generated.';
  }

  async callOpenAI({ model, messages, temperature, maxTokens, apiKey }) {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({ model, messages, temperature, max_tokens: maxTokens });
    return { content: completion.choices[0]?.message?.content || 'No response generated.', usage: completion.usage || null };
  }

  async callAnthropic({ model, messages, temperature, maxTokens, apiKey }) {
    const client = new Anthropic({ apiKey });
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    const response = await client.messages.create({
      model, max_tokens: maxTokens, temperature,
      system: systemMsg?.content || '',
      messages: chatMessages
    });
    return { content: response.content[0]?.text || 'No response generated.', usage: response.usage || null };
  }

  async callGoogle({ model, messages, temperature, maxTokens, apiKey }) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model, generationConfig: { temperature, maxOutputTokens: maxTokens }
    });
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    const lastMsg = chatMessages[chatMessages.length - 1];
    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }]
    }));
    let userPrompt = lastMsg?.content || '';
    if (systemMsg?.content && history.length === 0) {
      userPrompt = `${systemMsg.content}\n\n${userPrompt}`;
    }
    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessage(userPrompt);
    return { content: result.response.text() || 'No response generated.', usage: null };
  }

  async handleSummaryRequest(params) {
    const { projectId, discussionId, llmConfig, customPrompt } = params;
    const selectedModel = this.selectModel(llmConfig);
    const messages = await discussionService.getDiscussionMessages(discussionId, 50);

    if (messages.length === 0) return 'No messages to summarize yet.';

    const conversationText = messages.map(m => `${m.user}: ${m.text}`).join('\n');
    let basePrompt = `Summarize this team discussion...\n\nDiscussion:\n${conversationText}`;
    if (customPrompt) basePrompt += `\n\nAdditional instructions: ${customPrompt}`;

    return await this.callProvider({
      requestId: randomUUID(), provider: selectedModel.provider, model: selectedModel.model,
      context: null, prompt: basePrompt, projectId, systemPrompt: 'You summarize team discussions.',
      temperature: 0.5, maxTokens: 512
    });
  }

  async handleSummaryRefinement(params) {
    const { projectId, discussionId, existingSummary, customPrompt, llmConfig } = params;
    const selectedModel = this.selectModel(llmConfig);
    const messages = await discussionService.getDiscussionMessages(discussionId, 50);
    const conversationText = messages.map(m => `${m.user}: ${m.text}`).join('\n');

    const prompt = `Discussion:\n${conversationText}\n\nCurrent summary:\n${existingSummary}\n\nUser request: ${customPrompt}\n\nUpdate summary:`;

    return await this.callProvider({
      requestId: randomUUID(), provider: selectedModel.provider, model: selectedModel.model,
      context: null, prompt, projectId, systemPrompt: 'You refine summaries.', temperature: 0.5, maxTokens: 512
    });
  }
}

export default new AIOrchestrator();


=== backend\src\core\stability\EncryptionService.js ===

/**
 * EncryptionService - PHASE 4 (AUDITED & CORRECTED)
 * AES-256-GCM encryption for API keys at rest
 * Authenticated encryption with proper key validation
 */

import crypto from 'crypto';
import logger from '../../utils/logger.js';

class EncryptionService {
  constructor() {
    // Load and validate encryption key from environment
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    
    if (!this.encryptionKey) {
      logger.error('ENCRYPTION_KEY not set in environment - FAILING FAST');
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Validate key format and length
    if (!/^[0-9a-f]{64}$/i.test(this.encryptionKey)) {
      logger.error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
      throw new Error('Invalid ENCRYPTION_KEY format');
    }

    // Ensure key is 32 bytes for AES-256
    this.keyBuffer = Buffer.from(this.encryptionKey, 'hex');
    
    if (this.keyBuffer.length !== 32) {
      logger.error('ENCRYPTION_KEY must be exactly 32 bytes');
      throw new Error('Invalid ENCRYPTION_KEY length');
    }
    
    this.algorithm = 'aes-256-gcm'; // Authenticated encryption
    this.ivLength = 12; // GCM recommended IV length
    this.authTagLength = 16; // GCM auth tag length
    
    logger.info('EncryptionService initialized with AES-256-GCM');
  }

  /**
   * Encrypt a string (API key) using AES-256-GCM
   */
  encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Invalid plaintext for encryption');
    }

    let iv, encrypted, authTag;
    
    try {
      // Generate random IV for each encryption
      iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.keyBuffer, iv);
      
      // Encrypt
      encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      authTag = cipher.getAuthTag();
      
      // Return IV:AuthTag:EncryptedData (all hex-encoded)
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
    } finally {
      // Secure zeroing of sensitive buffers
      if (iv) iv.fill(0);
      if (encrypted) encrypted.fill(0);
      if (authTag) authTag.fill(0);
    }
  }

  /**
   * Decrypt a string (API key) using AES-256-GCM
   */
  decrypt(ciphertext) {
    if (!ciphertext || typeof ciphertext !== 'string') {
      throw new Error('Invalid ciphertext for decryption');
    }

    let iv, authTag, encrypted, decrypted;
    
    try {
      // Split IV:AuthTag:EncryptedData
      const parts = ciphertext.split(':');
      
      // Check format (GCM has 3 parts, CBC has 2)
      if (parts.length === 3) {
        // New GCM format
        iv = Buffer.from(parts[0], 'hex');
        authTag = Buffer.from(parts[1], 'hex');
        encrypted = Buffer.from(parts[2], 'hex');
        
        // Create decipher
        const decipher = crypto.createDecipheriv(this.algorithm, this.keyBuffer, iv);
        decipher.setAuthTag(authTag);
        
        // Decrypt
        decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final()
        ]);
        
        return decrypted.toString('utf8');
      } else if (parts.length === 2) {
        // Legacy CBC format - backward compatibility
        logger.warn('Decrypting legacy CBC format - should be migrated to GCM');
        iv = Buffer.from(parts[0], 'hex');
        encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.keyBuffer, iv);
        let result = decipher.update(encrypted, 'hex', 'utf8');
        result += decipher.final('utf8');
        
        return result;
      } else {
        throw new Error('Invalid ciphertext format');
      }
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Decryption failed');
    } finally {
      // Secure zeroing of sensitive buffers
      if (iv) iv.fill(0);
      if (authTag) authTag.fill(0);
      if (encrypted && Buffer.isBuffer(encrypted)) encrypted.fill(0);
      if (decrypted) decrypted.fill(0);
    }
  }

  /**
   * Check if a string is encrypted (has IV:AuthTag:Data or IV:Data format)
   */
  isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    
    // Encrypted format: hex_iv:hex_authtag:hex_data (GCM) or hex_iv:hex_data (CBC)
    const parts = value.split(':');
    if (parts.length !== 2 && parts.length !== 3) return false;
    
    // Check if all parts are valid hex
    const hexRegex = /^[0-9a-f]+$/i;
    return parts.every(part => hexRegex.test(part)) && 
           (parts[0].length === 24 || parts[0].length === 32); // GCM IV=12 bytes or CBC IV=16 bytes
  }

  /**
   * Encrypt API key if not already encrypted (migration-safe)
   */
  encryptIfNeeded(apiKey) {
    if (!apiKey) return null;
    
    if (this.isEncrypted(apiKey)) {
      return apiKey; // Already encrypted
    }
    
    // Encrypt plaintext key
    logger.info('Encrypting plaintext API key with AES-256-GCM');
    return this.encrypt(apiKey);
  }

  /**
   * Decrypt API key for runtime use
   * Never log decrypted keys
   */
  decryptForUse(encryptedKey) {
    if (!encryptedKey) return null;
    
    if (!this.isEncrypted(encryptedKey)) {
      // Backward compatibility: if not encrypted, return as-is
      logger.warn('API key not encrypted, returning plaintext (SECURITY RISK - should be migrated)');
      return encryptedKey;
    }
    
    return this.decrypt(encryptedKey);
  }

  /**
   * Securely compare two strings (constant-time to prevent timing attacks)
   */
  secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
}

export default new EncryptionService();


=== backend\src\core\stability\LLMGuardrails.js ===

/**
 * LLMGuardrails - PHASE 4
 * Validation and safety layer for all LLM calls
 * Prevents invalid requests and handles errors gracefully
 */

import logger from '../../utils/logger.js';
import TokenManager from './TokenManager.js';

class LLMGuardrails {
  constructor() {
    this.supportedProviders = ['groq', 'openai', 'anthropic', 'google', 'server'];
    this.supportedModels = {
      'groq': [
        'llama-3.1-8b-instant',
        'llama-3.1-70b-versatile',
        'llama-3.3-70b-versatile',
        'llama-3.1-405b-reasoning',
        'mixtral-8x7b-32768',
        'gemma-7b-it',
        'gemma2-9b-it'
      ],
      'server': [
        'llama-3.1-8b-instant',
        'llama-3.1-70b-versatile',
        'llama-3.3-70b-versatile'
      ],
      'openai': [
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'gpt-4o',
        'gpt-4o-mini',
        'o3',
        'o4-mini'
      ],
      'anthropic': [
        'claude-opus-4-6',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001'
      ],
      'google': [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite'
      ]
    };

    this.maxTimeoutMs = 90000; // 90 seconds — Gemini 2.5 Pro / Claude Opus can take 45-60s
    this.retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
  }

  /**
   * Validate LLM request before calling provider
   */
  async validateRequest(params) {
    const { provider, model, messages, projectId, requestId } = params;
    const errors = [];

    // 1. Validate provider
    if (!provider || !this.supportedProviders.includes(provider)) {
      errors.push(`Unsupported provider: ${provider}`);
    }

    // 2. Validate model
    if (!model) {
      errors.push('Model not specified');
    } else if (provider && this.supportedModels[provider]) {
      if (!this.supportedModels[provider].includes(model)) {
        errors.push(`Model ${model} not supported for provider ${provider}`);
      }
    }

    // 3. Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      errors.push('Messages array is empty or invalid');
    } else {
      // Check for empty content
      const hasContent = messages.some(m => m.content && m.content.trim().length > 0);
      if (!hasContent) {
        errors.push('All messages have empty content');
      }
    }

    // 4. Validate token count
    const validation = TokenManager.validateContextSize(messages, model);
    if (!validation.valid) {
      errors.push(`Token count (${validation.tokenCount}) exceeds model limit (${validation.limit})`);
    }

    if (errors.length > 0) {
      logger.error('LLM request validation failed', {
        requestId,
        projectId,
        provider,
        model,
        errors
      });

      return {
        valid: false,
        errors
      };
    }

    logger.debug('LLM request validated', {
      requestId,
      provider,
      model,
      tokenCount: validation.tokenCount
    });

    return {
      valid: true,
      tokenCount: validation.tokenCount
    };
  }

  /**
   * Execute LLM call with timeout protection using AbortController
   * Properly cancels the request to prevent double billing
   */
  async executeWithTimeout(callFn, timeoutMs = this.maxTimeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await callFn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('LLM call timeout');
      }
      throw error;
    }
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    if (!error) return false;
    
    const errorCode = error.code || error.message;
    return this.retryableErrors.some(code => 
      errorCode && errorCode.includes(code)
    );
  }

  /**
   * Categorize error for proper handling
   */
  categorizeError(error) {
    if (!error) {
      return { category: 'unknown', retryable: false };
    }

    const message = error.message || '';
    const code = error.code || '';

    // Timeout errors
    if (message.includes('timeout') || code === 'ETIMEDOUT') {
      return { category: 'timeout', retryable: true };
    }

    // Network errors
    if (code === 'ECONNRESET' || code === 'ENOTFOUND' || message.includes('network')) {
      return { category: 'network', retryable: true };
    }

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429')) {
      return { category: 'rate_limit', retryable: true };
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('401') || message.includes('403')) {
      return { category: 'auth', retryable: false };
    }

    // Invalid request errors
    if (message.includes('invalid') || message.includes('400')) {
      return { category: 'invalid_request', retryable: false };
    }

    // Model errors
    if (message.includes('model') || message.includes('404')) {
      return { category: 'model_error', retryable: false };
    }

    return { category: 'unknown', retryable: false };
  }

  /**
   * Execute LLM call with retry logic (single retry for transient errors)
   */
  async executeWithRetry(callFn, requestId) {
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await this.executeWithTimeout(callFn);
        
        if (attempt > 1) {
          logger.info('LLM call succeeded after retry', { requestId, attempt });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        const errorInfo = this.categorizeError(error);

        logger.warn('LLM call failed', {
          requestId,
          attempt,
          category: errorInfo.category,
          retryable: errorInfo.retryable,
          error: error.message
        });

        // Only retry if error is retryable and this is first attempt
        if (attempt === 1 && errorInfo.retryable) {
          const delayMs = errorInfo.category === 'rate_limit' ? 3000 : 1000;
          logger.info('Retrying LLM call', { requestId, delayMs });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Don't retry
        break;
      }
    }

    // All attempts failed
    throw lastError;
  }

  /**
   * Wrap LLM call with full guardrails
   */
  async guardedCall(params, callFn) {
    const { requestId, projectId, provider, model } = params;
    const startTime = Date.now();

    try {
      // 1. Validate request
      const validation = await this.validateRequest(params);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // 2. Execute with timeout and retry
      const result = await this.executeWithRetry(callFn, requestId);

      const duration = Date.now() - startTime;

      // Extract usage if available
      const usage = result?.usage || null;
      const logData = {
        requestId,
        projectId,
        provider,
        model,
        inputTokens: validation.tokenCount,
        durationMs: duration
      };

      // Add output tokens if available
      if (usage) {
        logData.outputTokens = usage.completion_tokens || usage.output_tokens;
        logData.totalTokens = usage.total_tokens;
      }

      logger.info('LLM call completed', logData);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo = this.categorizeError(error);

      logger.error('LLM call failed permanently', {
        requestId,
        projectId,
        provider,
        model,
        category: errorInfo.category,
        durationMs: duration,
        error: error.message
      });

      throw error;
    }
  }
}

export default new LLMGuardrails();


=== backend\src\core\stability\RateLimiter.js ===

/**
 * RateLimiter - PHASE 4 (AUDITED & CORRECTED)
 * Per-user and per-project rate limiting
 * Prevents abuse and ensures fair resource usage
 */

import logger from '../../utils/logger.js';

/**
 * Custom error class for rate limit exceeded
 */
export class RateLimitError extends Error {
  constructor(message, retryAfter, reason) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.retryAfter = retryAfter;
    this.reason = reason;
  }
}

class RateLimiter {
  constructor() {
    // In-memory storage (acceptable for Phase 4)
    this.userLimits = new Map(); // userId -> { count, resetTime }
    this.projectLimits = new Map(); // projectId -> { count, resetTime }
    
    // Configurable thresholds (from env or defaults)
    this.config = {
      userRequestsPerMinute: parseInt(process.env.RATE_LIMIT_USER_PER_MIN) || 20,
      projectRequestsPerMinute: parseInt(process.env.RATE_LIMIT_PROJECT_PER_MIN) || 50,
      windowMs: 60000 // 1 minute
    };

    // Cleanup old entries every 5 minutes (unref to allow process exit)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref(); // Don't prevent process from exiting
  }

  /**
   * Check if user is rate limited
   */
  checkUserLimit(userId) {
    const now = Date.now();
    const userKey = userId.toString();
    
    if (!this.userLimits.has(userKey)) {
      this.userLimits.set(userKey, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return { allowed: true, remaining: this.config.userRequestsPerMinute - 1 };
    }

    const limit = this.userLimits.get(userKey);
    
    // Reset if window expired
    if (now >= limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + this.config.windowMs;
      return { allowed: true, remaining: this.config.userRequestsPerMinute - 1 };
    }

    // Check if limit exceeded
    if (limit.count >= this.config.userRequestsPerMinute) {
      const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
      
      logger.warn('User rate limit exceeded', {
        userId,
        count: limit.count,
        limit: this.config.userRequestsPerMinute,
        retryAfter
      });

      return {
        allowed: false,
        retryAfter,
        remaining: 0
      };
    }

    // Increment count
    limit.count++;
    return {
      allowed: true,
      remaining: this.config.userRequestsPerMinute - limit.count
    };
  }

  /**
   * Check if project is rate limited
   */
  checkProjectLimit(projectId) {
    const now = Date.now();
    const projectKey = projectId.toString();
    
    if (!this.projectLimits.has(projectKey)) {
      this.projectLimits.set(projectKey, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return { allowed: true, remaining: this.config.projectRequestsPerMinute - 1 };
    }

    const limit = this.projectLimits.get(projectKey);
    
    // Reset if window expired
    if (now >= limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + this.config.windowMs;
      return { allowed: true, remaining: this.config.projectRequestsPerMinute - 1 };
    }

    // Check if limit exceeded
    if (limit.count >= this.config.projectRequestsPerMinute) {
      const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
      
      logger.warn('Project rate limit exceeded', {
        projectId,
        count: limit.count,
        limit: this.config.projectRequestsPerMinute,
        retryAfter
      });

      return {
        allowed: false,
        retryAfter,
        remaining: 0
      };
    }

    // Increment count
    limit.count++;
    return {
      allowed: true,
      remaining: this.config.projectRequestsPerMinute - limit.count
    };
  }

  /**
   * Check both user and project limits
   * Throws RateLimitError if exceeded
   */
  checkLimits(userId, projectId) {
    const userCheck = this.checkUserLimit(userId);
    if (!userCheck.allowed) {
      throw new RateLimitError(
        'User rate limit exceeded',
        userCheck.retryAfter,
        'user'
      );
    }

    const projectCheck = this.checkProjectLimit(projectId);
    if (!projectCheck.allowed) {
      throw new RateLimitError(
        'Project rate limit exceeded',
        projectCheck.retryAfter,
        'project'
      );
    }

    return {
      allowed: true,
      userRemaining: userCheck.remaining,
      projectRemaining: projectCheck.remaining
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    // Cleanup user limits
    for (const [key, limit] of this.userLimits.entries()) {
      if (now >= limit.resetTime + this.config.windowMs) {
        this.userLimits.delete(key);
        cleaned++;
      }
    }

    // Cleanup project limits
    for (const [key, limit] of this.projectLimits.entries()) {
      if (now >= limit.resetTime + this.config.windowMs) {
        this.projectLimits.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limiter cleanup', { entriesRemoved: cleaned });
    }
  }

  /**
   * Get current stats (for monitoring)
   */
  getStats() {
    return {
      userLimitsActive: this.userLimits.size,
      projectLimitsActive: this.projectLimits.size,
      config: this.config
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export default new RateLimiter();


=== backend\src\core\stability\TokenManager.js ===

/**
 * TokenManager - PHASE 4 (AUDITED & CORRECTED)
 * Token counting with safety margins
 * Uses conservative estimation with 90% context window cap
 */

import logger from '../../utils/logger.js';

class TokenManager {
  constructor() {
    // Model-specific token limits with 90% safety margin
    this.modelLimits = {
      'llama-3.1-8b-instant': { contextWindow: 7200, maxOutput: 8192 }, // 90% of 8000
      'llama-3.1-70b-versatile': { contextWindow: 7200, maxOutput: 8192 },
      'llama-3.1-405b-reasoning': { contextWindow: 7200, maxOutput: 8192 },
      'mixtral-8x7b-32768': { contextWindow: 28800, maxOutput: 32768 }, // 90% of 32000
      'gemma-7b-it': { contextWindow: 7200, maxOutput: 8192 },
      'gpt-4': { contextWindow: 7200, maxOutput: 4096 },
      'gpt-3.5-turbo': { contextWindow: 14400, maxOutput: 4096 }, // 90% of 16000
      'claude-3-opus': { contextWindow: 90000, maxOutput: 4096 }, // 90% of 100000
      'claude-3-sonnet': { contextWindow: 90000, maxOutput: 4096 }
    };
  }

  /**
   * Count tokens using conservative estimation
   * Over-estimates to prevent context overflow
   * NOTE: Not using real tokenizer - using safe approximation
   */
  countTokens(text) {
    if (!text || typeof text !== 'string') return 0;

    // Conservative estimation: 1 token per 3.5 chars (over-estimates vs 4 chars)
    // This provides safety margin against real tokenizer differences
    const words = text.split(/\s+/);
    let tokenCount = 0;

    for (const word of words) {
      if (word.length === 0) continue;
      
      // Punctuation counts as separate tokens
      const punctuationCount = (word.match(/[.,!?;:()[\]{}'"]/g) || []).length;
      
      // Word tokens (conservative: 1 token per 3.5 chars)
      const cleanWord = word.replace(/[.,!?;:()[\]{}'"]/g, '');
      if (cleanWord.length > 0) {
        tokenCount += Math.ceil(cleanWord.length / 3.5);
      }
      
      tokenCount += punctuationCount;
    }

    // Add 10% safety buffer
    return Math.ceil(tokenCount * 1.1);
  }

  /**
   * Count tokens in messages array
   */
  countMessagesTokens(messages) {
    if (!Array.isArray(messages)) return 0;
    
    let total = 0;
    for (const msg of messages) {
      // Role tokens
      total += 2; // role field (conservative)
      
      // Content tokens
      if (msg.content) {
        total += this.countTokens(msg.content);
      }
      
      // Message overhead (formatting)
      total += 5; // per message overhead (conservative)
    }
    
    return total;
  }

  /**
   * Get model limits (with 90% safety margin already applied)
   */
  getModelLimits(model) {
    return this.modelLimits[model] || { contextWindow: 7200, maxOutput: 4096 };
  }

  /**
   * Validate if context fits within model limits
   */
  validateContextSize(messages, model) {
    const limits = this.getModelLimits(model);
    const tokenCount = this.countMessagesTokens(messages);
    
    return {
      valid: tokenCount <= limits.contextWindow,
      tokenCount,
      limit: limits.contextWindow,
      overflow: Math.max(0, tokenCount - limits.contextWindow)
    };
  }

  /**
   * Trim context to fit within model limits
   * MUST be called BEFORE final message construction
   * Deterministic trimming order with post-trim revalidation
   */
  trimContext(context, messages, model, requestId) {
    const limits = this.getModelLimits(model);
    let currentTokens = this.countMessagesTokens(messages);
    
    if (currentTokens <= limits.contextWindow) {
      return { messages, trimmed: false };
    }

    logger.warn('Context exceeds token limit, trimming required', {
      requestId,
      model,
      currentTokens,
      limit: limits.contextWindow,
      overflow: currentTokens - limits.contextWindow
    });

    const trimmedMessages = [...messages];
    const systemPromptIndex = trimmedMessages.findIndex(m => m.role === 'system');
    
    // Preserve system prompt (always first)
    const systemPrompt = systemPromptIndex >= 0 ? trimmedMessages[systemPromptIndex] : null;
    const userMessages = trimmedMessages.filter((m, i) => i !== systemPromptIndex);
    
    // Trim oldest user/assistant messages first
    while (currentTokens > limits.contextWindow && userMessages.length > 2) {
      // Keep at least the last user message
      const removed = userMessages.shift();
      currentTokens = this.countMessagesTokens(
        systemPrompt ? [systemPrompt, ...userMessages] : userMessages
      );
      
      logger.debug('Trimmed message', {
        requestId,
        role: removed.role,
        contentLength: removed.content?.length,
        tokensAfter: currentTokens
      });
    }

    const finalMessages = systemPrompt ? [systemPrompt, ...userMessages] : userMessages;
    
    // POST-TRIM REVALIDATION
    const finalValidation = this.validateContextSize(finalMessages, model);
    if (!finalValidation.valid) {
      logger.error('Post-trim validation failed - context still too large', {
        requestId,
        model,
        tokensAfter: finalValidation.tokenCount,
        limit: limits.contextWindow
      });
      throw new Error('Unable to trim context to fit model limits');
    }
    
    logger.info('Context trimmed successfully', {
      requestId,
      model,
      tokensBefore: this.countMessagesTokens(messages),
      tokensAfter: currentTokens,
      messagesRemoved: messages.length - finalMessages.length
    });

    return {
      messages: finalMessages,
      trimmed: true,
      tokensBefore: this.countMessagesTokens(messages),
      tokensAfter: currentTokens
    };
  }

  /**
   * Estimate total request tokens (input + expected output)
   */
  estimateRequestTokens(messages, model, maxOutputTokens = 1024) {
    const inputTokens = this.countMessagesTokens(messages);
    return {
      inputTokens,
      estimatedOutputTokens: maxOutputTokens,
      totalEstimated: inputTokens + maxOutputTokens
    };
  }
}

export default new TokenManager();


=== backend\src\core\vector\VectorStore.js ===

/**
 * Vector Store - PHASE 2 ACTIVATED
 * Performs semantic search using embeddings stored in MongoDB
 */

import DocumentChunk from '../../models/DocumentChunk.js';
import MessageEmbedding from '../../models/MessageEmbedding.js';
import Decision from '../../models/Decision.js';
import logger from '../../utils/logger.js';

class VectorStore {
  constructor() {
    this.dimension = 384; // all-MiniLM-L6-v2 dimensions
  }

  /**
   * Search for semantically similar document chunks
   */
  async search(projectId, queryEmbedding, topK = 5) {
    const startTime = Date.now();

    try {
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimension) {
        throw new Error(`Invalid query embedding dimension. Expected ${this.dimension}, got ${queryEmbedding?.length}`);
      }

      // Fetch all chunks for the project
      const chunks = await DocumentChunk.find({ projectId }).lean();

      if (chunks.length === 0) {
        logger.debug('No document chunks found for project', { projectId });
        return [];
      }

      logger.debug('Computing similarities', {
        projectId,
        chunkCount: chunks.length,
        topK
      });

      // Compute cosine similarity for each chunk
      const results = chunks.map(chunk => {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          id: chunk._id,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          similarity,
          metadata: chunk.metadata
        };
      });

      // Sort by similarity (descending) and return top K
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);

      const duration = Date.now() - startTime;

      logger.ai('Vector search completed', {
        projectId,
        totalChunks: chunks.length,
        topK,
        resultsFound: topResults.length,
        topSimilarity: topResults[0]?.similarity.toFixed(4),
        duration: `${duration}ms`
      });

      return topResults;

    } catch (error) {
      logger.error('Vector search failed', {
        projectId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search for semantically similar messages
   */
  async searchMessages(projectId, queryEmbedding, topK = 5) {
    const startTime = Date.now();

    try {
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimension) {
        throw new Error(`Invalid query embedding dimension. Expected ${this.dimension}, got ${queryEmbedding?.length}`);
      }

      // Fetch all message embeddings for the project
      const messages = await MessageEmbedding.find({ projectId }).lean();

      if (messages.length === 0) {
        logger.debug('No message embeddings found for project', { projectId });
        return [];
      }

      logger.debug('Computing message similarities', {
        projectId,
        messageCount: messages.length,
        topK
      });

      const results = messages.map(msg => {
        const similarity = this.cosineSimilarity(queryEmbedding, msg.embedding);
        return {
          id: msg._id,
          messageId: msg.messageId,
          discussionId: msg.discussionId,
          content: msg.content,
          userId: msg.userId,
          username: msg.username,
          timestamp: msg.timestamp,
          similarity
        };
      });

      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);

      const duration = Date.now() - startTime;

      logger.ai('Vector message search completed', {
        projectId,
        totalMessages: messages.length,
        topK,
        resultsFound: topResults.length,
        topSimilarity: topResults[0]?.similarity.toFixed(4),
        duration: `${duration}ms`
      });

      return topResults;

    } catch (error) {
      logger.error('Vector message search failed', {
        projectId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search for semantically similar decisions
   */
  async searchDecisions(projectId, queryEmbedding, topK = 8) {
    const startTime = Date.now();

    try {
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimension) {
        throw new Error(`Invalid query embedding dimension. Expected ${this.dimension}, got ${queryEmbedding?.length}`);
      }

      // Fetch only decisions that have embeddings
      const decisions = await Decision.find({
        projectId,
        embeddingStatus: 'done',
        embedding: { $exists: true, $ne: [] }
      }).lean();

      if (decisions.length === 0) {
        logger.debug('No embedded decisions found for project', { projectId });
        return [];
      }

      const results = decisions.map(dec => {
        const similarity = this.cosineSimilarity(queryEmbedding, dec.embedding);
        return {
          id: dec._id,
          text: dec.text,
          rationale: dec.rationale,
          proposedBy: dec.proposedBy,
          timestamp: dec.timestamp,
          similarity
        };
      });

      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);

      const duration = Date.now() - startTime;
      logger.ai('Vector decision search completed', {
        projectId,
        totalDecisions: decisions.length,
        topK,
        resultsFound: topResults.length,
        topSimilarity: topResults[0]?.similarity.toFixed(4),
        duration: `${duration}ms`
      });

      return topResults;
    } catch (error) {
      logger.error('Vector decision search failed', { projectId, error: error.message });
      return []; // fail-safe — fall back to empty
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Get chunk count for a project
   */
  async count(projectId) {
    try {
      return await DocumentChunk.countDocuments({ projectId });
    } catch (error) {
      logger.error('Error counting chunks', { projectId, error: error.message });
      return 0;
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteByDocument(documentId) {
    try {
      const result = await DocumentChunk.deleteMany({ documentId });
      logger.info('Chunks deleted for document', {
        documentId,
        deletedCount: result.deletedCount
      });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting chunks', { documentId, error: error.message });
      return 0;
    }
  }

  /**
   * Clear all chunks for a project (use with caution)
   */
  async clear(projectId) {
    try {
      const result = await DocumentChunk.deleteMany({ projectId });
      logger.warn('All chunks cleared for project', {
        projectId,
        deletedCount: result.deletedCount
      });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error clearing chunks', { projectId, error: error.message });
      return 0;
    }
  }
}

export default new VectorStore();


=== backend\src\middleware\auth.js ===

import authService from '../services/authService.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
    }
    next();
  } catch (error) {
    next();
  }
};


=== backend\src\middleware\errorHandler.js ===

/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses and logging
 */

import logger from '../utils/logger.js';
import config from '../config/index.js';

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class AIServiceError extends AppError {
  constructor(message = 'AI service unavailable', details = null) {
    super(message, 503, 'AI_SERVICE_ERROR', details);
  }
}

// Error handler middleware
export function errorHandler(err, req, res, next) {
  let error = err;

  // Convert non-AppError errors
  if (!(error instanceof AppError)) {
    // Mongoose validation errors
    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      error = new ValidationError('Validation failed', details);
    }
    // Mongoose cast errors
    else if (error.name === 'CastError') {
      error = new ValidationError(`Invalid ${error.path}: ${error.value}`);
    }
    // Mongoose duplicate key errors
    else if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      error = new ConflictError(`${field} already exists`);
    }
    // JWT errors
    else if (error.name === 'JsonWebTokenError') {
      error = new AuthenticationError('Invalid token');
    }
    else if (error.name === 'TokenExpiredError') {
      error = new AuthenticationError('Token expired');
    }
    // Generic errors
    else {
      error = new AppError(
        config.isDevelopment ? error.message : 'Internal server error',
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  // Log error
  logger.error(error.message, {
    code: error.code,
    statusCode: error.statusCode,
    stack: config.isDevelopment ? error.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    details: error.details
  });

  // Send response
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.code
    }
  };

  if (error.details) {
    response.error.details = error.details;
  }

  if (config.isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
}

// Async handler wrapper
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req, res, next) {
  next(new NotFoundError('Route'));
}


=== backend\src\middleware\validation.js ===

/**
 * Request Validation Middleware
 * Validates and sanitizes incoming requests
 */

import { ValidationError } from './errorHandler.js';

// Simple validation helpers (can be replaced with Joi/Zod later)
export const validators = {
  isEmail(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  isString(value, minLength = 0, maxLength = Infinity) {
    return (
      typeof value === 'string' &&
      value.trim().length >= minLength &&
      value.trim().length <= maxLength
    );
  },

  isObjectId(value) {
    return /^[0-9a-fA-F]{24}$/.test(value);
  },

  isEnum(value, allowedValues) {
    return allowedValues.includes(value);
  },

  isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }
};

// Validation schemas
export const schemas = {
  // Auth schemas
  register: {
    username: { type: 'string', required: true, min: 2, max: 50 },
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 6, max: 100 }
  },

  login: {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true }
  },

  // Project schemas
  createProject: {
    title: { type: 'string', required: true, min: 1, max: 200 },
    problemStatement: { type: 'string', required: true, min: 1, max: 5000 }
  },

  updateProject: {
    title: { type: 'string', required: false, min: 1, max: 200 },
    description: { type: 'string', required: false, max: 5000 },
    stage: { 
      type: 'enum', 
      required: false, 
      values: ['ideation', 'design', 'discussion', 'blocked', 'completed'] 
    }
  },

  joinProject: {
    inviteCode: { type: 'string', required: true, min: 8, max: 8 }
  },

  updateLLM: {
    provider: { 
      type: 'enum', 
      required: true, 
      values: ['groq', 'openai', 'anthropic', 'google', 'server'] 
    },
    model: { type: 'string', required: true, min: 1, max: 100 }
  },

  // Discussion schemas
  createDiscussion: {
    title: { type: 'string', required: true, min: 1, max: 200 },
    description: { type: 'string', required: false, max: 1000 },
    parentDiscussionId: { type: 'objectId', required: false }
  },

  // Document schemas
  uploadDocument: {
    title: { type: 'string', required: true, min: 1, max: 200 },
    content: { type: 'string', required: true, min: 1, max: 1000000 },
    fileType: { type: 'enum', required: false, values: ['text', 'pdf'] }
  },

  // Message schemas
  sendMessage: {
    text: { type: 'string', required: true, min: 1, max: 10000 }
  }
};

// Validate function
function validateField(fieldName, value, rules) {
  const errors = [];

  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  // Skip further validation if not required and empty
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return errors;
  }

  // Type validation
  switch (rules.type) {
    case 'string':
      if (!validators.isString(value, rules.min, rules.max)) {
        if (rules.min && rules.max) {
          errors.push(`${fieldName} must be between ${rules.min} and ${rules.max} characters`);
        } else if (rules.min) {
          errors.push(`${fieldName} must be at least ${rules.min} characters`);
        } else if (rules.max) {
          errors.push(`${fieldName} must be at most ${rules.max} characters`);
        } else {
          errors.push(`${fieldName} must be a string`);
        }
      }
      break;

    case 'email':
      if (!validators.isEmail(value)) {
        errors.push(`${fieldName} must be a valid email`);
      }
      break;

    case 'objectId':
      if (!validators.isObjectId(value)) {
        errors.push(`${fieldName} must be a valid ID`);
      }
      break;

    case 'enum':
      if (!validators.isEnum(value, rules.values)) {
        errors.push(`${fieldName} must be one of: ${rules.values.join(', ')}`);
      }
      break;

    case 'object':
      if (!validators.isObject(value)) {
        errors.push(`${fieldName} must be an object`);
      }
      break;
  }

  return errors;
}

// Validation middleware factory
export function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    
    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    const data = { ...req.body, ...req.params, ...req.query };
    const errors = [];

    // Validate each field
    for (const [fieldName, rules] of Object.entries(schema)) {
      const fieldErrors = validateField(fieldName, data[fieldName], rules);
      errors.push(...fieldErrors);
    }

    if (errors.length > 0) {
      return next(new ValidationError('Validation failed', errors));
    }

    next();
  };
}

// Sanitize input
export function sanitize(req, res, next) {
  // Trim strings in body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
}


=== backend\src\models\Decision.js ===

import mongoose from 'mongoose';

const decisionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  text: { type: String, required: true },
  rationale: { type: String, default: '' },
  proposedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String
  },
  sourceMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion'
  },
  embedding: {
    type: [Number],
    default: undefined  // sparse — only set when embedded
  },
  embeddingStatus: {
    type: String,
    enum: ['pending', 'done', 'failed'],
    default: 'pending'
  },
  timestamp: { type: Number, default: Date.now }
}, { timestamps: true });

decisionSchema.index({ projectId: 1, timestamp: -1 });
decisionSchema.index({ projectId: 1, embeddingStatus: 1 });

export default mongoose.model('Decision', decisionSchema);


=== backend\src\models\Discussion.js ===

import mongoose from 'mongoose';

const discussionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  isMain: {
    type: Boolean,
    default: false
  },
  // Graph structure
  parentDiscussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    default: null
  },
  branchDepth: {
    type: Number,
    default: 0
  },
  // Participants
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Metadata
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

discussionSchema.index({ projectId: 1, status: 1 });
discussionSchema.index({ parentDiscussionId: 1 });
discussionSchema.index({ lastActivity: -1 });

// Methods for graph traversal
discussionSchema.methods.getLineage = async function() {
  const lineage = [this._id];
  let current = this;
  
  while (current.parentDiscussionId) {
    current = await this.model('Discussion').findById(current.parentDiscussionId);
    if (!current) break;
    lineage.unshift(current._id);
  }
  
  return lineage;
};

discussionSchema.methods.getChildren = async function() {
  return await this.model('Discussion').find({ 
    parentDiscussionId: this._id,
    $or: [
      { status: 'active' },
      { status: { $exists: false } }
    ]
  });
};

export default mongoose.model('Discussion', discussionSchema);


=== backend\src\models\Document.js ===

import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['text', 'pdf'],
    default: 'text'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  embedding: {
    type: [Number], // vector embedding (can be null for MVP)
    default: null
  },
  chunks: [{
    text: String,
    embedding: [Number]
  }]
}, {
  timestamps: true
});

documentSchema.index({ projectId: 1 });
documentSchema.index({ uploadedBy: 1 });

export default mongoose.model('Document', documentSchema);


=== backend\src\models\DocumentChunk.js ===

/**
 * DocumentChunk Model - PHASE 2
 * Stores document chunks with embeddings for semantic search
 */

import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 384; // all-MiniLM-L6-v2 dimensions
      },
      message: 'Embedding must be an array of 384 numbers'
    }
  },
  metadata: {
    title: String,
    documentTitle: String
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
documentChunkSchema.index({ projectId: 1, documentId: 1 });
documentChunkSchema.index({ projectId: 1, chunkIndex: 1 });

export default mongoose.model('DocumentChunk', documentChunkSchema);


=== backend\src\models\Message.js ===

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // optional for backward compatibility
  },
  text: {
    type: String,
    required: true
  },
  roomId: {
    type: String,
    required: false, // legacy support
    default: 'general'
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: false // new structure
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false // new structure
  },
  timestamp: {
    type: Number,
    required: true,
    default: Date.now
  },
  isAI: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for better query performance
messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ discussionId: 1, timestamp: 1 });
messageSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);

=== backend\src\models\MessageEmbedding.js ===

import mongoose from 'mongoose';

const messageEmbeddingSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    unique: true
  },
  content: { type: String, required: true },
  embedding: {
    type: [Number],
    required: true,
    validate: [
      val => val.length === 384,
      'Embedding must be exactly 384 dimensions'
    ]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  username: String,
  timestamp: { type: Number, default: Date.now }
}, { timestamps: true });

messageEmbeddingSchema.index({ projectId: 1 });

export default mongoose.model('MessageEmbedding', messageEmbeddingSchema);


=== backend\src\models\Project.js ===

import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  problemStatement: {
    type: String,
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeLLM: {
    provider: {
      type: String,
      enum: ['groq', 'gemini', 'openai', 'claude', 'deepseek', 'anthropic', 'google', 'server'],
      default: 'server'
    },
    model: {
      type: String,
      default: 'llama-3.1-8b-instant'
    },
    apiKey: String // encrypted in production
  },
  apiKeys: {
    type: Map,
    of: String,
    default: {}
  },
  stage: {
    type: String,
    enum: ['ideation', 'design', 'discussion', 'blocked', 'completed'],
    default: 'ideation'
  },
  inviteCode: {
    type: String
  }
}, {
  timestamps: true
});

projectSchema.index({ ownerId: 1 });
projectSchema.index({ 'members.userId': 1 });
projectSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });

export default mongoose.model('Project', projectSchema);


=== backend\src\models\ProjectState.js ===

import mongoose from 'mongoose';

const projectStateSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  pinnedContext: { type: String, default: '' } // FIX 5: pre-built context string
}, { timestamps: true });

// FIX 9: single unique index — no duplicate
projectStateSchema.index({ projectId: 1 }, { unique: true });

export default mongoose.model('ProjectState', projectStateSchema);


=== backend\src\models\Summary.js ===

import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['discussion', 'decision', 'blocker', 'insight'],
    default: 'discussion'
  },
  generatedBy: {
    type: String,
    default: 'server' // which LLM generated this
  },
  messageRange: {
    start: Date,
    end: Date
  },
  embedding: {
    type: [Number],
    default: null
  },
  // How many messages the discussion had when this summary was created.
  // Used to detect stale summaries (discussion grew significantly after summarizing).
  messageCountAtSummary: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

summarySchema.index({ projectId: 1, createdAt: -1 });
summarySchema.index({ discussionId: 1 });

export default mongoose.model('Summary', summarySchema);


=== backend\src\models\User.js ===

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 20
  },
  email: {
    type: String,
    required: false, // optional for legacy users
    sparse: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: false // optional for OAuth users
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    sparse: true
  },
  // Profile fields
  bio: {
    type: String,
    maxlength: 200,
    default: ''
  },
  theme: {
    type: String,
    enum: ['dark', 'light'],
    default: 'dark'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  joinedRooms: [{
    type: String,
    default: []
  }],
  messageCount: {
    type: Number,
    default: 0
  },
  projects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }]
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ lastSeen: -1 });
userSchema.index({ isOnline: -1 });

export default mongoose.model('User', userSchema);

=== backend\src\routes\auth.js ===

import express from 'express';
import authService from '../services/authService.js';
import emailService from '../services/emailService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { AuthenticationError, ValidationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Register
router.post('/register', 
  validate('register'),
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;
    const result = await authService.register(username, email, password);
    
    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail({ to: email, username }).catch(err => {
      logger.error('Failed to send welcome email', { email, error: err.message });
    });
    
    res.json({ success: true, ...result });
  })
);

// Login
router.post('/login',
  validate('login'),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json({ success: true, ...result });
  })
);

// Google OAuth - Initiate
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/auth/google/callback';
  
  if (!clientId) {
    return res.status(500).json({ 
      success: false, 
      error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID in environment variables.' 
    });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=openid%20email%20profile&` +
    `access_type=offline&` +
    `prompt=consent`;

  res.redirect(googleAuthUrl);
});

// Google OAuth - Callback
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_failed`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/api/auth/google/callback';

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  if (!tokens.access_token) {
    throw new Error('Failed to get access token');
  }

  // Get user info
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  const userInfo = await userInfoResponse.json();

  // Authenticate or create user
  const result = await authService.googleAuth(userInfo.id, userInfo.email, userInfo.name);

  // Redirect to frontend with token
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}?token=${result.token}&provider=google`);
}));

// Google OAuth - Direct (for mobile/SPA with Google Sign-In button)
router.post('/google', asyncHandler(async (req, res) => {
  const { idToken, googleId, email, username } = req.body;

  // Support both ID token verification and direct credentials
  if (idToken) {
    // Verify Google ID token
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const userInfo = await response.json();

    if (userInfo.error) {
      throw new ValidationError('Invalid Google ID token');
    }

    const result = await authService.googleAuth(userInfo.sub, userInfo.email, userInfo.name);
    return res.json({ success: true, ...result });
  }

  // Fallback to direct credentials (for testing)
  if (!googleId || !email) {
    throw new ValidationError('Google ID and email required');
  }

  const result = await authService.googleAuth(googleId, email, username);
  res.json({ success: true, ...result });
}));

// Verify token
router.get('/verify', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  const decoded = authService.verifyToken(token);
  const user = await authService.getUserById(decoded.userId);

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  res.json({ success: true, user });
}));

export default router;


=== backend\src\routes\projects.js ===

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import documentService from '../services/documentService.js';
import summaryService from '../services/summaryService.js';
import aiService from '../services/aiService.js';
import Decision from '../models/Decision.js';
import ProjectState from '../models/ProjectState.js';
import crypto from 'crypto';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create project
router.post('/', async (req, res) => {
  try {
    const { title, problemStatement } = req.body;

    if (!title || !problemStatement) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and problem statement required' 
      });
    }

    const project = await projectService.createProject(
      title, 
      problemStatement, 
      req.user.userId
    );

    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user's projects
router.get('/', async (req, res) => {
  try {
    const projects = await projectService.getUserProjects(req.user.userId);
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project by ID
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check membership
    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const project = await projectService.getProjectById(projectId);
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join project via invite code
router.post('/join', async (req, res) => {
  try {
    const { inviteCode, discussionId } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invite code required' });
    }

    const project = await projectService.joinProject(inviteCode, req.user.userId);
    
    let alreadyMember = false;
    let addedToDiscussion = false;
    
    // Check if user was already a member
    const isMember = await projectService.isProjectMember(project._id, req.user.userId);
    if (isMember) {
      alreadyMember = true;
    }
    
    // If discussionId is provided, also join that specific discussion
    if (discussionId) {
      try {
        await discussionService.joinDiscussion(discussionId, req.user.userId);
        addedToDiscussion = true;
        console.log(`User ${req.user.userId} joined discussion ${discussionId}`);
      } catch (discussionError) {
        console.error('Failed to join discussion:', discussionError);
      }
    }
    
    res.json({ 
      success: true, 
      project, 
      discussionId,
      alreadyMember,
      addedToDiscussion
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Preview invite info (without joining)
router.post('/invite-preview', async (req, res) => {
  try {
    const { inviteCode, discussionId } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invite code required' });
    }

    // Find project by invite code
    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findOne({ inviteCode }).lean();
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Invalid invite code' });
    }

    // Check if user is already a member
    const isMember = await projectService.isProjectMember(project._id, req.user.userId);
    
    let discussionInfo = null;
    if (discussionId) {
      const discussion = await discussionService.getDiscussionById(discussionId);
      if (discussion) {
        discussionInfo = {
          id: discussion._id,
          title: discussion.title,
          isParticipant: discussion.participants.some(p => p.toString() === req.user.userId.toString())
        };
      }
    }

    res.json({
      success: true,
      project: {
        id: project._id,
        title: project.title,
        memberCount: project.members?.length || 0
      },
      isMember,
      discussion: discussionInfo
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Send project invite email
router.post('/:projectId/invite-email', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }

    // Check if requester is project owner or member
    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Get project details
    const project = await projectService.getProjectById(projectId);
    
    // Import email service
    const emailService = (await import('../services/emailService.js')).default;
    
    // Send email
    await emailService.sendProjectInvite({
      to: email,
      inviterName: req.user.username,
      projectTitle: project.title,
      inviteCode: project.inviteCode
    });

    res.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error sending project invite email:', error);
    res.status(500).json({ success: false, error: 'Failed to send invitation email' });
  }
});

// Update project stage
router.patch('/:projectId/stage', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { stage } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can update stage' });
    }

    const project = await projectService.updateProjectStage(projectId, stage);
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update project (general)
router.patch('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeLLM, stage } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can update project' });
    }

    const updates = {};
    if (activeLLM) updates.activeLLM = activeLLM;
    if (stage) updates.stage = stage;

    const project = await projectService.updateProject(projectId, updates);
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update LLM configuration
router.put('/:projectId/llm', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeLLM } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can update LLM' });
    }

    const project = await projectService.updateProject(projectId, { activeLLM });
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Save API key for provider
router.post('/:projectId/api-key', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { provider, apiKey } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can set API keys' });
    }

    if (!provider || !apiKey) {
      return res.status(400).json({ success: false, error: 'Provider and API key required' });
    }

    // Store API key in project's apiKeys map
    const project = await projectService.setProjectApiKey(projectId, provider, apiKey);
    res.json({ success: true, message: 'API key saved successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get project discussions
router.get('/:projectId/discussions', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const discussions = await discussionService.getProjectDiscussions(projectId);

    // Attach latest summary metadata to each non-main discussion so the
    // frontend can show stale indicators without extra round-trips.
    const enriched = await Promise.all(discussions.map(async (disc) => {
      if (disc.isMain) return disc;
      const latestSummaries = await summaryService.getDiscussionSummaries(disc._id, 1);
      const latest = latestSummaries[0] || null;
      return {
        ...disc,
        latestSummary: latest ? {
          _id: latest._id,
          createdAt: latest.createdAt,
          messageCountAtSummary: latest.messageCountAtSummary || 0
        } : null
      };
    }));

    res.json({ success: true, discussions: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create parallel discussion
router.post('/:projectId/discussions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    // Get project to find owner
    const project = await projectService.getProjectById(projectId);
    
    const discussion = await discussionService.createDiscussion(
      projectId,
      name || 'New Discussion',
      description,
      req.user.userId,
      project.ownerId
    );

    res.json({ success: true, discussion });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Invite member to discussion
router.post('/:projectId/discussions/:discussionId/invite', async (req, res) => {
  try {
    const { projectId, discussionId } = req.params;
    const { userId } = req.body;

    // Check if requester is in the discussion
    const discussion = await discussionService.getDiscussionById(discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, error: 'Discussion not found' });
    }

    // Check if requester is project owner OR discussion participant
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    const isParticipant = discussion.participants.some(
      p => p.toString() === req.user.userId.toString()
    );

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ success: false, error: 'Not authorized to invite members' });
    }

    // Check if invitee is project member
    const isMember = await projectService.isProjectMember(projectId, userId);
    if (!isMember) {
      return res.status(400).json({ success: false, error: 'User is not a project member' });
    }

    // Add to discussion
    await discussionService.joinDiscussion(discussionId, userId);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Send discussion invite email
router.post('/:projectId/discussions/:discussionId/invite-email', async (req, res) => {
  try {
    const { projectId, discussionId } = req.params;
    const { email, discussionTitle } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }

    // Check if requester is in the discussion
    const discussion = await discussionService.getDiscussionById(discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, error: 'Discussion not found' });
    }

    // Check if requester is project owner OR discussion participant
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    const isParticipant = discussion.participants.some(
      p => p.toString() === req.user.userId.toString()
    );

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ success: false, error: 'Not authorized to send invites' });
    }

    // Get project details
    const project = await projectService.getProjectById(projectId);
    
    // Import email service
    const emailService = (await import('../services/emailService.js')).default;
    
    // Send email with invite code and discussion ID
    await emailService.sendDiscussionInvite({
      to: email,
      inviterName: req.user.username,
      projectTitle: project.title,
      discussionTitle: discussionTitle || discussion.title,
      inviteCode: project.inviteCode,
      discussionId
    });

    res.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error sending discussion invite email:', error);
    res.status(500).json({ success: false, error: 'Failed to send invitation email' });
  }
});

// Get project documents
router.get('/:projectId/documents', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const documents = await documentService.getProjectDocuments(projectId);
    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint: Get document chunks with embeddings
router.get('/:projectId/documents/:documentId/chunks', async (req, res) => {
  try {
    const { projectId, documentId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const chunks = await documentService.getDocumentChunks(documentId);
    res.json({ success: true, chunks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload document
router.post('/:projectId/documents', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, content, fileType } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    // Normalize fileType to match enum values
    let normalizedFileType = 'text';
    if (fileType) {
      if (fileType.includes('pdf')) {
        normalizedFileType = 'pdf';
      } else {
        normalizedFileType = 'text';
      }
    }

    const document = await documentService.uploadDocument(
      projectId,
      title,
      content,
      normalizedFileType,
      req.user.userId
    );

    res.json({ success: true, document });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get project summaries
router.get('/:projectId/summaries', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const summaries = await summaryService.getProjectSummaries(projectId);
    res.json({ success: true, summaries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate summary for discussion
router.post('/:projectId/discussions/:discussionId/summarize', async (req, res) => {
  try {
    const { projectId, discussionId } = req.params;
    const { customPrompt } = req.body; // Optional custom instructions

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    // Prevent summarizing the main discussion
    const discussion = await discussionService.getDiscussionById(discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, error: 'Discussion not found' });
    }
    if (discussion.isMain) {
      return res.status(400).json({ success: false, error: 'Cannot summarize the main thread' });
    }

    const project = await projectService.getProjectById(projectId);
    const summaryContent = await aiService.generateSummary(
      projectId,
      discussionId,
      project.activeLLM,
      customPrompt
    );

    // Capture message count at time of summarization
    const messageCountAtSummary = discussion.messageCount || 0;

    const summary = await summaryService.createSummary(
      projectId,
      discussionId,
      summaryContent,
      'discussion',
      project.activeLLM.provider,
      messageCountAtSummary
    );

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update/regenerate summary with custom prompt
router.put('/:projectId/discussions/:discussionId/summaries/:summaryId', async (req, res) => {
  try {
    const { projectId, discussionId, summaryId } = req.params;
    const { customPrompt } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    if (!customPrompt) {
      return res.status(400).json({ success: false, error: 'Custom prompt required' });
    }

    const project = await projectService.getProjectById(projectId);
    
    // Get existing summary
    const existingSummary = await summaryService.getSummaryById(summaryId);
    if (!existingSummary) {
      return res.status(404).json({ success: false, error: 'Summary not found' });
    }

    // Regenerate with custom prompt
    const newContent = await aiService.regenerateSummary(
      projectId,
      discussionId,
      existingSummary.content,
      customPrompt,
      project.activeLLM
    );

    // Update the summary
    const updatedSummary = await summaryService.updateSummary(summaryId, newContent);

    res.json({ success: true, summary: updatedSummary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete summary
router.delete('/:projectId/discussions/:discussionId/summaries/:summaryId', async (req, res) => {
  try {
    const { projectId, summaryId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    await summaryService.deleteSummary(summaryId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Add to project memory (optimistic — saves immediately, normalizes async)
router.post('/:projectId/decisions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { messageId, discussionId } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const Message = (await import('../models/Message.js')).default;
    const Decision = (await import('../models/Decision.js')).default;
    const ProjectState = (await import('../models/ProjectState.js')).default;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });

    // Save immediately with raw text
    const decision = await Decision.create({
      projectId,
      text: message.text,
      rationale: '',
      proposedBy: { userId: message.userId, username: message.user },
      sourceMessageId: messageId,
      discussionId
    });

    // Respond instantly
    res.json({ success: true, decision });

    // Background: normalize via LLM, then embed the decision
    (async () => {
      try {
        const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;
        const project = await projectService.getProjectById(projectId);
        const prompt = `You are normalizing a raw engineering conversation message into a clean decision record.\nSpeaker: ${message.user}\nRaw message: "${message.text}"\n\nWrite a single clean declarative statement capturing the decision made. Rules:\n- Start with a verb or technology name\n- Maximum 15 words\n- Never use first person\n- Never quote the raw text verbatim\n- If the message contains a clear reason, extract it as rationale separately\n\nReturn ONLY valid JSON with no markdown: {"text": "...", "rationale": "..."}\nRationale can be empty string if no clear reason given.`;

        const llmConfig = project.activeLLM || { provider: 'server', model: 'llama-3.1-8b-instant' };
        const selectedModel = AIOrchestrator.selectModel(llmConfig);
        const response = await AIOrchestrator.callProvider({
          requestId: crypto.randomUUID(), provider: selectedModel.provider,
          model: selectedModel.model, prompt, projectId, userId: req.user.userId, maxTokens: 1024
        });
        const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        await Decision.findByIdAndUpdate(decision._id, { text: parsed.text, rationale: parsed.rationale || '' });
      } catch (e) {
        console.warn('[decision-normalize] Background normalization failed:', e.message);
      }
      // Embed the decision for semantic retrieval
      try {
        const EmbeddingService = (await import('../core/embeddings/EmbeddingService.js')).default;
        const updatedDecision = await Decision.findById(decision._id);
        const textToEmbed = updatedDecision.text + (updatedDecision.rationale ? '. ' + updatedDecision.rationale : '');
        const embedding = await EmbeddingService.embedText(textToEmbed);
        if (embedding) {
          await Decision.findByIdAndUpdate(decision._id, { embedding, embeddingStatus: 'done' });
          console.log('[decision-embed] Decision embedded successfully:', decision._id);
        }
      } catch (e) {
        await Decision.findByIdAndUpdate(decision._id, { embeddingStatus: 'failed' });
        console.warn('[decision-embed] Embedding failed:', e.message);
      }
    })();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get decision log
router.get('/:projectId/decisions', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const Decision = (await import('../models/Decision.js')).default;
    const decisions = await Decision.find({ projectId }).sort({ timestamp: -1 });

    res.json({ success: true, decisions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


=== backend\src\routes\user.js ===

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { username, email, bio, theme } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if username is taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'Username already taken' });
      }
      user.username = username;
    }

    // Check if email is taken by another user
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ success: false, error: 'Email already taken' });
      }
      user.email = email;
    }

    if (bio !== undefined) user.bio = bio;
    if (theme) user.theme = theme;

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Change password
router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 6 characters' 
      });
    }

    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user has a password (OAuth users don't)
    if (!user.password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot change password for OAuth accounts' 
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password is incorrect' 
      });
    }

    // Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user stats
router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('projects')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const stats = {
      projectCount: user.projects.length,
      messageCount: user.messageCount,
      joinedAt: user.createdAt,
      lastSeen: user.lastSeen
    };

    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


=== backend\src\scripts\check-projects.js ===

import dotenv from 'dotenv'; dotenv.config();
import connectDB from '../config/database.js';
import '../models/User.js';
import '../models/Message.js';
import '../models/Summary.js';
import Project from '../models/Project.js';
import discussionService from '../services/discussionService.js';
await connectDB();
const projects = await Project.find({}).lean();
for (const p of projects) {
  const discs = await discussionService.getProjectDiscussions(p._id.toString());
  let total = 0;
  for (const d of discs) {
    const msgs = await discussionService.getDiscussionMessages(d._id, 500);
    total += msgs.filter(m => m.user !== 'System').length;
    console.log(`  [${d.title}] ${msgs.length} msgs`);
  }
  console.log(`${p.title} — total: ${total}`);
}
process.exit(0);


=== backend\src\scripts\fix-indexes.js ===

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-ai';

async function fixIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Drop duplicate indexes on users collection
    try {
      const usersCollection = db.collection('users');
      await usersCollection.dropIndex('username_1');
      console.log('✅ Dropped old username index');
    } catch (error) {
      console.log('ℹ️ Username index already correct or not found');
    }

    try {
      const usersCollection = db.collection('users');
      await usersCollection.dropIndex('email_1');
      console.log('✅ Dropped old email index');
    } catch (error) {
      console.log('ℹ️ Email index already correct or not found');
    }

    try {
      const usersCollection = db.collection('users');
      await usersCollection.dropIndex('googleId_1');
      console.log('✅ Dropped old googleId index');
    } catch (error) {
      console.log('ℹ️ GoogleId index already correct or not found');
    }

    // Drop duplicate indexes on projects collection
    try {
      const projectsCollection = db.collection('projects');
      await projectsCollection.dropIndex('inviteCode_1');
      console.log('✅ Dropped old inviteCode index');
    } catch (error) {
      console.log('ℹ️ InviteCode index already correct or not found');
    }

    console.log('\n✅ Index cleanup complete!');
    console.log('Please restart the server for changes to take effect.');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
    process.exit(1);
  }
}

fixIndexes();


=== backend\src\scripts\migrate-to-groq.js ===

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/Project.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-ai';

async function migrateToGroq() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update all projects to use Groq/Llama
    const result = await Project.updateMany(
      {},
      {
        $set: {
          'activeLLM.provider': 'server',
          'activeLLM.model': 'llama-3.1-8b-instant'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} projects to use Groq (Llama 3.1)`);
    console.log('All projects now use the free Groq API!');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error migrating projects:', error);
    process.exit(1);
  }
}

migrateToGroq();


=== backend\src\scripts\migrate-to-simple.js ===

import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../utils/logger.js';

import Decision from '../models/Decision.js';
import ProjectState from '../models/ProjectState.js';

async function migrate() {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri, config.mongodbOptions || {});
    logger.info('Connected to MongoDB. Starting migration to simple architecture...');

    // 1. Drop old collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    if (colNames.includes('topics')) {
      await mongoose.connection.db.dropCollection('topics');
      logger.info('Dropped topics collection');
    }
    if (colNames.includes('blockers')) {
      await mongoose.connection.db.dropCollection('blockers');
      logger.info('Dropped blockers collection');
    }
    if (colNames.includes('actionitems')) {
      await mongoose.connection.db.dropCollection('actionitems');
      logger.info('Dropped actionitems collection');
    }
    if (colNames.includes('projectinsights')) {
      await mongoose.connection.db.dropCollection('projectinsights');
      logger.info('Dropped projectinsights collection');
    }
    if (colNames.includes('pendingsignals')) {
      await mongoose.connection.db.dropCollection('pendingsignals');
      logger.info('Dropped pendingsignals collection');
    }
    if (colNames.includes('rooms')) {
      await mongoose.connection.db.dropCollection('rooms');
      logger.info('Dropped rooms collection');
    }

    // 2. Clear all existing decisions
    const delRes = await Decision.deleteMany({});
    logger.info(`Deleted ${delRes.deletedCount} legacy decisions.`);

    // 3. Reset ProjectState objects
    const projectStates = await ProjectState.find({});
    for (const state of projectStates) {
      await ProjectState.updateOne(
        { _id: state._id },
        { 
          $set: { pinnedContext: '' },
          $unset: {
            stage: "",
            stageReason: "",
            momentum: "",
            activeTopicCount: "",
            openBlockerCount: "",
            unresolvedActionCount: "",
            recentInsights: "",
            lastIntelligenceUpdate: "",
            version: ""
          }
        }
      );
    }
    logger.info(`Migrated ${projectStates.length} ProjectState documents.`);

    logger.info('Migration complete!');
    process.exit(0);

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();


=== backend\src\scripts\setup.js ===

import connectDB from '../config/database.js';
import messageService from '../services/messageService.js';
import roomService from '../services/roomService.js';
import userService from '../services/userService.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database...');
    
    // Connect to MongoDB
    await connectDB();
    
    // Initialize default rooms
    await roomService.initializeDefaultRooms();
    
    // Test database connection
    const count = await messageService.getMessageCount();
    console.log(`📊 Current messages in database: ${count}`);
    
    const rooms = await roomService.getAllRooms();
    console.log(`🏠 Available rooms: ${rooms.map(r => r.name).join(', ')}`);
    
    const users = await userService.getAllUsersWithStats();
    console.log(`👥 Total users: ${users.length}`);
    
    console.log('✅ Database setup complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();

=== backend\src\scripts\simulate-conversation.js ===

import 'dotenv/config';
import connectDB from '../config/database.js';
import authService from '../services/authService.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import Project from '../models/Project.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const DELAY_MS = parseInt(process.env.DELAY_MS || args.find(a => a.startsWith('--delay='))?.split('=')[1] || '800', 10);
const RESET    = process.env.RESET === 'true' || args.includes('--reset');

// ─── Project definition ───────────────────────────────────────────────────────

const PROJECT_TITLE = 'BidPulse';
const PROJECT_DESC  =
  'A centralized platform designed to scrape, normalize, and analyze procurement data ' +
  'from government portals like GeM (Government e-Marketplace) and eProcure. It provides ' +
  'small-to-medium enterprises with smart keyword alerts, historical pricing trends, and ' +
  'automated document mirroring to ensure they never miss a bidding opportunity.';

// ─── Conversation ─────────────────────────────────────────────────────────────
// Format: { user: 'nk' | 'pk', text: '...' }

const CONVERSATION = [
  { user: 'nk', text: "I'm looking at the GeM landing page—it's not just a simple search result. The whole thing is behind a multi-step redirect chain." },
  { user: 'pk', text: "Yeah, and the session cookies expire in like 15 minutes. We can't just use a simple Python requests script for this." },
  { user: 'nk', text: "We probably need Playwright. It's the only way to handle the client-side rendering and the session handshakes reliably." },
  { user: 'pk', text: "If we run headless browsers for every search, our memory usage is going to hit the ceiling on a standard VPS." },
  { user: 'nk', text: "What if we use a pool of persistent browser contexts? We keep 5 \"warm\" browsers open and rotate the tasks through them." },
  { user: 'pk', text: "That might work, but we still have to deal with the Captchas that pop up after every 5 or 6 automated searches." },
  { user: 'nk', text: "I'm looking at a solver API—it's a few cents per 1000 solves. We can integrate that directly into the Playwright flow." },
  { user: 'pk', text: "Fine, but the normalization is the real headache. GeM's JSON structure for tenders is a total mess." },
  { user: 'nk', text: "I'll write a transformer layer in TypeScript. We can define a strict Zod schema to ensure the final output is clean." },
  { user: 'pk', text: "We should store the raw HTML in S3 too, just in case we need to re-parse the data later when we add more fields." },
  { user: 'nk', text: "Good idea. We'll keep the metadata like \"Title,\" \"Value,\" and \"Closing Date\" in Postgres for the search filters." },
  { user: 'pk', text: "Wait, what if a tender is updated? The portals often post \"Corrigendums\" that change the whole scope." },
  { user: 'nk', text: "We can hash the main description text. If the hash changes on a subsequent crawl, we trigger a \"Revised\" status for that ID." },
  { user: 'pk', text: "How are we handling the search? Standard Postgres LIKE queries are going to be way too slow once we hit 50k tenders." },
  { user: 'nk', text: "Let's use Meilisearch. It's lightweight, supports typo tolerance, and it's much faster for a \"search-as-you-type\" UI." },
  { user: 'pk', text: "How do we keep Postgres and Meilisearch in sync?" },
  { user: 'nk', text: "I'll set up a cron job that runs every 10 minutes. It'll grab any new or updated rows from Postgres and push them to the Meilisearch index." },
  { user: 'pk', text: "That's safer than a DB trigger. We don't want the main ingestion to fail just because the search index is down." },
  { user: 'nk', text: "Exactly. Now, about the notifications—users will want to know the second a matching tender is found." },
  { user: 'pk', text: "We can let users save a search query. Every time the scraper finishes a cycle, we run those saved queries and find the \"delta.\"" },
  { user: 'nk', text: "We need to deduplicate the alerts. Nobody wants a separate email for 10 different tenders found in one hour." },
  { user: 'pk', text: "We'll batch them. We can send a \"New Matches\" digest every 4 hours using Resend or Amazon SES." },
  { user: 'nk', text: "I'm worried about the \"Category\" field. The portals use very broad categories that aren't helpful for filtering." },
  { user: 'pk', text: "We might need to run the descriptions through a small LLM or even just a keyword-based classifier to tag them better." },
  { user: 'nk', text: "Let's start with a regex-based tagger. If it contains \"workstation\" or \"monitor,\" tag it as \"IT Hardware.\"" },
  { user: 'pk', text: "Simple enough. I'll start on the scraper skeleton tonight. I need to figure out the best proxy rotation strategy." },
  { user: 'nk', text: "Use residential proxies. My local IP got flagged and hit with a 403 Forbidden error after only 10 minutes of testing." },
  { user: 'pk', text: "Already looking at a provider. I'll implement the rotation logic so every request looks like it's coming from a different city." },
  { user: 'nk', text: "Don't forget the \"Closing Date\" logic. If the tender is already expired, the scraper should skip the document download step." },
  { user: 'pk', text: "Obvious, but I'll add a \"Status\" check to the crawler. Speaking of documents, some of these PDFs are 50MB+." },
  { user: 'nk', text: "We have to mirror them on S3. The portals often delete the files once the bidding period ends, and users need them for reference." },
  { user: 'pk', text: "That's going to eat up storage fast. Maybe we only mirror files for tenders that match at least one user's \"Watchlist.\"" },
  { user: 'nk', text: "That's a smart way to limit the volume. We can always trigger a manual download if a user clicks an un-mirrored link." },
  { user: 'pk', text: "I'll build the \"Watchlist\" logic first. It'll act as a filter for the S3 uploader." },
  { user: 'nk', text: "I'll start on the Next.js frontend and the Meilisearch integration for the main dashboard." },
  { user: 'pk', text: "We should check the \"Terms of Service\" on GeM. We don't want a legal notice for aggressive crawling on week one." },
  { user: 'nk', text: "We're aggregating public data. As long as we keep the request frequency \"human-like\" with random delays, we should be fine." },
  { user: 'pk', text: "I'll add a \"jitter\" function to the scraper. It'll wait between 2 and 7 seconds between every page load." },
  { user: 'nk', text: "Perfect. The staging environment is ready; I'll push the basic Postgres schema to the repo in an hour." },
  { user: 'pk', text: "I'll pull it and start mapping the scraper output to those table columns." },
  { user: 'nk', text: "Let's also add a \"Tender Value\" parser. Some portals write it as \"1.5 Cr\" and others as \"15,000,000.\"" },
  { user: 'pk', text: "Ugh, I'll write a utility function to normalize everything to a BigInt in the smallest currency unit." },
  { user: 'nk', text: "Sounds like a plan. Let's sync again tomorrow once the first 100 tenders are successfully ingested." },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) { console.log(`[simulate] ${msg}`); }

async function getOrCreateUser(username) {
  const User = (await import('../models/User.js')).default;
  const existing = await User.findOne({ username }).lean();
  if (existing) {
    log(`Found existing user: ${username} (${existing._id})`);
    return existing;
  }
  const email    = `${username}@bidpulse.test`;
  const password = 'Test1234!';
  const result = await authService.register(username, email, password);
  log(`Created user: ${username}`);
  return result.user;
}

// Minimal manual fetch for NodeJS 18+ (which we assume is used, or polyfill needed)
async function triggerDecisionAPI(projectId, messageId, text, token) {
  const port = process.env.PORT || 8080;
  const isDecision = /let's use|we will|we should|i'll write|in postgres|we need|we keep 5/i.test(text);
  
  if (isDecision) {
    try {
      const res = await fetch(`http://localhost:${port}/api/projects/${projectId}/decisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messageId: messageId,
          sourceMessageText: text
        })
      });

      if (res.ok) {
        process.stdout.write(`         ↳ decision saved manually via API\n`);
      } else {
        process.stdout.write(`         ↳ API returned ${res.status}\n`);
      }
    } catch (err) {
      process.stdout.write(`         ↳ API call failed (${err.message}). Is the server running?\n`);
    }
  }
}

async function main() {
  await connectDB();
  log('DB connected');

  if (RESET) {
    const deleted = await Project.deleteOne({ title: PROJECT_TITLE });
    if (deleted.deletedCount) log(`Deleted existing project "${PROJECT_TITLE}"`);
  }

  const nk = await getOrCreateUser('nk');
  const pk = await getOrCreateUser('pk');
  const userMap = { nk, pk };

  let project;
  const existing = await Project.findOne({ title: PROJECT_TITLE }).lean();
  if (existing) {
    project = existing;
    log(`Reusing existing project: ${project._id}`);
  } else {
    project = await projectService.createProject(PROJECT_TITLE, PROJECT_DESC, nk._id);
    log(`Created project: ${project._id}`);
  }

  try {
    await projectService.joinProject(project.inviteCode, pk._id);
    log('pk joined project');
  } catch {
    log('pk already a member');
  }

  const discussions = await discussionService.getProjectDiscussions(project._id);
  let discussion = discussions.find(d => d.isMain) || discussions[0];
  if (!discussion) {
    discussion = await discussionService.createDiscussion(
      project._id, 'Main', '', nk._id, nk._id
    );
    log(`Created discussion: ${discussion._id}`);
  }

  try {
    await discussionService.joinDiscussion(discussion._id, pk._id);
  } catch { /* already in */ }

  log(`\nReplaying ${CONVERSATION.length} messages (delay: ${DELAY_MS}ms)...\n`);

  for (let i = 0; i < CONVERSATION.length; i++) {
    const { user: username, text } = CONVERSATION[i];
    const user = userMap[username];

    const message = await discussionService.addMessage(
      discussion._id,
      project._id,
      user._id,
      username,
      text,
      false
    );

    process.stdout.write(`  [${String(i + 1).padStart(2, '0')}/${CONVERSATION.length}] ${username}: ${text.substring(0, 60)}...\n`);

    const tokenUser = await authService.getUserById(user._id);
    const token = await authService.generateToken(tokenUser);
    
    // Simulate user "manually logging" a decision
    await triggerDecisionAPI(project._id, message._id, text, token);

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  log('\nDone. Open the dashboard in the UI to see results.');
  log(`Project ID: ${project._id}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});


=== backend\src\scripts\simulate-hirehub.js ===

/**
 * simulate-hirehub.js
 *
 * nk and pk building a real-time multiplayer quiz platform — CodeDuel.
 * Players join rooms, get the same coding question simultaneously,
 * submit solutions, and get ranked by correctness + speed.
 *
 * System areas covered (intentionally distinct):
 *   - Room & matchmaking
 *   - Code execution / sandboxing
 *   - Real-time sync
 *   - Scoring & leaderboard
 *   - Question bank
 *
 * Usage:
 *   node src/scripts/simulate-hirehub.js
 *   node src/scripts/simulate-hirehub.js --reset
 *   node src/scripts/simulate-hirehub.js --delay=0
 */

import 'dotenv/config';
import connectDB from '../config/database.js';
import authService from '../services/authService.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import AIOrchestrator from '../core/orchestrator/AIOrchestrator.js';
import Project from '../models/Project.js';

const args     = process.argv.slice(2);
const DELAY_MS = parseInt(process.env.DELAY_MS ?? args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '800', 10);
const RESET    = process.env.RESET === 'true' || args.includes('--reset');

const PROJECT_TITLE = 'CodeDuel';
const PROJECT_DESC  =
  'A real-time multiplayer coding challenge platform where two players join a room, ' +
  'receive the same algorithmic problem simultaneously, write solutions in-browser, ' +
  'and get ranked by correctness and time-to-solve. Supports Python, JavaScript, and Java.';

const CONVERSATION = [
  { user: 'nk', text: "So the core loop is: two players join a room, they both get the same question at the exact same time, they code, they submit, we rank them." },
  { user: 'pk', text: "The hardest part is the simultaneous question delivery. If one player gets it 200ms before the other, the whole fairness model breaks." },
  { user: 'nk', text: "We use WebSockets for the room. When both players are connected and ready, the server emits the question to both in a single broadcast event." },
  { user: 'pk', text: "What about the matchmaking? Do we do skill-based or just first-come-first-served?" },
  { user: 'nk', text: "Start with a simple queue — first two players waiting get matched. We can add ELO-based matching later once we have enough users." },
  { user: 'pk', text: "The code execution is the scary part. We can't just run arbitrary user code on the server. One infinite loop and the whole thing goes down." },
  { user: 'nk', text: "We run each submission inside a Docker container with a hard 5-second CPU timeout and 64MB memory limit. Kill the container after." },
  { user: 'pk', text: "Spinning up a Docker container per submission is going to be too slow. Cold start is like 800ms minimum." },
  { user: 'nk', text: "We keep a pool of warm containers — say 10 pre-started ones per language. Assign one to a submission, run it, recycle it back to the pool." },
  { user: 'pk', text: "How do we prevent a submission from reading files or making network calls? Just the timeout isn't enough." },
  { user: 'nk', text: "We use seccomp profiles to block all syscalls except the ones needed to run the code. No file I/O, no network, no fork." },
  { user: 'pk', text: "Actually I looked into it more — Docker with seccomp still has too much attack surface for untrusted code. We should use Firecracker microVMs instead." },
  { user: 'nk', text: "You're right. Firecracker boots in under 125ms, has a minimal attack surface, and gives us proper VM-level isolation. We switch to Firecracker for code execution." },
  { user: 'pk', text: "OK so the execution is isolated. Now the scoring — how do we rank? Just who finishes first?" },
  { user: 'nk', text: "Correctness first, then time. If both players pass all test cases, the faster one wins. If one fails, the other wins regardless of time." },
  { user: 'pk', text: "We need to store the test cases somewhere. And they need to be hidden from the client — can't just send them with the question." },
  { user: 'nk', text: "Test cases live in the database, never sent to the client. The execution container fetches them server-side and runs the submission against them." },
  { user: 'pk', text: "What database are we using for the question bank? These questions have structured data — title, description, constraints, test cases, difficulty." },
  { user: 'nk', text: "We use MongoDB for the question bank. Each question is a document with embedded test cases. Easy to query by difficulty and tag." },
  { user: 'pk', text: "Wait — we're going to need to do complex queries on questions. Filter by difficulty AND tag AND not-seen-by-user. MongoDB's query planner is going to struggle with that compound index." },
  { user: 'nk', text: "Good point. We switch to Postgres for the question bank. Questions and test cases as separate tables with foreign keys. The compound queries will be much cleaner." },
  { user: 'pk', text: "And for the leaderboard? We need fast reads — top 100 players globally, and per-room rankings during a live match." },
  { user: 'nk', text: "We keep a sorted set in Redis for the global leaderboard. Score is ELO rating. Reads are O(log n) and writes are instant." },
  { user: 'pk', text: "The per-room leaderboard during a live match is different — it's just two players, updated in real time as they submit." },
  { user: 'nk', text: "That's just a WebSocket broadcast. When player A submits and passes, we immediately push their result to both clients. No database needed for that." },
  { user: 'pk', text: "What about reconnection? If a player's connection drops mid-match, do they lose?" },
  { user: 'nk', text: "We give them a 30-second reconnect window. The room state is held in memory on the server. If they reconnect within 30s, they resume. After that, forfeit." },
  { user: 'pk', text: "Room state in memory is risky if the server restarts. Should we persist it somewhere?" },
  { user: 'nk', text: "We write room state to Redis with a 10-minute TTL. On reconnect, the server checks Redis first before declaring a forfeit." },
  { user: 'pk', text: "The question selection — do we pick randomly or do we track which questions a user has already seen?" },
  { user: 'nk', text: "We track seen questions per user in Postgres. When starting a match, we pick a question that neither player has seen before at the requested difficulty." },
  { user: 'pk', text: "What if there are no unseen questions left at that difficulty? The question bank will run dry for active users." },
  { user: 'nk', text: "We reset the seen list once a user has seen 80% of questions at a difficulty. Treat it like a deck — reshuffle when almost exhausted." },
  { user: 'pk', text: "For the code editor in the browser, are we building our own or using something off the shelf?" },
  { user: 'nk', text: "We embed Monaco Editor — same engine as VS Code. It gives us syntax highlighting, autocomplete, and keybindings for free." },
  { user: 'pk', text: "Monaco is heavy. Initial load is going to be slow on bad connections." },
  { user: 'nk', text: "We lazy-load it. The landing page and matchmaking screen load fast. Monaco only loads when the player is actually in a room and the match starts." },
  { user: 'pk', text: "One more thing — spectator mode. Can people watch a live match without playing?" },
  { user: 'nk', text: "Yes, spectators join the room WebSocket as read-only subscribers. They get all the same events but can't submit. We cap spectators at 50 per room." },
  { user: 'pk', text: "Alright. So the order is: WebSocket room system first, then code execution sandbox, then scoring, then leaderboard, then question bank tooling." },
  { user: 'nk', text: "Agreed. I'll start on the room and matchmaking WebSocket server. You set up the Firecracker microVM pool for execution." },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Logger — captures ALL output (stdout + stderr) to log file ───────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Manual Decision Extraction ──────────────────────────────────────────────
async function triggerDecisionAPI(projectId, messageId, text, username, discussionId) {
  const isDecision = /we will|we should|i'll write|in postgres|we need|let's use|we keep 5|we switch|we write/i.test(text);
  if (!isDecision) return;

  try {
    const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;
    const Decision = (await import('../models/Decision.js')).default;
    const ProjectState = (await import('../models/ProjectState.js')).default;
    const User = (await import('../models/User.js')).default;

    const user = await User.findOne({ username });

    const prompt = `You are normalizing a raw engineering conversation message into a clean decision record.
Speaker: ${username}
Raw message: "${text}"

Write a single clean declarative statement capturing the decision made. Rules:
- Start with a verb or technology name
- Maximum 15 words
- Never use first person
- Never quote the raw text verbatim
- If the message contains a clear reason, extract it as rationale separately

Return ONLY valid JSON with no markdown: {"text": "...", "rationale": "..."}
Rationale can be empty string if no clear reason given.`;

    const response = await AIOrchestrator.callProvider({
        requestId: require('crypto').randomUUID(),
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        prompt,
        projectId,
        userId: user._id,
        maxTokens: 1024
    });

    let parsed;
    try {
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch(e) {
      write('         ↳ error parsing LLM response\n');
      return;
    }

    const decision = await Decision.create({
      projectId,
      text: parsed.text,
      rationale: parsed.rationale || '',
      proposedBy: {
        userId: user._id,
        maxTokens: 1024,
        username
      },
      sourceMessageId: messageId,
      discussionId
    });

    // Rebuild pinned Context
    const allDecisions = await Decision.find({ projectId }).sort({ timestamp: 1 });
    const formattedDecisions = allDecisions.map((d, i) => `${i+1}. ${d.text} — ${d.proposedBy.username}`).join('. ');
    const pinnedCtx = `Key decisions: [${formattedDecisions}]`;
    await ProjectState.findOneAndUpdate(
      { projectId },
      { pinnedContext: pinnedCtx },
      { upsert: true }
    );
    write(`         ↳ decision saved manually: ${parsed.text.substring(0, 40)}\n`);
  } catch (err) {
    write(`         ↳ decision fail: ${err.message}\n`);
  }
}
const LOG_FILE = path.join(__dirname, '../../../simulate-codeduel.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

// Intercept all stdout/stderr so logger output is also captured
const origStdoutWrite = process.stdout.write.bind(process.stdout);
const origStderrWrite = process.stderr.write.bind(process.stderr);
process.stdout.write = (chunk, ...args) => { logStream.write(chunk); return origStdoutWrite(chunk, ...args); };
process.stderr.write = (chunk, ...args) => { logStream.write(chunk); return origStderrWrite(chunk, ...args); };

function write(line) { process.stdout.write(line); }
function log(msg) { write(`[simulate-codeduel] ${msg}\n`); }

async function getOrCreateUser(username) {
  const User = (await import('../models/User.js')).default;
  const existing = await User.findOne({ username }).lean();
  if (existing) { log(`Found existing user: ${username}`); return existing; }
  const result = await authService.register(username, `${username}@codeduel.test`, 'Test1234!');
  log(`Created user: ${username}`);
  return result.user;
}

async function main() {
  await connectDB();
  log('DB connected');

  if (RESET) {
    const deleted = await Project.deleteOne({ title: PROJECT_TITLE });
    if (deleted.deletedCount) log(`Deleted existing project "${PROJECT_TITLE}"`);
  }

  const nk = await getOrCreateUser('nk');
  const pk = await getOrCreateUser('pk');
  const userMap = { nk, pk };

  let project;
  const existing = await Project.findOne({ title: PROJECT_TITLE }).lean();
  if (existing) {
    project = existing;
    log(`Reusing existing project: ${project._id}`);
  } else {
    project = await projectService.createProject(PROJECT_TITLE, PROJECT_DESC, nk._id);
    log(`Created project: ${project._id}`);
  }

  try { await projectService.joinProject(project.inviteCode, pk._id); log('pk joined'); }
  catch { log('pk already a member'); }

  const discussions = await discussionService.getProjectDiscussions(project._id);
  let discussion = discussions.find(d => d.isMain) || discussions[0];
  if (!discussion) {
    discussion = await discussionService.createDiscussion(project._id, 'Main', '', nk._id, nk._id);
    log(`Created discussion: ${discussion._id}`);
  } else {
    log(`Using discussion: ${discussion._id}`);
  }

  try { await discussionService.joinDiscussion(discussion._id, pk._id); } catch { /* already in */ }

  const fullProject = await projectService.getProjectById(project._id);
  const llmConfig =  { provider: 'groq', model: 'llama-3.3-70b-versatile' };
  log(`LLM: ${llmConfig.provider}/${llmConfig.model}\n`);
  log(`Replaying ${CONVERSATION.length} messages (delay: ${DELAY_MS}ms)...\n`);

  for (let i = 0; i < CONVERSATION.length; i++) {
    const { user: username, text } = CONVERSATION[i];
    const user = userMap[username];

    const message = await discussionService.addMessage(
      discussion._id, project._id, user._id, username, text, false
    );

    write(`  [${String(i + 1).padStart(2, '0')}/${CONVERSATION.length}] ${username}: ${text.substring(0, 72)}...\n`);

    await triggerDecisionAPI(project._id, message._id, text, username, discussion._id);
    
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  log('\nDone. Open the dashboard to see results.');
  log(`Project ID: ${project._id}`);
  log(`Full log saved to: ${LOG_FILE}`);
  logStream.end();
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });


=== backend\src\scripts\simulations\1-healthsync-ideation.js ===

import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Ideation)',
  projectDesc: 'Ideation phase of a telemedicine app. Evaluates if the system correctly infers the "Ideation" stage.',
  usersToCreate,
  conversations: [...stage1_ideation]
}).catch(console.error);


=== backend\src\scripts\simulations\2-healthsync-planning.js ===

import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Planning)',
  projectDesc: 'Planning phase of a telemedicine app. Evaluates if the system correctly infers "Planning/Architecture" stage.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning]
}).catch(console.error);


=== backend\src\scripts\simulations\3-healthsync-development.js ===

import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Development)',
  projectDesc: 'Development phase of a telemedicine app. Evaluates if the system correctly infers the "Development" stage.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development]
}).catch(console.error);


=== backend\src\scripts\simulations\4-healthsync-testing.js ===

import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development, stage4_testing } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Testing)',
  projectDesc: 'Testing and QA phase of a telemedicine app. Evaluates if the system correctly infers the "Testing" stage.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development, ...stage4_testing]
}).catch(console.error);


=== backend\src\scripts\simulations\5-buildboard-full.js ===

import { runSimulation } from './buildboard-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development, stage4_testing, stage5_deployment } from './buildboard-data.js';

runSimulation({
  projectTitle: 'BuildBoard (Full)',
  projectDesc: 'Full lifecycle of a construction management app from ideation to launch. Evaluates the full trajectory of system stage inference and CI/CD/architecture discussions.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development, ...stage4_testing, ...stage5_deployment]
}).catch(console.error);


=== backend\src\scripts\simulations\5-healthsync-full.js ===

import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development, stage4_testing, stage5_deployment } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Full)',
  projectDesc: 'Full lifecycle of a telemedicine app from ideation to launch. Evaluates the full trajectory of system stage inference.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development, ...stage4_testing, ...stage5_deployment]
}).catch(console.error);


=== backend\src\scripts\simulations\buildboard-base.js ===

import 'dotenv/config';
import connectDB from '../../config/database.js';
import authService from '../../services/authService.js';
import projectService from '../../services/projectService.js';
import discussionService from '../../services/discussionService.js';
import AIOrchestrator from '../../core/orchestrator/AIOrchestrator.js';
import Project from '../../models/Project.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runSimulation({ projectTitle, projectDesc, usersToCreate, conversations }) {
  const args = process.argv.slice(2);
  const DELAY_MS = parseInt(process.env.DELAY_MS ?? args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '800', 10);
  const RESET = process.env.RESET === 'true' || args.includes('--reset');

  const normalizedTitle = projectTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const LOG_FILE = path.join(__dirname, `../../../simulate-${normalizedTitle}.log`);
  
// ─── Manual Decision Extraction ──────────────────────────────────────────────
async function triggerDecisionAPI(projectId, messageId, text, username, discussionId) {

  try {
    const AIOrchestrator = (await import('../../core/orchestrator/AIOrchestrator.js')).default;
    const Decision = (await import('../../models/Decision.js')).default;
    const ProjectState = (await import('../../models/ProjectState.js')).default;
    const User = (await import('../../models/User.js')).default;

    const user = await User.findOne({ username });

    const prompt = `You are normalizing a raw engineering conversation message into a clean decision record.
Speaker: ${username}
Raw message: "${text}"

Write a single clean declarative statement capturing the decision made. Rules:
- Start with a verb or technology name
- Maximum 15 words
- Never use first person
- Never quote the raw text verbatim
- If the message contains a clear reason, extract it as rationale separately

Return ONLY valid JSON with no markdown: {"text": "...", "rationale": "..."}
Rationale can be empty string if no clear reason given.`;

    const response = await AIOrchestrator.callProvider({
        requestId: crypto.randomUUID(),
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        systemPrompt: 'You are an AI decision extractor.',
        prompt,
        projectId,
        userId: user._id,
        maxTokens: 1024
    });

    let parsed;
    try {
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch(e) {
      write('         ↳ error parsing LLM response\n');
      return;
    }

    const decision = await Decision.create({
      projectId,
      text: parsed.text,
      rationale: parsed.rationale || '',
      proposedBy: {
        userId: user._id,
        maxTokens: 1024,
        username
      },
      sourceMessageId: messageId,
      discussionId
    });

    // Rebuild pinned Context
    const allDecisions = await Decision.find({ projectId }).sort({ timestamp: 1 });
    const formattedDecisions = allDecisions.map((d, i) => `${i+1}. ${d.text} — ${d.proposedBy.username}`).join('. ');
    const pinnedCtx = `Key decisions: [${formattedDecisions}]`;
    await ProjectState.findOneAndUpdate(
      { projectId },
      { pinnedContext: pinnedCtx },
      { upsert: true }
    );
    write(`         ↳ decision saved manually: ${parsed.text.substring(0, 40)}\n`);
  } catch (err) {
    write(`         ↳ decision fail: ${err.message}\n`);
  }
}


const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk, ...args) => { logStream.write(chunk); return origStdoutWrite(chunk, ...args); };
  process.stderr.write = (chunk, ...args) => { logStream.write(chunk); return origStderrWrite(chunk, ...args); };

  function write(line) { process.stdout.write(line); }
  function log(msg) { write(`[simulate-buildboard] ${msg}\n`); }

  async function getOrCreateUser(username) {
    const User = (await import('../../models/User.js')).default;
    const existing = await User.findOne({ username }).lean();
    if (existing) { log(`Found existing user: ${username}`); return existing; }
    const result = await authService.register(username, `${username}@buildboard.test`, 'Test1234!');
    log(`Created user: ${username}`);
    return result.user;
  }

  await connectDB();
  log('DB connected');

  if (RESET) {
    const deleted = await Project.deleteOne({ title: projectTitle });
    if (deleted.deletedCount) log(`Deleted existing project "${projectTitle}"`);
  }

  const userMap = {};
  for (const username of usersToCreate) {
    userMap[username] = await getOrCreateUser(username);
  }

  const mainUser = userMap[usersToCreate[0]];

  let project;
  const existing = await Project.findOne({ title: projectTitle }).lean();
  if (existing) {
    project = existing;
    log(`Reusing existing project: ${project._id}`);
  } else {
    project = await projectService.createProject(projectTitle, projectDesc, mainUser._id);
    log(`Created project: ${project._id}`);
  }

  // Join other users
  for (let i = 1; i < usersToCreate.length; i++) {
    const u = userMap[usersToCreate[i]];
    try { await projectService.joinProject(project.inviteCode, u._id); log(`${usersToCreate[i]} joined project`); }
    catch { log(`${usersToCreate[i]} already a member`); }
  }

  // Find or create discussion threads
  const existingDiscussions = await discussionService.getProjectDiscussions(project._id);
  const threadsMap = {};

  // For each required thread in conversations
  const { threadSummaries } = await import('./buildboard-data.js');
  const requiredThreads = [...new Set(conversations.map(c => c.thread))];

  for (const threadName of requiredThreads) {
    let disc = existingDiscussions.find(d => d.title === threadName || (threadName === 'Main' && d.isMain));
    if (!disc) {
      const summaryContent = (threadSummaries && threadSummaries[threadName])
        ? threadSummaries[threadName]
        : `Discussion thread focused on ${threadName} implementation details`;
      disc = await discussionService.createDiscussion(project._id, threadName, summaryContent, mainUser._id, mainUser._id);
      log(`Created discussion thread: ${threadName} (${disc._id})`);
    } else {
      log(`Using discussion thread: ${threadName} (${disc._id})`);
    }
    threadsMap[threadName] = disc;

    // Join all users to this discussion
    for (const username of usersToCreate) {
      const u = userMap[username];
      try { await discussionService.joinDiscussion(disc._id, u._id); } catch { /* already in */ }
    }
  }

  const llmConfig = { provider: 'groq', model: 'llama-3.3-70b-versatile' };
  log(`LLM: ${llmConfig.provider}/${llmConfig.model}\n`);
  log(`Replaying ${conversations.length} messages (delay: ${DELAY_MS}ms)...\n`);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const Message = (await import('../../models/Message.js')).default;
  const Discussion = (await import('../../models/Discussion.js')).default;
  const now = Date.now();
  const startTime = now - (30 * 24 * 60 * 60 * 1000);
  const timeStep = Math.floor((30 * 24 * 60 * 60 * 1000) / (conversations.length || 1));

  for (let i = 0; i < conversations.length; i++) {
    const { thread, user: username, text, isDecision } = conversations[i];
    const user = userMap[username];
    const discussion = threadsMap[thread];

    const simulatedTime = new Date(startTime + (i * timeStep));
    const message = await discussionService.addMessage(
      discussion._id, project._id, user._id, username, text, false
    );
    await Message.findByIdAndUpdate(message._id, { timestamp: simulatedTime });
    await Discussion.findByIdAndUpdate(discussion._id, { lastActivity: simulatedTime });

    write(`  [${String(i + 1).padStart(2, '0')}/${conversations.length}] [${thread}] ${username}: ${text.substring(0, 72)}...\n`);

    if (isDecision) {
      await triggerDecisionAPI(project._id, message._id, text, username, discussion._id);
    }
    
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const mainDisc = threadsMap['Main'];
  if (mainDisc) {
    const aiService = (await import('../../services/aiService.js')).default;
    const summaryService = (await import('../../services/summaryService.js')).default;

    for (const [threadName, disc] of Object.entries(threadsMap)) {
      if (threadName === 'Main') continue;

      log(`Summarizing ${threadName} conversation...`);
      try {
        const summaryContent = await aiService.generateSummary(
          project._id,
          disc._id,
          llmConfig,
          `Summarize the key architectural and technical decisions in this ${threadName} thread.`
        );

        const savedSummary = await summaryService.createSummary(
          project._id,
          disc._id,
          summaryContent,
          'discussion',
          llmConfig.provider,
          await Message.countDocuments({ discussionId: disc._id })
        );

      } catch (err) {
        log(`Failed to summarize ${threadName}: ${err.message}`);
      }
    }
  }

  log('\nDone. Open the dashboard to see results.');
  log(`Project ID: ${project._id}`);
  log(`Full log saved to: ${LOG_FILE}`);
  logStream.end();
  setTimeout(() => process.exit(0), 100);
}


=== backend\src\scripts\simulations\buildboard-data.js ===

export const usersToCreate = ['Nikunj', 'Digambar', 'Aarya', 'Prathamesh', 'Adarsh'];

export const threadSummaries = {
  'Frontend': 'Focuses on React+Vite setup, state management, component library integration, and UI design for the dashboard.',
  'Backend': 'Focuses on the Node.js API, database schema, transaction management, query optimization, and authentication strategy.',
  'Infrastructure': 'Handles AWS cloud deployment, ECS Fargate configuration, CI/CD with GitHub Actions, and system monitoring.',
  'Integrations': 'Dedicated to third-party integrations like payment gateways (Stripe) and compliance document signing (DocuSign/HelloSign).',
  'Testing': 'Dedicated to QA cycles, Cypress end-to-end testing, security vulnerability scanning, and load testing.'
};

export const stage1_ideation = [
  { thread: 'Main', user: 'Nikunj', text: 'Hey team, let\'s kick off the BuildBoard project today. The goal is to build a B2B SaaS platform for construction companies to manage projects, subcontractors, bids, and compliance documents.' },
  { thread: 'Main', user: 'Digambar', text: 'Exciting. What\'s the core flow for a subcontractor?' },
  { thread: 'Main', user: 'Nikunj', text: 'Subcontractors will log in, view available projects, submit financial bids, and upload their compliance/insurance documents for approval.' },
  { thread: 'Main', user: 'Prathamesh', text: 'For the compliance documents, do we require third-party verification?' },
  { thread: 'Main', user: 'Nikunj', text: 'Yes, but that\'s a tricky area.' },
  { thread: 'Main', user: 'Aarya', text: 'If we use a third-party API for all compliance checks, we need to think about GDPR carefully. If we send PII outward without proper consent mechanisms, it could become a compliance nightmare.' },
  { thread: 'Main', user: 'Prathamesh', text: 'Good point. We might want to keep the primary document storage on our end and only send hashed data or specific public metadata for verification?' },
  { thread: 'Main', user: 'Nikunj', text: 'Exactly. Let\'s keep storage local to our S3 buckets. Meanwhile, we need to decide on our database architecture.' },
  { thread: 'Main', user: 'Adarsh', text: 'Are we leaning towards a microservices approach to let bids scale independently?' },
  { thread: 'Main', user: 'Nikunj', text: 'A monolith might be better for v1 speed, but let\'s debate the DB first.' },
  { thread: 'Main', user: 'Digambar', text: 'What about MongoDB? It is great for the flexibility we might need if compliance documents have completely unpredictable metadata formats.' },
  { thread: 'Main', user: 'Nikunj', text: 'Given we need complex relational queries across projects, subcontractors, and bids with strict consistency, I think Postgres is the right call here.' },
  { thread: 'Main', user: 'Digambar', text: 'What about the document flexibility we were just talking about for compliance files?' },
  { thread: 'Main', user: 'Nikunj', text: 'We can use JSONB columns in Postgres for that — we get both relational integrity and document flexibility.', isDecision: true },
  { thread: 'Main', user: 'Prathamesh', text: 'Agreed, and it makes our automated backup strategy dramatically simpler too.' },
  { thread: 'Main', user: 'Aarya', text: 'I\'ll handle the initial VPC and DB setup then. Are we choosing AWS or GCP?' },
  { thread: 'Main', user: 'Nikunj', text: 'AWS makes the most sense since our organization\'s existing billing/tooling is all there.', isDecision: true },
  { thread: 'Main', user: 'Aarya', text: 'Sounds good. I will check the strict IAM roles we need to manage S3 bucket access.' },
  { thread: 'Main', user: 'Digambar', text: 'Should we consider a mobile app immediately? Construction workers are mostly on-site.' },
  { thread: 'Main', user: 'Nikunj', text: 'Absolutely in the future, but out of scope for MVP. We will build a highly responsive web app first.' },
  { thread: 'Main', user: 'Adarsh', text: 'How will we handle authentication? Subcontractors seeing other subcontractors\' bids would be a critical failure.' },
  { thread: 'Main', user: 'Nikunj', text: 'That\'s vital. We\'ll nail down the auth and RBAC strategy in the Backend thread.' },
  { thread: 'Main', user: 'Prathamesh', text: 'I\'ll also start looking at Stripe for the system subscription model so companies can pay for full platform access.' },
  { thread: 'Main', user: 'Aarya', text: 'And I will draft the initial infrastructure layout diagram.' },
  { thread: 'Main', user: 'Nikunj', text: 'Perfect. Let\'s split our technical deep-dives into Backend, Frontend, Infrastructure, and Integrations threads right now.' },
  { thread: 'Main', user: 'Digambar', text: 'I\'ll set up the Frontend thread to finalize our UI stack choices.' }
];

export const stage2_planning = [
  { thread: 'Backend', user: 'Nikunj', text: 'Let\'s finalize the backend DB and architecture.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'I still feel MongoDB\'s aggregation pipeline could handle generating our complex project dashboards really well.' },
  { thread: 'Backend', user: 'Nikunj', text: 'The problem is transactional guarantees across bids and project budgets. A bid acceptance must atomically update the project\'s financial totals. I explicitly reject MongoDB for this because managing multi-document ACID transactions under high load might lead to race conditions.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'That makes total sense. Postgres with JSONB it is.', isDecision: true },
  { thread: 'Backend', user: 'Nikunj', text: 'For API design, should we implement GraphQL or REST?' },
  { thread: 'Backend', user: 'Digambar', text: 'REST is standard, but a GraphQL layer helps the frontend avoid overfetching for those really complex project summary screens.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Let\'s stick to REST for MVP to guarantee fast delivery. We can introduce a GraphQL BFF layer later if overfetching becomes an issue.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'What about the auth strategy? Stateful sessions in Redis or stateless JWTs?' },
  { thread: 'Backend', user: 'Nikunj', text: 'I prefer short-lived JWTs paired with refresh tokens stored in httpOnly secure cookies. It mitigates XSS and CSRF risks while maintaining stateless scalability.', isDecision: true },
  { thread: 'Backend', user: 'Prathamesh', text: 'I will implement that exact auth flow today.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Moving to our framework choice: Next.js vs raw React with Vite.' },
  { thread: 'Frontend', user: 'Adarsh', text: 'Next.js gives us robust SSR, which might be useful for SEO if we have public-facing project bidding pages.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Actually, BuildBoard is almost entirely authenticated behind a login wall. SEO isn\'t a priority for the app itself. Vite will give us significantly faster build times locally.' },
  { thread: 'Frontend', user: 'Nikunj', text: 'Agreed on Vite. What about frontend state management? Redux?', isDecision: true },
  { thread: 'Frontend', user: 'Digambar', text: 'Redux involves too much boilerplate. I propose Zustand for global state, and React Query specifically for server caching.', isDecision: true },
  { thread: 'Frontend', user: 'Adarsh', text: 'Sounds solid. And component library?' },
  { thread: 'Frontend', user: 'Digambar', text: 'Let\'s use Tailwind CSS with Shadcn UI. It gives us fully accessible components that we can heavily customize without fighting rigid default styles.', isDecision: true },
  { thread: 'Frontend', user: 'Nikunj', text: 'Excellent choices. Digambar, you draft the initial dashboard shell.' },
  { thread: 'Frontend', user: 'Digambar', text: 'I\'ll scaffold the repository and push the base layout by tonight.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'AWS setup is underway. For our container strategy, are we leaning towards EKS (Kubernetes) or ECS?' },
  { thread: 'Infrastructure', user: 'Nikunj', text: 'EKS is probably overkill for our current engineering footprint. ECS with Fargate gives us serverless Docker execution without the control plane maintenance.', isDecision: true },
  { thread: 'Infrastructure', user: 'Aarya', text: 'ECS on Fargate it is. I\'ll write the Terraform modules for the target groups and the ECS cluster.' },
  { thread: 'Infrastructure', user: 'Adarsh', text: 'What about CI/CD? Are we spinning up Jenkins or using a hosted service?' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Jenkins is a headache. Let\'s establish our CI/CD pipeline purely through GitHub Actions. We can build images, push to ECR, and trigger ECS service updates.', isDecision: true },
  { thread: 'Infrastructure', user: 'Nikunj', text: 'Sounds robust. We must have strict network separation between staging and production.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'I will provision completely isolated VPCs across different subnets. Adarsh, can you outline the QA environments you need?' },
  { thread: 'Infrastructure', user: 'Adarsh', text: 'Just one staging environment that mirrors prod architecture exactly is fine for now.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Noted.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'We need to decide on a document signing integration for the subcontractor compliance forms.' },
  { thread: 'Integrations', user: 'Nikunj', text: 'Could we use DocuSign\'s embedded signing API?' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Yes, but integrating their webhooks local testing can be painful.' },
  { thread: 'Integrations', user: 'Nikunj', text: 'We need to definitively establish how we consume document status updates. A background cron job polling their API, or processing webhooks?' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Without a queue, relying purely on real-time webhooks is dangerous; if our API drops, we lose signature events entirely.' },
  { thread: 'Integrations', user: 'Aarya', text: 'Let\'s put an SQS queue in front of our webhook receiver to guarantee event delivery.' },
  { thread: 'Integrations', user: 'Nikunj', text: 'Yes. Without an event buffer, a massive burst of document signatures from multiple projects could overwhelm our database workers.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Let\'s resolve webhook vs polling then: we will use webhooks backed strictly by SQS instead of cron polling.', isDecision: true },
  { thread: 'Integrations', user: 'Nikunj', text: 'Perfect. We also need standard AWS S3 logic for general blueprint PDF uploads.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'I will handle generating those S3 pre-signed URLs.' },
  { thread: 'Integrations', user: 'Digambar', text: 'Prathamesh, please ensure the Swagger docs for those endpoints are updated so I can integrate them.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'I\'ll publish the Swagger spec this afternoon.' },
  { thread: 'Main', user: 'Nikunj', text: 'Plans are locked in guys. Let\'s move to the development phase.' }
];

export const stage3_development = [
  { thread: 'Main', user: 'Nikunj', text: 'Sprint 1 Development begins now. Keep cross-team blockers visible here.' },
  { thread: 'Backend', user: 'Nikunj', text: 'I have pushed the initial relational schema for Projects, Subcontractors, and Bids.' },
  { thread: 'Frontend', user: 'Digambar', text: 'I\'ve started hitting the local backend, but I am facing severe CORS errors when POSTing to `/api/auth/login`.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Ah, my bad. My Express middleware is blocking the Vite default port 5173. I\'ll add it to the CORS whitelist immediately.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Thanks. CORS is fixed, I can log in locally.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'The DocuSign webhook receiver is functional. I am catching events using ngrok right now.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'The staging ECS cluster has been created. The Terraform apply went smoothly.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Prathamesh, please review my PR for the Bid submission controller.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'Wait, I found a severe race condition in the Bid submission endpoint. If two subcontractors submit a bid for the exact same project time slot slot at the same millisecond, the availability check might pass for both before either transaction commits.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Without an explicit table lock or unique constraint on the slot column, they could both reserve it. Good catch.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'I will implement an EXCLUDE constraint on the table using tsrange to prevent overlapping time segments entirely at the database level.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Fantastic. I\'m shifting focus to the hierarchical project dashboard query.' },
  { thread: 'Frontend', user: 'Digambar', text: 'I built the project dashboard table, but the `/api/projects/all` endpoint takes almost 4.5 seconds to respond. That\'s a show-stopping performance bottleneck.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Let me look at the APM logs. Yikes, the ORM is triggering an N+1 query. It is sequentially looking up subcontractor profile details for every single bid attached to the projects.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Actually, we\'re switching from TypeORM\'s lazy loading to explicit query builders with INNER JOINs because this automatic eager loading is killing our database CPU and stalling response times.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'I can help optimize those. We could use a lateral join to only fetch the top 3 competitive bids per subcontractor natively in SQL.' },
  { thread: 'Backend', user: 'Nikunj', text: 'I have pushed a rewrite of that controller using explicit joins. Digambar, query the endpoint again.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Response time is down to ~250ms. Much better.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Hey guys, I noticed a major security concern while reviewing network traffic on staging. The S3 pre-signed URLs for blueprint downloads are set with a TTL of 7 days. If a URL is leaked, anyone can view sensitive docs.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'That\'s a dangerous oversight. I will drop the expiration duration to exactly 15 minutes immediately.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Appreciate the fast turnaround on that security patch.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'I\'ve hit a brick wall with DocuSign. Their composite templates API throws vague 400 errors whenever we try to dynamically append our custom checklist to the standard construction NDA.' },
  { thread: 'Integrations', user: 'Nikunj', text: 'Did their developer support offer any workarounds?' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'They claim it\'s a limitation of our Sandbox API plan, and the workaround is incredibly complex.' },
  { thread: 'Integrations', user: 'Nikunj', text: 'We cannot let this block compliance testing. Actually, instead of DocuSign we\'re going with HelloSign (Dropbox Sign) for MVP. I reviewed their docs and their embedded signing mechanism handles dynamic custom fields way better.', isDecision: true },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Alright, ripping out the DocuSign SDK and pivoting the entire integration to HelloSign today.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Does HelloSign provide a React SDK for the embedded frames?' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Yes, they have a dedicated package out of the box. I will post the integration snippet in your thread.' },
  { thread: 'Frontend', user: 'Digambar', text: 'I am working on the generic document viewer UI for blueprints now. Should I load the PDFs into an iframe natively or use a parser library?' },
  { thread: 'Frontend', user: 'Adarsh', text: 'Without a proper renderer, a browser iframe might outright crash on iPhones. Some of those construction blueprints are 60MB+.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Good point. I\'ll implement react-pdf with virtualized rendering so it only mounts the exact pages currently visible on screen.', isDecision: true },
  { thread: 'Infrastructure', user: 'Aarya', text: 'I linked GitHub Actions to sync the Vite build output to our S3 edge bucket, fronted by CloudFront.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Wait, hard refreshing the app on staging returns a 404 Access Denied.' },
  { thread: 'Frontend', user: 'Digambar', text: 'That happens with SPAs. You need to configure the CloudFront distribution to gracefully fallback to `index.html` on 404 errors.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'CloudFront custom error responses updated. Refreshing works now.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Prathamesh, is the Stripe integration for organization subscriptions functional?' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Mostly done. The `invoice.payment_succeeded` webhook is actively upgrading the tenant\'s tier in the database.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Does the controller handle arbitrary retries? Stripe occasionally duplicates webhook event dispatches.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Without an idempotency key check on the webhook processor, we might process a subscription upgrade multiple times, skewing internal metrics.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Let\'s create a `processed_stripe_events` table just to log and skip duplicate IDs permanently.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'I will write that migration now.' },
  { thread: 'Frontend', user: 'Digambar', text: 'The auth flow on staging keeps intermittently rejecting users with an "Invalid Token" response just milliseconds after successful login.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Are the staging UI and staging API on different subdomains? Yes, `staging.buildboard.com` and `api.staging.buildboard.com`.' },
  { thread: 'Backend', user: 'Nikunj', text: 'The default `SameSite=Strict` cookie policy is blocking the cross-subdomain handoff. I\'ll deploy a fix pushing it to `SameSite=Lax`.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Tested. The token handoff is perfectly stable now.' },
  { thread: 'Testing', user: 'Adarsh', text: 'I am adding our initial Cypress end-to-end specs. Cypress is constantly flaking out on the HelloSign iframe rendering though.' },
  { thread: 'Testing', user: 'Adarsh', text: 'It\'s throwing cross-origin frame isolation errors during the test runs.' },
  { thread: 'Frontend', user: 'Digambar', text: 'I can inject a mock configuration for the HelloSign SDK during standard `NODE_ENV=test` runs so it bypasses the iframe and resolves the promise directly.', isDecision: true },
  { thread: 'Testing', user: 'Adarsh', text: 'That will stabilize the test suite. Please add that mock.' },
  { thread: 'Main', user: 'Nikunj', text: 'Excellent progress. Development for v1 is functionally complete. Moving strictly to Testing phase.' },
  { thread: 'Main', user: 'Aarya', text: 'Infrastructure is primed for formal load testing when you guys are ready.' }
];

export const stage4_testing = [
  { thread: 'Testing', user: 'Adarsh', text: 'Kicking off the formal QA cycle. The comprehensive Cypress e2e suites are executing.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Cypress found our first bug during the automated file upload run. When uploading a 20MB compliance archive, the UI just hangs indefinitely.' },
  { thread: 'Frontend', user: 'Digambar', text: 'The Axios interceptor isn\'t tracking the raw upload progress correctly. I will bind the `onUploadProgress` event handler to the Shadcn UI progress bar.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Wait, ensure the Nginx proxy routing to our ECS containers has `client_max_body_size 50M` configured, otherwise it simply drops large payloads silently.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Updating the ECS task definition and Nginx configurations now to permit 50MB uploads.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Retested with Cypress. The progress bar renders and the file completes successfully.' },
  { thread: 'Testing', user: 'Adarsh', text: 'I just finished running the K6 load tests against staging. I simulated 2500 concurrent users accessing different project dashboards.' },
  { thread: 'Testing', user: 'Adarsh', text: 'The `GET /api/projects/search` endpoint tanked completely. Response times hit 8.5 seconds at peak.' },
  { thread: 'Backend', user: 'Nikunj', text: '8.5 seconds? Checking the Datadog APM traces now.' },
  { thread: 'Backend', user: 'Nikunj', text: 'The bottleneck is the complex regex text search traversing project descriptions and subcontractor tags. It\'s triggering a massive sequential table scan.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'We explicitly decided against implementing Elasticsearch earlier to save infrastructure complexity. Should we spin up an ES cluster now?' },
  { thread: 'Backend', user: 'Nikunj', text: 'Actually, this isn\'t working, moving to PostgreSQL\'s native `tsvector` full-text search capability instead of basic `ILIKE` queries. It gives us highly indexed search speeds without the massive overhead of managing an Elasticsearch cluster.', isDecision: true },
  { thread: 'Backend', user: 'Prathamesh', text: 'I will write the migration to add the `tsvector` columns and deploy a GIN index on them.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Ping me the moment that GIN index migration is applied to staging.' },
  { thread: 'Backend', user: 'Nikunj', text: 'The migration just finished executing. Try the K6 suite again.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Mind-blowing. Response time on identical load is now hovering around 120ms at p95. The GIN index crushed the bottleneck.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Moving to deep security testing. I\'m running automated penetration tools against our REST controllers.' },
  { thread: 'Testing', user: 'Adarsh', text: 'I found a critical security vulnerability. The `GET /api/bids/:id` endpoint does not verify if the JWT user is actually an owner or associated subcontractor for that specific bid. That\'s a severe IDOR.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Wow. That is a terrible oversight. A malicious user could iterate bid IDs indefinitely and expose competitor pricing.' },
  { thread: 'Backend', user: 'Nikunj', text: 'I am rewriting the RBAC middleware on that controller right now to strictly verify tenant ownership before returning the resource data.', isDecision: true },
  { thread: 'Backend', user: 'Nikunj', text: 'Patch deployed. Adarsh, verify the IDOR loophole is closed.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Retesting sequence... I am receiving a 403 Forbidden with a separate tenant\'s token. Flaw is closed.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'I noticed a major UX flaw while doing manual notification checks. The system emails subcontractors instantly on every single compliance document update. On large projects, this spams dozens of emails.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Without a debounce mechanism, AWS SES will likely throttle our sending limits and mark us as a spam domain.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'We originally chose instant transaction emails during planning, but we need to revisit this architectural decision. A daily digest batch job is much safer and less annoying.', isDecision: true },
  { thread: 'Backend', user: 'Nikunj', text: 'Agreed. A daily digest changes the architecture slightly but protects our reputation.' },
  { thread: 'Backend', user: 'Prathamesh', text: 'I will refactor the Redis worker to aggregate states and dispatch summary emails at 5 PM local.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Found a subtle interaction bug on iPads. The draggable Kanban cards in the project board view lock up completely when touched.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Resolved it. Had to forcefully apply `touch-action: none` to the CSS handle, otherwise iOS Safari intercepts the drag and tries to pan the viewport instead.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Final regression tests are executing.' },
  { thread: 'Testing', user: 'Adarsh', text: 'All 340 Cypress tests are marked green.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Load tests show completely sustained stability at 4500 RPS.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Zero high severity CWEs from the pipeline dependency checks.' },
  { thread: 'Main', user: 'Nikunj', text: 'Phenomenal effort debugging everything, team.' },
  { thread: 'Main', user: 'Aarya', text: 'I am formally locking environments. We are clear for production.' }
];

export const stage5_deployment = [
  { thread: 'Infrastructure', user: 'Aarya', text: 'Initiating the production deployment sequence right now. The `main` branch is hard-locked.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Provisioning the massive Production RDS instances. Multi-AZ is fully active and read replicas are spinning up.' },
  { thread: 'Backend', user: 'Nikunj', text: 'I am manually executing the core database schema migrations against the production cluster.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Migrations committed. All 34 tables generated flawlessly.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'Deploying the ECS Fargate tasks for the API controllers and our background worker fleets.' },
  { thread: 'Frontend', user: 'Digambar', text: 'Production Vite payload triggered. GitHub Actions is uploading the bundle to the S3 edge bucket.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'I am switching the Stripe and HelloSign credentials from sandbox keys to live keys inside AWS Secrets Manager.' },
  { thread: 'Backend', user: 'Nikunj', text: 'The API load balancer health checks are all returning solid 200 OKs.' },
  { thread: 'Frontend', user: 'Digambar', text: 'The CloudFront edge cache invalidation finished. The buildboard.com frontend is officially live worldwide.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Awesome. I am running a highly targeted smoke test suite directly against production using our internal beta organization.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Hold on. The paid tier subscription creation is 500ing on the checkout return flow.' },
  { thread: 'Backend', user: 'Nikunj', text: 'Let me tail the Datadog logs. It says "Stripe Webhook signature verification failed".' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Oh man. I forgot to generate a separate Stripe Webhook Signing Secret specifically for the Live environment. The API is still validating incoming production webhooks using the test-mode secret string.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'I\'ll update the `STRIPE_WEBHOOK_SECRET` key in Secrets Manager immediately.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'I am forcing a rolling restart on the API ECS cluster to pull the new secrets into memory.' },
  { thread: 'Integrations', user: 'Prathamesh', text: 'Restart is finished. Adarsh, please trigger checkout again.' },
  { thread: 'Testing', user: 'Adarsh', text: 'Checkout is successful. The Stripe invoice webhook fired correctly and upgraded the test org to Pro tier. Production issue is fully resolved.' },
  { thread: 'Infrastructure', user: 'Aarya', text: 'I am mapping the PagerDuty on-call shifts to our new Datadog APM monitors to ensure we catch any further crashes in seconds.' },
  { thread: 'Frontend', user: 'Digambar', text: 'The Sentry dashboard is gorgeously quiet. Absolutely zero client-side exceptions bubbling up from real users.' },
  { thread: 'Main', user: 'Nikunj', text: 'Incredibly proud of everyone. BuildBoard MVP is officially launched.' },
  { thread: 'Main', user: 'Digambar', text: 'Stellar work folks! Going offline to sleep for a week.' },
  { thread: 'Main', user: 'Aarya', text: 'The platform architecture really paid off. Aarya signing off.' },
  { thread: 'Main', user: 'Adarsh', text: 'The QA board is empty. Great stability team. Adarsh signing off.' },
  { thread: 'Main', user: 'Prathamesh', text: 'Integrations are completely solid. Signing off.' }
];

export const allConversations = [
  ...stage1_ideation,
  ...stage2_planning,
  ...stage3_development,
  ...stage4_testing,
  ...stage5_deployment
];


=== backend\src\scripts\simulations\healthsync-base.js ===

import 'dotenv/config';
import connectDB from '../../config/database.js';
import authService from '../../services/authService.js';
import projectService from '../../services/projectService.js';
import discussionService from '../../services/discussionService.js';
import AIOrchestrator from '../../core/orchestrator/AIOrchestrator.js';
import Project from '../../models/Project.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runSimulation({ projectTitle, projectDesc, usersToCreate, conversations }) {
  const args = process.argv.slice(2);
  const DELAY_MS = parseInt(process.env.DELAY_MS ?? args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '800', 10);
  const RESET = process.env.RESET === 'true' || args.includes('--reset');

  const normalizedTitle = projectTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const LOG_FILE = path.join(__dirname, `../../../simulate-${normalizedTitle}.log`);
  
// ─── Manual Decision Extraction ──────────────────────────────────────────────
async function triggerDecisionAPI(projectId, messageId, text, username, discussionId) {

  try {
    const AIOrchestrator = (await import('../../core/orchestrator/AIOrchestrator.js')).default;
    const Decision = (await import('../../models/Decision.js')).default;
    const ProjectState = (await import('../../models/ProjectState.js')).default;
    const User = (await import('../../models/User.js')).default;

    const user = await User.findOne({ username });

    const prompt = `You are normalizing a raw engineering conversation message into a clean decision record.
Speaker: ${username}
Raw message: "${text}"

Write a single clean declarative statement capturing the decision made. Rules:
- Start with a verb or technology name
- Maximum 15 words
- Never use first person
- Never quote the raw text verbatim
- If the message contains a clear reason, extract it as rationale separately

Return ONLY valid JSON with no markdown: {"text": "...", "rationale": "..."}
Rationale can be empty string if no clear reason given.`;

    const response = await AIOrchestrator.callProvider({
        requestId: crypto.randomUUID(),
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        systemPrompt: 'You are an AI decision extractor.',
        prompt,
        projectId,
        userId: user._id,
        maxTokens: 1024
    });

    let parsed;
    try {
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch(e) {
      write('         ↳ error parsing LLM response\n');
      return;
    }

    const decision = await Decision.create({
      projectId,
      text: parsed.text,
      rationale: parsed.rationale || '',
      proposedBy: {
        userId: user._id,
        maxTokens: 1024,
        username
      },
      sourceMessageId: messageId,
      discussionId
    });

    // Rebuild pinned Context
    const allDecisions = await Decision.find({ projectId }).sort({ timestamp: 1 });
    const formattedDecisions = allDecisions.map((d, i) => `${i+1}. ${d.text} — ${d.proposedBy.username}`).join('. ');
    const pinnedCtx = `Key decisions: [${formattedDecisions}]`;
    await ProjectState.findOneAndUpdate(
      { projectId },
      { pinnedContext: pinnedCtx },
      { upsert: true }
    );
    write(`         ↳ decision saved manually: ${parsed.text.substring(0, 40)}\n`);
  } catch (err) {
    write(`         ↳ decision fail: ${err.message}\n`);
  }
}


const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk, ...args) => { logStream.write(chunk); return origStdoutWrite(chunk, ...args); };
  process.stderr.write = (chunk, ...args) => { logStream.write(chunk); return origStderrWrite(chunk, ...args); };

  function write(line) { process.stdout.write(line); }
  function log(msg) { write(`[simulate-healthsync] ${msg}\n`); }

  async function getOrCreateUser(username) {
    const User = (await import('../../models/User.js')).default;
    const existing = await User.findOne({ username }).lean();
    if (existing) { log(`Found existing user: ${username}`); return existing; }
    const result = await authService.register(username, `${username}@healthsync.test`, 'Test1234!');
    log(`Created user: ${username}`);
    return result.user;
  }

  await connectDB();
  log('DB connected');

  if (RESET) {
    const deleted = await Project.deleteOne({ title: projectTitle });
    if (deleted.deletedCount) log(`Deleted existing project "${projectTitle}"`);
  }

  const userMap = {};
  for (const username of usersToCreate) {
    userMap[username] = await getOrCreateUser(username);
  }

  const mainUser = userMap[usersToCreate[0]];

  let project;
  const existing = await Project.findOne({ title: projectTitle }).lean();
  if (existing) {
    project = existing;
    log(`Reusing existing project: ${project._id}`);
  } else {
    project = await projectService.createProject(projectTitle, projectDesc, mainUser._id);
    log(`Created project: ${project._id}`);
  }

  // Join other users
  for (let i = 1; i < usersToCreate.length; i++) {
    const u = userMap[usersToCreate[i]];
    try { await projectService.joinProject(project.inviteCode, u._id); log(`${usersToCreate[i]} joined project`); }
    catch { log(`${usersToCreate[i]} already a member`); }
  }

  // Find or create discussion threads
  const existingDiscussions = await discussionService.getProjectDiscussions(project._id);
  const threadsMap = {};

  // For each required thread in conversations
  const { threadSummaries } = await import('./healthsync-data.js');
  const requiredThreads = [...new Set(conversations.map(c => c.thread))];

  for (const threadName of requiredThreads) {
    let disc = existingDiscussions.find(d => d.title === threadName || (threadName === 'Main' && d.isMain));
    if (!disc) {
      const summaryContent = (threadSummaries && threadSummaries[threadName])
        ? threadSummaries[threadName]
        : `Discussion thread focused on ${threadName} implementation details`;
      disc = await discussionService.createDiscussion(project._id, threadName, summaryContent, mainUser._id, mainUser._id);
      log(`Created discussion thread: ${threadName} (${disc._id})`);
    } else {
      log(`Using discussion thread: ${threadName} (${disc._id})`);
    }
    threadsMap[threadName] = disc;

    // Join all users to this discussion
    for (const username of usersToCreate) {
      const u = userMap[username];
      try { await discussionService.joinDiscussion(disc._id, u._id); } catch { /* already in */ }
    }
  }

  const llmConfig = { provider: 'groq', model: 'llama-3.1-8b-instant' };
  log(`LLM: ${llmConfig.provider}/${llmConfig.model}\n`);
  log(`Replaying ${conversations.length} messages (delay: ${DELAY_MS}ms)...\n`);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const Message = (await import('../../models/Message.js')).default;
  const Discussion = (await import('../../models/Discussion.js')).default;
  const now = Date.now();
  const startTime = now - (30 * 24 * 60 * 60 * 1000);
  const timeStep = Math.floor((30 * 24 * 60 * 60 * 1000) / (conversations.length || 1));

  for (let i = 0; i < conversations.length; i++) {
    const { thread, user: username, text, isDecision } = conversations[i];
    const user = userMap[username];
    const discussion = threadsMap[thread];

    const simulatedTime = new Date(startTime + (i * timeStep));
    const message = await discussionService.addMessage(
      discussion._id, project._id, user._id, username, text, false
    );
    await Message.findByIdAndUpdate(message._id, { timestamp: simulatedTime });
    await Discussion.findByIdAndUpdate(discussion._id, { lastActivity: simulatedTime });

    write(`  [${String(i + 1).padStart(2, '0')}/${conversations.length}] [${thread}] ${username}: ${text.substring(0, 72)}...\n`);

    if (isDecision) {
      await triggerDecisionAPI(project._id, message._id, text, username, discussion._id);
    }
    
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const mainDisc = threadsMap['Main'];
  if (mainDisc) {
    const aiService = (await import('../../services/aiService.js')).default;
    const summaryService = (await import('../../services/summaryService.js')).default;

    for (const [threadName, disc] of Object.entries(threadsMap)) {
      if (threadName === 'Main') continue;

      log(`Summarizing ${threadName} convers