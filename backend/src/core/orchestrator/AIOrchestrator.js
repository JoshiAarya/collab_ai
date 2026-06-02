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
        const fullText = await LLMGuardrails.guardedCall(
          { requestId, provider: selectedModel.provider, model: selectedModel.model, messages, projectId },
          async () => {
            return await this.callGroqStreaming({
              model: selectedModel.model, messages, maxTokens: 1024, apiKey
            }, onChunk);
          }
        );
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
        
        // Semantic decision retrieval — top 8 most relevant decisions
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
