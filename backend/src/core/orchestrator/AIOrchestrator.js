/**
 * AI Orchestration Engine - PHASE 1, 2, 3 & 4
 * Central hub for ALL AI operations
 * Handles intelligent routing, context building, and model-specific adaptations
 * PHASE 2: Semantic document retrieval
 * PHASE 3: Persistent intelligence extraction
 * PHASE 4: Stability hardening (token management, rate limiting, guardrails)
 */

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
import InsightExtractor from '../intelligence/InsightExtractor.js';
import KnowledgeAggregator from '../intelligence/KnowledgeAggregator.js';
import TokenManager from '../stability/TokenManager.js';
import RateLimiter, { RateLimitError } from '../stability/RateLimiter.js';
import EncryptionService from '../stability/EncryptionService.js';
import LLMGuardrails from '../stability/LLMGuardrails.js';
// New entity models
import Topic from '../../models/Topic.js';
import Decision from '../../models/Decision.js';
import Blocker from '../../models/Blocker.js';
import ActionItem from '../../models/ActionItem.js';
import ProjectState from '../../models/ProjectState.js';

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
    const requestStart = Date.now();

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

      // 2. Build context — entity-aware if new model data exists, else legacy
      // FIX 1: use ProjectState.exists() — safer than Topic.countDocuments()
      const hasNewModel = await ProjectState.exists({ projectId });
      const context = hasNewModel
        ? await this.buildEntityAwareContext({ projectId, discussionId, prompt })
        : await this.buildContext({
            projectId,
            discussionId,
            maxTokens: this.getModelConfig(selectedModel.provider).contextWindow,
            prompt
          });

      // 3. PHASE 4: Accurate token counting
      const messages = this.constructMessages(context, prompt, null);
      const tokenCount = TokenManager.countMessagesTokens(messages);

      // Task 5: CONTEXT_BUILT_ENTITY_MODEL / CONTEXT_BUILT_LEGACY
      const contextLogKey = hasNewModel ? 'CONTEXT_BUILT_ENTITY_MODEL' : 'CONTEXT_BUILT_LEGACY';
      logger.ai(contextLogKey, {
        projectId,
        discussionId,
        contextType: hasNewModel ? 'entity-aware' : 'legacy',
        decisionsLoaded: context.decisions?.length || 0,
        blockersLoaded: context.blockers?.length || 0,
        topicsLoaded: context.topics?.length || 0,
        actionItemsLoaded: context.actionItems?.length || 0,
        documentsLoaded: context.documents?.length || 0,
        summariesLoaded: context.summaries?.length || 0,
        messagesLoaded: context.recentMessages?.length || 0,
        hasPinnedContext: !!(context.projectState?.pinnedContext),
        retrievalMethod: context.retrievalMethod,
        CONTEXT_BUILD_TIME_MS: Date.now() - requestStart,
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

      // 5. Extract and aggregate insights (non-blocking)
      // Only KnowledgeAggregator — ProjectInsightsAggregator removed (legacy, creates duplicates)
      try {
        const extracted = await InsightExtractor.extractFromAIResponse({
          projectId,
          discussionId,
          aiText: response,
          llmConfig: selectedModel,
          callProvider: this.callProvider.bind(this)
        });

        await KnowledgeAggregator.mergeInsights({
          projectId,
          discussionId,
          extracted
        });
      } catch (extractionError) {
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
- Key topics discussed (use broad system names)
- Decisions made (CRITICAL: Phrase all decisions starting with a choice verb, e.g., "Use Postgres", "Adopt Tailwind", "Store in Redis". Note the author by appending "(proposed by username)")
- Open questions or real blockers (include the author by appending "(raised by username)")
- Suggested next steps (include assignee by appending "(assigned to username)" if known)

Discussion:
${conversationText}

Provide a concise, highly structured summary:`;

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
      const messageText = allMessages.slice(-100).map(m => `${m.user?.username || 'User'}: ${m.text}`).join('\n');

      const prompt = `You are analyzing a collaborative project workspace. Based on the conversation history, provide strategic insights about where this project is heading and what matters most.

CONVERSATION HISTORY (most recent 100 messages):
${messageText}

${docText ? `DOCUMENTS:\n${docText}\n` : ''}
${summaryText ? `PREVIOUS SUMMARIES:\n${summaryText}\n` : ''}

Analyze the ACTUAL discussion flow and provide:
1. Main topics being actively discussed (not just mentioned once)
2. Clear decisions that were made by the team
3. Real blockers or open questions that need resolution
4. Concrete next steps the team should take
5. A one-sentence summary of the project's current direction

Return ONLY valid JSON (no markdown, no explanation):
{
  "projectSummary": "one sentence about what this project is about and where it's heading",
  "topics": ["only topics with multiple messages", "active discussions"],
  "decisions": ["concrete decisions made", "agreements reached"],
  "blockers": ["actual blockers or unanswered questions"],
  "nextSteps": ["specific actionable next steps"],
  "stage": "ideation|planning|development|review|blocked"
}

IMPORTANT: 
- Only include items that are ACTUALLY discussed in the messages
- Skip generic phrases like "discuss X", "decide on Y" 
- Focus on what's REAL and ACTIONABLE
- If there are no real blockers, return empty array
- Stage should reflect actual project state from conversations`;

      const response = await this.callProvider({
        provider: selectedModel.provider,
        model: selectedModel.model,
        context: null,
        prompt,
        projectId,
        systemPrompt: 'You are a strategic project analyst. Extract only meaningful, actionable insights from real conversations.',
        temperature: 0.2,
        maxTokens: 800
      });

      // Parse JSON response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            topics: parsed.topics || [],
            decisions: parsed.decisions || [],
            blockers: parsed.blockers || [],
            nextSteps: parsed.nextSteps || [],
            projectSummary: parsed.projectSummary || '',
            stage: parsed.stage || 'ideation'
          };
        }
      } catch (e) {
        logger.error('Failed to parse AI insights', { error: e.message });
      }

      return {
        topics: [],
        decisions: [],
        blockers: [],
        nextSteps: [],
        projectSummary: '',
        stage: 'ideation'
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

    return { provider: actualProvider, model: actualModel };
  }

  /**
   * Retrieve the user-supplied API key for a provider from the project's stored keys.
   * Falls back to server env vars for groq/server.
   */
  async getApiKey(provider, projectId) {
    if (provider === 'groq' || provider === 'server') {
      return this.getServerGroqKey();
    }
    if (projectId) {
      const key = await projectService.getProjectApiKey(projectId, provider);
      if (key) return EncryptionService.decryptForUse(key);
    }
    // Fallback to env vars (useful for self-hosted / dev)
    const envMap = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
    };
    const envKey = envMap[provider];
    if (envKey) return envKey;
    throw new Error(`No API key configured for provider: ${provider}. Please add your API key in the model settings.`);
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
          description: project.problemStatement,
          memberCount: project.members?.length || 0,
          stage: project.stage || 'ideation'
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
      // Add discussion count to project context
      if (context.project) {
        context.project.discussionCount = allDiscussions.length;
      }
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
   * Entity-aware context builder (new knowledge model)
   * Used when Topics exist for the project
   */
  async buildEntityAwareContext({ projectId, discussionId, prompt }) {
    const [
      projectState,
      decisions,
      blockers,
      topics,
      actionItems,
      summaries,
      messages,
      project,
      discussion,
      allDiscussions
    ] = await Promise.all([
      ProjectState.findOne({ projectId }).lean(),
      Decision.find({ projectId, status: 'active' })
        .sort({ timestamp: -1 }).limit(5).lean(),
      Blocker.find({ projectId, resolved: false })
        .sort({ severity: -1, raisedAt: 1 }).lean(),
      Topic.find({ projectId, status: 'stable' })
        .sort({ count: -1 }).limit(8).lean(),
      ActionItem.find({ projectId, status: { $ne: 'completed' } })
        .sort({ status: -1, createdAt: 1 }).limit(5).lean(),
      summaryService.getDiscussionSummaries(discussionId, 3),
      discussionService.getDiscussionMessages(discussionId, 30),
      projectService.getProjectById(projectId),
      discussionService.getDiscussionById(discussionId),
      discussionService.getProjectDiscussions(projectId)
    ]);

    // Semantic document retrieval — unchanged
    let documents = [];
    try {
      const chunkCount = await VectorStore.count(projectId);
      if (chunkCount > 0 && prompt) {
        const queryEmbedding = await EmbeddingService.embedText(prompt);
        const chunks = await VectorStore.search(projectId, queryEmbedding, 5);
        documents = chunks.map(c => ({
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
      logger.warn('Document retrieval failed in entity context', { error: err.message });
    }

    return {
      projectState,
      decisions,
      blockers,
      topics,
      actionItems,
      documents,
      summaries: summaries.map(s => s.content),
      recentMessages: messages.map(m => ({ user: m.user, text: m.text, timestamp: m.timestamp })),
      retrievalMethod: 'entity-aware',
      // Project metadata for system prompt enrichment
      project: project ? {
        title: project.title,
        description: project.problemStatement,
        memberCount: project.members?.length || 0,
        discussionCount: allDiscussions.length,
        stage: project.stage || 'ideation'
      } : null,
      discussion: discussion ? {
        title: discussion.title,
        description: discussion.description,
        isMain: discussion.isMain
      } : null,
      // Parallel discussion summaries — same logic as legacy buildContext
      discussions: await (async () => {
        const result = [];
        for (const disc of allDiscussions) {
          if (disc._id.toString() === discussionId.toString()) continue;
          const discSummaries = await summaryService.getDiscussionSummaries(disc._id, 1);
          if (discSummaries.length > 0) {
            result.push({ title: disc.title, summary: discSummaries[0].content });
          }
        }
        return result;
      })()
    };
  }

  /**
   * Build system prompt with context
   */
  buildSystemPrompt(context) {
    // Entity-aware prompt (new knowledge model)
    if (context.retrievalMethod === 'entity-aware') {
      return this._buildEntitySystemPrompt(context);
    }
    // Legacy prompt
    return this._buildLegacySystemPrompt(context);
  }

  /**
   * Entity-aware system prompt — layered hierarchy
   * Layer order: ProjectState → Decisions → Blockers → Topics → Documents → Actions → Summaries
   */
  _buildEntitySystemPrompt(context) {
    let prompt = `You are CollabAI, a helpful AI assistant for team collaboration.
Be conversational, concise, and natural. Use the project context below to give accurate, relevant responses.\n\n`;

    // Project metadata
    if (context.project) {
      prompt += `Project: ${context.project.title}\n`;
      if (context.project.description) prompt += `${context.project.description}\n`;
      prompt += `Members: ${context.project.memberCount} | Discussions: ${context.project.discussionCount} | Stage: ${context.project.stage}\n\n`;
    }

    // Current discussion
    if (context.discussion) {
      prompt += `Current Discussion: ${context.discussion.title}`;
      if (context.discussion.isMain) prompt += ` (main thread)`;
      prompt += `\n\n`;
    }

    // FIX 6 Layer 1: pinnedContext always first
    if (context.projectState?.pinnedContext) {
      prompt += `## Project Overview\n${context.projectState.pinnedContext}\n\n`;
    } else if (context.projectState) {
      const ps = context.projectState;
      prompt += `## Project State\n`;
      prompt += `Stage: ${ps.stage}`;
      if (ps.stageReason) prompt += ` — ${ps.stageReason}`;
      prompt += `\nMomentum: ${ps.momentum?.trend || 'stable'} (${ps.momentum?.recentMessageCount || 0} messages this week)\n`;
      prompt += `Open blockers: ${ps.openBlockerCount || 0} | Pending actions: ${ps.unresolvedActionCount || 0}\n\n`;
    }

    // Layer 2: Active Decisions
    if (context.decisions?.length > 0) {
      prompt += `## Active Decisions\n`;
      context.decisions.forEach(d => {
        prompt += `- ${d.text}`;
        if (d.rationale) prompt += ` (${d.rationale})`;
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    // Layer 3: Open Blockers
    if (context.blockers?.length > 0) {
      prompt += `## Open Blockers\n`;
      context.blockers.forEach(b => {
        const daysOpen = b.raisedAt
          ? Math.floor((Date.now() - new Date(b.raisedAt).getTime()) / 86400000)
          : 0;
        prompt += `- [${b.severity}] ${b.text}`;
        if (daysOpen > 0) prompt += ` (open ${daysOpen} days)`;
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    // Layer 4: Active Topics
    if (context.topics?.length > 0) {
      prompt += `## Active Topics\n`;
      prompt += context.topics.map(t => `${t.name} (×${t.count})`).join(', ') + `\n\n`;
    }

    // Layer 5: Relevant Documents
    if (context.documents?.length > 0) {
      prompt += `## Relevant Documents\n`;
      context.documents.forEach(doc => {
        prompt += `\n${doc.title}:\n${doc.content}\n`;
      });
      prompt += `\n`;
    }

    // Layer 6: Pending Actions
    if (context.actionItems?.length > 0) {
      prompt += `## Pending Actions\n`;
      context.actionItems.forEach(a => {
        prompt += `- [${a.status}] ${a.text}\n`;
      });
      prompt += `\n`;
    }

    // Layer 7: Parallel Discussion Summaries
    // These are summaries explicitly created by users to promote parallel discussion
    // content into the main thread's context.
    if (context.discussions?.length > 0) {
      prompt += `## Parallel Discussion Summaries\n`;
      context.discussions.forEach(disc => {
        prompt += `\n[${disc.title}]\n${disc.summary}\n`;
      });
      prompt += `\n`;
    }

    // Layers 8 & 9 (current discussion summaries + messages) are added via constructMessages()
    return prompt;
  }

  /**
   * Legacy system prompt — unchanged behaviour
   */
  _buildLegacySystemPrompt(context) {
    let prompt = `You are CollabAI, a helpful AI assistant for team collaboration.

Be conversational, concise, and natural. Answer questions directly without unnecessary formatting or structure. Use the context below to provide accurate, relevant responses.\n\n`;

    if (context.project) {
      prompt += `Project: ${context.project.title}\n`;
      if (context.project.description) prompt += `${context.project.description}\n`;
      prompt += `Members: ${context.project.memberCount} | Discussions: ${context.project.discussionCount} | Stage: ${context.project.stage}\n`;
    }

    if (context.discussion) {
      prompt += `\nCurrent Discussion: ${context.discussion.title}`;
      if (context.discussion.isMain) prompt += ` (main thread)`;
      prompt += `\n`;
      if (context.discussion.description) prompt += `${context.discussion.description}\n`;
    }

    if (context.discussions?.length > 0) {
      prompt += `\n--- Other Project Discussions ---\n`;
      context.discussions.forEach(disc => {
        prompt += `\n[${disc.title}]\n${disc.summary}\n`;
      });
    }

    if (context.documents?.length > 0) {
      prompt += `\n--- Project Documents ---\n`;
      context.documents.forEach(doc => {
        prompt += `\n${doc.title}:\n${doc.content}\n`;
      });
    }

    if (context.summaries?.length > 0) {
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

    // Add conversation history
    if (context && context.recentMessages) {
      context.recentMessages.forEach(m => {
        // Skip System messages — these are error notifications, not real conversation
        if (m.user === 'System') return;

        if (m.user === 'CollabAI') {
          messages.push({ role: 'assistant', content: m.text });
        } else {
          // Prefix with username so the AI knows who said what in multi-user chats
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
      maxTokens = null  // null = use provider default
    } = params;

    // Per-provider sensible output token limits for chat responses
    const providerMaxTokens = {
      groq: 8192,
      server: 8192,
      openai: 4096,
      anthropic: 8192,
      google: 8192
    };
    const resolvedMaxTokens = maxTokens ?? (providerMaxTokens[provider] || 4096);

    let messages = this.constructMessages(context, prompt, systemPrompt);

    // Trim context if it exceeds model token limit before calling provider
    const { messages: trimmedMessages } = TokenManager.trimContext(context, messages, model, requestId);
    messages = trimmedMessages;

    // PHASE 4: Wrap with guardrails
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

  /**
   * Call Groq API
   */
  async callGroq({ model, messages, temperature, maxTokens, apiKey }) {
    const client = new Groq({ apiKey: apiKey || this.getServerGroqKey() });
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    });
    const content = completion.choices[0]?.message?.content || 'No response generated.';
    return { content, usage: completion.usage || null };
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI({ model, messages, temperature, maxTokens, apiKey }) {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    });
    const content = completion.choices[0]?.message?.content || 'No response generated.';
    return { content, usage: completion.usage || null };
  }

  /**
   * Call Anthropic API
   * Anthropic uses a different message format — system prompt is a top-level param.
   */
  async callAnthropic({ model, messages, temperature, maxTokens, apiKey }) {
    const client = new Anthropic({ apiKey });
    // Extract system message (first message with role 'system')
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMsg?.content || '',
      messages: chatMessages
    });
    const content = response.content[0]?.text || 'No response generated.';
    return { content, usage: response.usage || null };
  }

  /**
   * Call Google Gemini API
   * Converts OpenAI-style messages to Gemini's format.
   */
  async callGoogle({ model, messages, temperature, maxTokens, apiKey }) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    });

    // Extract system prompt and build history
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    // Last message is the current user prompt
    const lastMsg = chatMessages[chatMessages.length - 1];
    const history = chatMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Prepend system prompt to first user message if present
    let userPrompt = lastMsg?.content || '';
    if (systemMsg?.content && history.length === 0) {
      userPrompt = `${systemMsg.content}\n\n${userPrompt}`;
    }

    const chat = geminiModel.startChat({ history });
    const result = await chat.sendMessage(userPrompt);
    const content = result.response.text() || 'No response generated.';
    return { content, usage: null };
  }

  /**
   * Get server Groq API key (env var, decrypted if needed)
   */
  getServerGroqKey() {
    const encryptedKey = process.env.GROQ_API_KEY || process.env.CHATBOT_API_KEY;
    if (!encryptedKey) throw new Error('Server AI API key not configured');
    return EncryptionService.decryptForUse(encryptedKey);
  }

  /**
   * Estimate token count (simple length-based for now)
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
