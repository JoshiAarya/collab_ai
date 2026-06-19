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

// Legacy provider names stored on older Project documents.
const LEGACY_PROVIDER_MAP = { gemini: 'google', claude: 'anthropic' };

// Anthropic models from Opus 4.7 onward reject sampling parameters
// (temperature/top_p/top_k return a 400).
const ANTHROPIC_NO_SAMPLING = /claude-(opus-4-[78]|fable|mythos)/i;

class AIOrchestrator {
  constructor() {
    this.modelConfigs = {
      'groq': { maxTokens: 8192, contextWindow: 8000, supportsStreaming: true },
      'server': { maxTokens: 8192, contextWindow: 8000, supportsStreaming: true },
      'openai': { maxTokens: 4096, contextWindow: 16000, supportsStreaming: true },
      'anthropic': { maxTokens: 4096, contextWindow: 100000, supportsStreaming: true },
      'google': { maxTokens: 8192, contextWindow: 32000, supportsStreaming: true },
      'deepseek': { maxTokens: 4096, contextWindow: 32000, supportsStreaming: true },
      'xai': { maxTokens: 4096, contextWindow: 32000, supportsStreaming: true }
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
    const context = await this.buildProjectContext({ projectId, discussionId, prompt, isCatchMeUp });

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

    // Extract deterministic source attribution from the retrieved context
    const sources = this.extractSources(context, isCatchMeUp);

    return { requestId, selectedModel, context, messages, systemPrompt, sources };
  }

  async handleRequest(params) {
    const { projectId, userId, discussionId } = params;
    try {
      const { requestId, selectedModel, context, messages, sources } = await this._prepareRequest(params);

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
        discussionId,
        maxTokens: 1024
      });

      logger.ai('Response generated', { requestId, provider: selectedModel.provider, responseLength: response.length });
      return { response, sources };

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
    const { projectId, userId, discussionId } = params;
    try {
      const { requestId, selectedModel, messages, sources } = await this._prepareRequest(params);
      const provider = selectedModel.provider;
      const model = selectedModel.model;
      const apiKey = await this.getApiKey(provider, projectId, userId, discussionId);
      const maxTokens = 1024;

      const streamer = {
        'groq': () => this.callGroqStreaming({ model, messages, maxTokens, apiKey }, onChunk),
        'server': () => this.callGroqStreaming({ model, messages, maxTokens, apiKey }, onChunk),
        'openai': () => this.callOpenAIStreaming({ model, messages, maxTokens, apiKey }, onChunk),
        'deepseek': () => this.callOpenAIStreaming({ model, messages, maxTokens, apiKey, baseURL: 'https://api.deepseek.com' }, onChunk),
        'xai': () => this.callOpenAIStreaming({ model, messages, maxTokens, apiKey, baseURL: 'https://api.x.ai/v1' }, onChunk),
        'anthropic': () => this.callAnthropicStreaming({ model, messages, maxTokens, apiKey }, onChunk),
        'google': () => this.callGoogleStreaming({ model, messages, maxTokens, apiKey }, onChunk)
      }[provider];

      if (streamer) {
        const fullText = await LLMGuardrails.guardedCall(
          { requestId, provider, model, messages, projectId },
          streamer
        );
        logger.ai('Streaming response complete', { requestId, provider, responseLength: fullText.length });
        return { fullText, sources };
      }

      // Fallback: non-streaming for unknown providers
      const response = await this.callProvider({
        requestId, provider, model, context: null,
        prompt: params.prompt, messagesOverride: messages, projectId, userId, maxTokens
      });
      onChunk(response); // send as single chunk
      return { fullText: response, sources };

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

    const provider = LEGACY_PROVIDER_MAP[llmConfig.provider] || llmConfig.provider;
    return { ...llmConfig, provider };
  }

  /**
   * Anthropic and Google require strictly alternating chat roles and a
   * conversation that starts with a user turn. Our multi-user history
   * routinely produces consecutive user messages ("Alice: ...", "Bob: ..."),
   * so merge same-role runs and fold a leading assistant turn into the
   * first user message.
   */
  _normalizeChatMessages(chatMessages) {
    const merged = [];
    for (const m of chatMessages) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) {
        last.content += '\n\n' + m.content;
      } else {
        merged.push({ role: m.role, content: m.content });
      }
    }

