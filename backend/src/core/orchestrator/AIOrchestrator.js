/**
 * AI Orchestration Engine - PHASE 1, 2, 3 & 4
 * Central hub for ALL AI operations
 * Handles intelligent routing, context building, and model-specific adaptations
 * PHASE 2: Semantic document retrieval
 * PHASE 3: Persistent intelligence extraction
 * PHASE 4: Stability hardening (token management, rate limiting, guardrails)
 */

import Groq from 'groq-sdk';
import { randomUUID } from 'crypto';
import logger from '../../utils/logger.js';
import documentService from '../../services/documentService.js';
import summaryService from '../../services/summaryService.js';
import discussionService from '../../services/discussionService.js';
import projectService from '../../services/projectService.js';
import EmbeddingService from '../embeddings/EmbeddingService.js';
import VectorStore from '../vector/VectorStore.js';
import InsightExtractor from '../intelligence/InsightExtractor.js';
import ProjectInsightsAggregator from '../intelligence/ProjectInsightsAggregator.js';
import TokenManager from '../stability/TokenManager.js';
import RateLimiter, { RateLimitError } from '../stability/RateLimiter.js';
import EncryptionService from '../stability/EncryptionService.js';
import LLMGuardrails from '../stability/LLMGuardrails.js';

class AIOrchestrator {
  constructor() {
    this.modelConfigs = {
      'groq': {
        maxTokens: 8192,
        contextWindow: 8000,
        supportsStreaming: true
      },
      'server': {
        maxTokens: 8192,
        contextWindow: 8000,
        supportsStreaming: true
      },
      'openai': {
        maxTokens: 4096,
        contextWindow: 16000,
        supportsStreaming: true
      },
      'anthropic': {
        maxTokens: 4096,
        contextWindow: 100000,
        supportsStreaming: true
      },
      'google': {
        maxTokens: 8192,
        contextWindow: 32000,
        supportsStreaming: true
      }
    };
  }