    if (merged.length > 0 && merged[0].role === 'assistant') {
      merged[0] = { role: 'user', content: `[Earlier assistant reply]\n${merged[0].content}` };
      if (merged[1] && merged[1].role === 'user') {
        merged[0].content += '\n\n' + merged[1].content;
        merged.splice(1, 1);
      }
    }

    return merged;
  }

  async buildProjectContext({ projectId, discussionId, prompt, isCatchMeUp = false }) {
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
    let pinnedDecisions = [];
    let relevantSummaries = [];

    if (prompt) {
      try {
        const queryEmbedding = await EmbeddingService.embedText(prompt);
        pastMessages = await VectorStore.searchMessages(projectId, queryEmbedding, 15, discussionId);
        
        // Semantic summary retrieval — top 3 most relevant summaries
        relevantSummaries = await VectorStore.searchSummaries(projectId, queryEmbedding, 3);
        
        // Semantic decision retrieval — top 8 most relevant decisions
        relevantDecisions = await VectorStore.searchDecisions(projectId, queryEmbedding, 8);
        
        // High-confidence decision pinning
        pinnedDecisions = relevantDecisions.filter(d => d.similarity !== null && d.similarity > 0.85);
        relevantDecisions = relevantDecisions.filter(d => d.similarity === null || d.similarity <= 0.85);

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
             content: d.content.substring(0, 2000),
             similarity: null // no ranking
           }));
        }

        if (!isCatchMeUp) {
          pastMessages = pastMessages.filter(m => m.similarity === null || m.similarity >= 0.35);
          relevantSummaries = relevantSummaries.filter(s => s.similarity === null || s.similarity >= 0.35);
          relevantDecisions = relevantDecisions.filter(d => d.similarity === null || d.similarity >= 0.20);
          documents = documents.filter(d => d.similarity === null || d.similarity >= 0.35);
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

    // Build a discussionId → title map for source attribution on past messages
    const discussionTitleMap = {};
    for (const disc of allDiscussions) {
      discussionTitleMap[disc._id.toString()] = disc.title;
    }

    // Fallback: if no semantic summaries found, use the current discussion's recent summaries
    if (relevantSummaries.length === 0 && summaries && summaries.length > 0) {
      relevantSummaries = summaries.map(s => ({
        id: s._id,
        discussionId: s.discussionId,
        title: discussionTitleMap[s.discussionId?.toString()] || 'Discussion',
        content: s.content,
        createdAt: s.createdAt,
        similarity: null // no ranking
      }));
    }

    // Pinned project state — a compact, always-injected grounding summary.
    let pinnedContext = '';
    try {
      const ProjectState = (await import('../../models/ProjectState.js')).default;
      const state = await ProjectState.findOne({ projectId }).lean();
      if (state?.pinnedContext) pinnedContext = state.pinnedContext;
    } catch (err) {
      logger.warn('ProjectState load failed in context builder', { error: err.message });
    }

    return {
      pinnedContext,
      project: project ? {
        title: project.title,
        description: project.problemStatement,
      } : null,
      discussion: discussion ? {
        title: discussion.title,
        isMain: discussion.isMain
      } : null,
      pinnedDecisions,
      decisions: relevantDecisions,
      summaries: relevantSummaries,
      pastMessages,
      documents,
      recentMessages: recentMessages.map(m => ({ user: m.user, text: m.text, timestamp: m.timestamp })),
      discussionTitleMap
    };
  }

  /**
   * Extract deterministic source attribution from the retrieved context.
   * Returns a compact sources object suitable for sending to the frontend.
   */
  extractSources(context, isCatchMeUp = false) {
    const sources = { decisions: [], messages: [], summaries: [], documents: [] };

    const allDecisions = [
      ...(context.pinnedDecisions || []),
      ...(context.decisions || [])
    ];

    if (allDecisions.length > 0) {
      sources.decisions = allDecisions
        .map(d => ({
          text: d.text,
          proposedBy: d.proposedBy?.username || 'team',
          timestamp: d.timestamp
        }));
    }

    if (context.pastMessages?.length > 0) {
      sources.messages = context.pastMessages
        .map(m => ({
          username: m.username || m.user || 'Unknown',
          discussionId: m.discussionId?.toString() || null,
          discussionTitle: (m.discussionId && context.discussionTitleMap?.[m.discussionId.toString()]) || 'Discussion',
          messageId: m.messageId?.toString() || null,
          timestamp: m.timestamp,
          snippet: (m.content || '').substring(0, 100)
        }));
    }

    if (context.summaries?.length > 0) {
      sources.summaries = context.summaries
        .map(s => ({
          discussionId: s.discussionId?.toString() || null,
          discussionTitle: context.discussionTitleMap?.[s.discussionId?.toString()] || s.title || 'Discussion',
          timestamp: s.createdAt
        }));
    }

    if (context.documents?.length > 0) {
      sources.documents = context.documents
        .map(d => ({
          title: d.title || 'Untitled Document'
        }));
    }

    // Only return sources that actually have entries
    const totalSources = sources.decisions.length + sources.messages.length + sources.summaries.length + sources.documents.length;
    return totalSources > 0 ? sources : null;
  }

  buildSystemPrompt(context) {
    let prompt = `You are CollabAI, a helpful AI assistant for team collaboration.
Be conversational, concise, and natural. Use the project context below to give accurate, relevant responses.\n\n`;

    if (context.project) {
      prompt += `Project: ${context.project.title}\n`;
      if (context.project.description) prompt += `${context.project.description}\n\n`;
    }

    // Pinned state — compact grounding summary of the project's knowledge graph.
    if (context.pinnedContext) {
      prompt += `## Project State\n${context.pinnedContext}\n\n`;
    }

    if (context.discussion) {
      prompt += `Current Discussion: ${context.discussion.title}${context.discussion.isMain ? ' (main thread)' : ''}\n\n`;
    }

    // PINNED LAYER: High-Confidence Decisions
    if (context.pinnedDecisions?.length > 0) {
      prompt += `## EXPLICITLY PINNED DECISIONS\nThe following decisions perfectly match the user's query (>0.85 similarity) and MUST be prioritized in your response:\n`;
      context.pinnedDecisions.forEach((d, i) => {
        const date = d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '';
        const who = d.proposedBy?.username || 'team';
        prompt += `${i+1}. ${d.text}`;
        if (d.rationale) prompt += ` (rationale: ${d.rationale})`;
        prompt += ` — ${who}, ${date}\n`;
      });
      prompt += `\n`;
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

    // LAYER 2: Semantic Summaries
    if (context.summaries?.length > 0) {
      prompt += `## Relevant Context (Discussion Summaries)\n`;
      context.summaries.forEach(s => {
        const title = context.discussionTitleMap?.[s.discussionId?.toString()] || s.title || 'Discussion';
        prompt += `\n[${title}]\n${s.content}\n`;
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
      temperature = 0.7, maxTokens = null, projectId,
      userId, discussionId
    } = params;

    if (provider === 'server' && model === 'server') {
      model = 'llama-3.1-8b-instant';
    }

    const providerMaxTokens = { groq: 1024, server: 8192, openai: 4096, anthropic: 8192, google: 8192, deepseek: 4096, xai: 4096 };
    const resolvedMaxTokens = maxTokens ?? (providerMaxTokens[provider] || 1024);

    // messagesOverride arrives pre-trimmed from _prepareRequest — don't trim twice.
    let messages = messagesOverride;
    if (!messages) {
      messages = this.constructMessages(context, prompt, systemPrompt);
      const { messages: trimmedMessages } = TokenManager.trimContext(context, messages, model, requestId);
      messages = trimmedMessages;
    }

    const result = await LLMGuardrails.guardedCall(
      { requestId, provider, model, messages, projectId },
      async () => {
        const apiKey = await this.getApiKey(provider, projectId, userId, discussionId);
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
          case 'deepseek':
            // OpenAI-compatible API
            return await this.callOpenAI({ model, messages, temperature, maxTokens: resolvedMaxTokens, apiKey, baseURL: 'https://api.deepseek.com' });
          case 'xai':
            // OpenAI-compatible API
            return await this.callOpenAI({ model, messages, temperature, maxTokens: resolvedMaxTokens, apiKey, baseURL: 'https://api.x.ai/v1' });
          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }
      }
    );

    return result.content || result;
  }

  async getApiKey(provider, projectId, userId, discussionId) {
    if (provider === 'groq' || provider === 'server') {
      const encryptedKey = process.env.GROQ_API_KEY || process.env.CHATBOT_API_KEY;
      return EncryptionService.decryptForUse(encryptedKey);
    }

    // Check if in private discussion and user has their own key configured
    if (discussionId && userId) {
      try {
        const discussion = await discussionService.getDiscussionById(discussionId);
        if (discussion && discussion.isPrivate) {
          const User = (await import('../../models/User.js')).default;
          const user = await User.findById(userId).select('+apiKeys');
          if (user && user.apiKeys && typeof user.apiKeys.get === 'function') {
            const userKey = user.apiKeys.get(provider);
            if (userKey) {
              return EncryptionService.decryptForUse(userKey);
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to retrieve user API key for private discussion', { error: err.message });
      }
    }

    const key = await projectService.getProjectApiKey(projectId, provider);
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

  async callOpenAI({ model, messages, temperature, maxTokens, apiKey, baseURL }) {
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    const completion = await client.chat.completions.create({ model, messages, temperature, max_tokens: maxTokens });
    return { content: completion.choices[0]?.message?.content || 'No response generated.', usage: completion.usage || null };
  }

  /**
   * Streaming for OpenAI-compatible APIs (OpenAI, DeepSeek, xAI)
   */
  async callOpenAIStreaming({ model, messages, maxTokens, apiKey, baseURL }, onChunk) {
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
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

  /**
   * Streaming Anthropic call
   */
  async callAnthropicStreaming({ model, messages, maxTokens, apiKey }, onChunk) {
    const client = new Anthropic({ apiKey });
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = this._normalizeChatMessages(messages.filter(m => m.role !== 'system'));

    const params = {
      model, max_tokens: maxTokens,
      system: systemMsg?.content || '',
      messages: chatMessages
    };
    if (!ANTHROPIC_NO_SAMPLING.test(model)) {
      params.temperature = 0.7;
    }

    const stream = client.messages.stream(params);
    stream.on('text', (delta) => onChunk(delta));
    const final = await stream.finalMessage();
    const text = final.content.find(b => b.type === 'text')?.text;
    return text || 'No response generated.';
  }

  /**
   * Streaming Google Gemini call
   */
  async callGoogleStreaming({ model, messages, maxTokens, apiKey }, onChunk) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model, generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
    });
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = this._normalizeChatMessages(messages.filter(m => m.role !== 'system'));
    const lastMsg = chatMessages[chatMessages.length - 1];
    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }]
    }));
    let userPrompt = lastMsg?.content || '';
    if (systemMsg?.content && history.length === 0) {
      userPrompt = `${systemMsg.content}\n\n${userPrompt}`;
    }
    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessageStream(userPrompt);
    let fullText = '';
    for await (const chunk of result.stream) {
      const delta = chunk.text();
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }
    return fullText || 'No response generated.';
  }

  async callAnthropic({ model, messages, temperature, maxTokens, apiKey }) {
    const client = new Anthropic({ apiKey });
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = this._normalizeChatMessages(messages.filter(m => m.role !== 'system'));

    const params = {
      model, max_tokens: maxTokens,
      system: systemMsg?.content || '',
      messages: chatMessages
    };
    // Opus 4.7+ / Fable models reject sampling parameters with a 400.
    if (!ANTHROPIC_NO_SAMPLING.test(model)) {
      params.temperature = temperature;
    }

    const response = await client.messages.create(params);
    const text = response.content.find(b => b.type === 'text')?.text;
    return { content: text || 'No response generated.', usage: response.usage || null };
  }

  async callGoogle({ model, messages, temperature, maxTokens, apiKey }) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model, generationConfig: { temperature, maxOutputTokens: maxTokens }
    });
    const systemMsg = messages.find(m => m.role === 'system');
    // Gemini requires history to start with a user turn and alternate roles.
    const chatMessages = this._normalizeChatMessages(messages.filter(m => m.role !== 'system'));
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