  /**
   * Main orchestration entry point for chat responses
   * PHASE 4: Now includes rate limiting, token management, and guardrails
   */
  async handleRequest(params) {
    const { projectId, discussionId, prompt, llmConfig, userId } = params;
    const requestId = randomUUID();

    logger.ai('Orchestrator received request', {
      requestId,
      projectId,
      discussionId,
      provider: llmConfig.provider,
      model: llmConfig.model,
      promptLength: prompt.length
    });

    try {
      // PHASE 4: Rate limiting check
      if (userId) {
        try {
          RateLimiter.checkLimits(userId, projectId);
        } catch (error) {
          if (error instanceof RateLimitError) {
            // Re-throw with proper status code and headers
            throw error;
          }
          throw error;
        }
      }

      // 1. Select and validate model
      const selectedModel = this.selectModel(llmConfig);
      logger.ai('Model selected', { requestId, provider: selectedModel.provider, model: selectedModel.model });

      // 2. Build context intelligently (PHASE 2: now with semantic search)
      const context = await this.buildContext({
        projectId,
        discussionId,
        maxTokens: this.getModelConfig(selectedModel.provider).contextWindow,
        prompt // Pass prompt for semantic search
      });

      // 3. PHASE 4: Accurate token counting
      const messages = this.constructMessages(context, prompt, null);
      const tokenCount = TokenManager.countMessagesTokens(messages);
      
      logger.ai('Context built', {
        documentsCount: context.documents.length,
        summariesCount: context.summaries.length,
        messagesCount: context.recentMessages.length,
        crossDiscussionsCount: context.discussions.length,
        retrievalMethod: context.retrievalMethod,
        totalInputTokens: tokenCount
      });

      // 4. Call provider with guardrails
      const response = await this.callProvider({
        requestId,
        provider: selectedModel.provider,
        model: selectedModel.model,
        context,
        prompt,
        projectId,
        userId
      });

      logger.ai('Response generated', {
        requestId,
        provider: selectedModel.provider,
        responseLength: response.length
      });

      // 5. PHASE 3: Extract and aggregate insights (non-blocking)
      // This must NOT break the main AI flow
      try {
        const extracted = await InsightExtractor.extractFromAIResponse({
          projectId,
          discussionId,
          aiText: response,
          llmConfig: selectedModel,
          callProvider: this.callProvider.bind(this)
        });

        await ProjectInsightsAggregator.mergeInsights({
          projectId,
          discussionId,
          extracted
        });
      } catch (extractionError) {
        // Silent failure - insight extraction is non-critical
        logger.warn('Insight extraction failed (non-critical)', {
          requestId,
          projectId,
          discussionId,
          error: extractionError.message
        });
      }

      return response;

    } catch (error) {
      logger.error('Orchestrator error', {
        requestId,
        projectId,
        discussionId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle summary generation
   */
  async handleSummaryRequest(params) {
    const { projectId, discussionId, llmConfig, customPrompt } = params;

    logger.ai('Orchestrator received summary request', {
      projectId,
      discussionId,
      provider: llmConfig.provider,
      hasCustomPrompt: !!customPrompt
    });

    try {
      const selectedModel = this.selectModel(llmConfig);
      const messages = await discussionService.getDiscussionMessages(discussionId, 50);

      if (messages.length === 0) {
        return 'No messages to summarize yet.';
      }

      const conversationText = messages
        .map(m => `${m.user}: ${m.text}`)
        .join('\n');

      const basePrompt = `Summarize this team discussion. Focus on:
- Key topics discussed
- Decisions made
- Open questions or blockers
- Suggested next steps

Discussion:
${conversationText}

Provide a concise summary:`;

      const finalPrompt = customPrompt 
        ? `${basePrompt}\n\nAdditional instructions: ${customPrompt}`
        : basePrompt;

      const response = await this.callProvider({
        provider: selectedModel.provider,
        model: selectedModel.model,
        context: null,
        prompt: finalPrompt,
        projectId,
        systemPrompt: 'You are a helpful assistant that summarizes team discussions.',
        temperature: 0.5,
        maxTokens: 512
      });

      return response;

    } catch (error) {
      logger.error('Summary generation error', {
        projectId,
        discussionId,
        error: error.message
      });
      return 'Error generating summary.';
    }
  }

  /**
   * Handle summary refinement
   */
  async handleSummaryRefinement(params) {
    const { projectId, discussionId, existingSummary, customPrompt, llmConfig } = params;

    logger.ai('Orchestrator received summary refinement request', {
      projectId,
      discussionId,
      provider: llmConfig.provider
    });

    try {
      const selectedModel = this.selectModel(llmConfig);
      const messages = await discussionService.getDiscussionMessages(discussionId, 50);

      const conversationText = messages
        .map(m => `${m.user}: ${m.text}`)
        .join('\n');

      const prompt = `Here is the original discussion:

${conversationText}

Current summary:
${existingSummary}

User's refinement request: ${customPrompt}

Please provide an updated summary that addresses the user's request:`;

      const response = await this.callProvider({
        provider: selectedModel.provider,
        model: selectedModel.model,
        context: null,
        prompt,
        projectId,
        systemPrompt: 'You are a helpful assistant that refines and improves discussion summaries based on user feedback.',
        temperature: 0.5,
        maxTokens: 512
      });

      return response;

    } catch (error) {
      logger.error('Summary refinement error', {
        projectId,
        discussionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle dashboard insights generation
   */
  async handleDashboardInsights(params) {
    const { projectId, llmConfig } = params;

    logger.ai('Orchestrator received dashboard insights request', {
      projectId,
      provider: llmConfig.provider
    });

    try {
      const selectedModel = this.selectModel(llmConfig);

      // Get all project data
      const summaries = await summaryService.getProjectSummaries(projectId, 10);
      const documents = await documentService.getProjectDocuments(projectId);
      const discussions = await discussionService.getProjectDiscussions(projectId);
      
      // Get recent messages from all discussions
      let allMessages = [];
      for (const disc of discussions.slice(0, 5)) {
        const messages = await discussionService.getDiscussionMessages(disc._id, 20);
        allMessages = allMessages.concat(messages);
      }
      
      // If no data, return empty insights
      if (allMessages.length === 0 && documents.length === 0 && summaries.length === 0) {
        return {
          topics: [],
          decisions: [],
          blockers: [],
          nextSteps: []
        };
      }

      const summaryText = summaries.map(s => s.content).join('\n\n');
      const docText = documents.map(d => `${d.title}: ${d.content.substring(0, 500)}`).join('\n\n');
      const messageText = allMessages.slice(-50).map(m => `${m.user}: ${m.text}`).join('\n');

      const prompt = `Analyze this project data and extract insights:

RECENT MESSAGES:
${messageText}

DOCUMENTS:
${docText}

SUMMARIES:
${summaryText}

Extract and return ONLY valid JSON:
{
  "topics": ["topic1", "topic2"],
  "decisions": ["decision1"],
  "blockers": ["blocker1"],
  "nextSteps": ["step1", "step2"]
}`;

      const response = await this.callProvider({
        provider: selectedModel.provider,
        model: selectedModel.model,
        context: null,
        prompt,
        projectId,
        systemPrompt: 'You are an assistant that analyzes project discussions and extracts structured insights.',
        temperature: 0.3,
        maxTokens: 512
      });

      // Parse JSON response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        logger.error('Failed to parse AI insights', { error: e.message });
      }

      return {
        topics: [],
        decisions: [],
        blockers: [],
        nextSteps: []
      };

    } catch (error) {
      logger.error('Dashboard insights error', {
        projectId,
        error: error.message
      });
      return {
        topics: [],
        decisions: [],
        blockers: [],
        nextSteps: []
      };
    }
  }

  /**
   * Select and validate model configuration
   */
  selectModel(llmConfig) {
    const { provider, model } = llmConfig;

    // Map 'server' to 'groq'
    const actualProvider = (provider === 'server') ? 'groq' : provider;
    
    // Map 'server' model to actual Groq model
    let actualModel = model;
    if (model === 'server' || !model) {
      actualModel = 'llama-3.1-8b-instant';
    }

    return {
      provider: actualProvider,
      model: actualModel
    };
  }

  /**
   * Build intelligent context with priority ranking
   */
  /**
   * Build intelligent context with priority ranking
   * PHASE 2: Now uses semantic search for documents
   */
  async buildContext({ projectId, discussionId, maxTokens, prompt = null }) {
    try {
      const context = {
        project: null,
        discussion: null,
        discussions: [],
        documents: [],
        summaries: [],
        recentMessages: [],
        retrievalMethod: 'positional' // Track which method was used
      };

      // Get project metadata
      const project = await projectService.getProjectById(projectId);
      if (project) {
        context.project = {
          title: project.title,
          description: project.problemStatement
        };
      }

      // Get discussion metadata
      const discussion = await discussionService.getDiscussionById(discussionId);
      if (discussion) {
        context.discussion = {
          title: discussion.title,
          description: discussion.description,
          isMain: discussion.isMain
        };
      }

      // Get cross-discussion context (other discussions with summaries)
      const allDiscussions = await discussionService.getProjectDiscussions(projectId);
      for (const disc of allDiscussions) {
        if (disc._id.toString() === discussionId.toString()) continue;
        
        const discSummaries = await summaryService.getDiscussionSummaries(disc._id, 1);
        if (discSummaries.length > 0) {
          context.discussions.push({
            title: disc.title,
            summary: discSummaries[0].content
          });
        } else {
          const discMessages = await discussionService.getDiscussionMessages(disc._id, 5);
          if (discMessages.length > 0) {
            const preview = discMessages.map(m => `${m.user}: ${m.text}`).join('\n');
            context.discussions.push({
              title: disc.title,
              summary: `Recent activity:\n${preview}`
            });
          }
        }
      }

      // PHASE 2: Semantic document retrieval
      if (prompt) {
        try {
          // Check if embeddings exist for this project
          const chunkCount = await VectorStore.count(projectId);
          
          if (chunkCount > 0) {
            // Use semantic search
            logger.ai('Using semantic document retrieval', {
              projectId,
              chunkCount,
              promptLength: prompt.length
            });

            const queryEmbedding = await EmbeddingService.embedText(prompt);
            const relevantChunks = await VectorStore.search(projectId, queryEmbedding, 5);

            context.documents = relevantChunks.map(chunk => ({
              title: chunk.metadata.title || chunk.metadata.documentTitle,
              content: chunk.content,
              similarity: chunk.similarity
            }));

            context.retrievalMethod = 'semantic';

            logger.ai('Semantic retrieval completed', {
              projectId,
              chunksRetrieved: relevantChunks.length,
              topSimilarity: relevantChunks[0]?.similarity.toFixed(4)
            });
          } else {
            // Fallback to positional retrieval
            logger.debug('No embeddings found, using positional retrieval', { projectId });
            await this.fallbackPositionalRetrieval(projectId, context);
          }
        } catch (error) {
          // Fallback to positional retrieval on error
          logger.warn('Semantic retrieval failed, falling back to positional', {
            projectId,
            error: error.message
          });
          await this.fallbackPositionalRetrieval(projectId, context);
        }
      } else {
        // No prompt provided, use positional retrieval
        await this.fallbackPositionalRetrieval(projectId, context);
      }

      // Get summaries for current discussion
      const summaries = await summaryService.getDiscussionSummaries(discussionId, 3);
      context.summaries = summaries.map(s => s.content);

      // Get recent messages from current discussion
      const messages = await discussionService.getDiscussionMessages(discussionId, 30);
      context.recentMessages = messages.map(m => ({
        user: m.user,
        text: m.text,
        timestamp: m.timestamp
      }));

      return context;

    } catch (error) {
      logger.error('Error building context', { error: error.message });
      return {
        project: null,
        discussion: null,
        discussions: [],
        documents: [],
        summaries: [],
        recentMessages: [],
        retrievalMethod: 'error'
      };
    }
  }

  /**
   * Fallback to positional document retrieval
   */
  async fallbackPositionalRetrieval(projectId, context) {
    const documents = await documentService.getProjectDocuments(projectId);
    context.documents = documents.slice(0, 3).map(doc => ({
      title: doc.title,
      content: doc.content.substring(0, 2000)
    }));
    context.retrievalMethod = 'positional';
  }

  /**
   * Build system prompt with context
   */
  buildSystemPrompt(context) {
    let prompt = `You are CollabAI, a helpful AI assistant for team collaboration.

Be conversational, concise, and natural. Answer questions directly without unnecessary formatting or structure. Use the context below to provide accurate, relevant responses.

`;

    if (context.project) {
      prompt += `Project: ${context.project.title}\n`;
      if (context.project.description) {
        prompt += `${context.project.description}\n`;
      }
    }

    if (context.discussion && !context.discussion.isMain) {
      prompt += `\nCurrent Discussion: ${context.discussion.title}\n`;
      if (context.discussion.description) {
        prompt += `${context.discussion.description}\n`;
      }
    }

    // Add cross-discussion context
    if (context.discussions && context.discussions.length > 0) {
      prompt += `\n--- Other Project Discussions ---\n`;
      context.discussions.forEach(disc => {
        prompt += `\n[${disc.title}]\n${disc.summary}\n`;
      });
    }

    // Add documents
    if (context.documents.length > 0) {
      prompt += `\n--- Project Documents ---\n`;
      context.documents.forEach(doc => {
        prompt += `\n${doc.title}:\n${doc.content}\n`;
      });
    }

    // Add summaries
    if (context.summaries.length > 0) {
      prompt += `\n--- Previous Summaries (This Discussion) ---\n`;
      context.summaries.forEach((summary, i) => {
        prompt += `${i + 1}. ${summary}\n`;
      });
    }

    return prompt;
  }

  /**
   * Construct messages array for chat completion
   */
  constructMessages(context, prompt, systemPrompt = null) {
    const messages = [
      { 
        role: 'system', 
        content: systemPrompt || this.buildSystemPrompt(context) 
      }
    ];

    // Add conversation history if context provided
    if (context && context.recentMessages) {
      context.recentMessages.forEach(m => {
        if (m.user === 'CollabAI') {
          messages.push({ role: 'assistant', content: m.text });
        } else {
          messages.push({ role: 'user', content: `${m.user}: ${m.text}` });
        }
      });
    }

    // Add current user prompt
    messages.push({ role: 'user', content: prompt });

    return messages;
  }

  /**
   * Call AI provider (centralized)
   * PHASE 4: Now wrapped with guardrails for validation and safety
   */
  async callProvider(params) {
    const { 
      requestId,
      provider, 
      model, 
      context, 
      prompt, 
      projectId, 
      systemPrompt = null,
      temperature = 0.7,
      maxTokens = 1024
    } = params;

    const messages = this.constructMessages(context, prompt, systemPrompt);

    // PHASE 4: Wrap with guardrails
    const result = await LLMGuardrails.guardedCall(
      {
        requestId,
        provider,
        model,
        messages,
        projectId
      },
      async () => {
        switch (provider) {
          case 'groq':
          case 'server':
            return await this.callGroq({ model, messages, temperature, maxTokens });

          case 'openai':
          case 'anthropic':
          case 'google':
          case 'deepseek':
            throw new Error(`${provider} integration coming soon. Currently only Groq is supported.`);

          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }
      }
    );

    // Return just the content for backward compatibility
    return result.content || result;
  }

  /**
   * Call Groq API
   * PHASE 4: Now uses encrypted API keys and returns usage info
   */
  async callGroq(params) {
    const { model, messages, temperature, maxTokens } = params;

    const apiKey = this.getServerGroqKey();
    const client = new Groq({ apiKey });

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    });

    const content = completion.choices[0]?.message?.content || 'No response generated.';
    const usage = completion.usage || null;

    return { content, usage };
  }

  /**
   * Get server Groq API key
   * PHASE 4: Now uses encrypted keys
   */
  getServerGroqKey() {
    const encryptedKey = process.env.GROQ_API_KEY || process.env.CHATBOT_API_KEY;
    if (!encryptedKey) {
      throw new Error('Server AI API key not configured');
    }
    
    // PHASE 4: Decrypt if encrypted
    return EncryptionService.decryptForUse(encryptedKey);
  }

  /**
   * Estimate token count (simple length-based for now)
   * TODO: Implement proper tokenization in future phase
   */
  estimateTokens(context, prompt) {
    let totalChars = 0;

    // Count context characters
    if (context) {
      if (context.project) {
        totalChars += JSON.stringify(context.project).length;
      }
      if (context.discussion) {
        totalChars += JSON.stringify(context.discussion).length;
      }
      totalChars += JSON.stringify(context.discussions || []).length;
      totalChars += JSON.stringify(context.documents || []).length;
      totalChars += JSON.stringify(context.summaries || []).length;
      totalChars += JSON.stringify(context.recentMessages || []).length;
    }

    // Count prompt characters
    totalChars += prompt.length;

    // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(totalChars / 4);

    return estimatedTokens;
  }

  /**
   * Get model configuration
   */
  getModelConfig(provider) {
    return this.modelConfigs[provider] || this.modelConfigs['groq'];
  }
}

export default new AIOrchestrator();
