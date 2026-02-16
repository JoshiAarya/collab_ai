/**
 * AI Orchestration Engine
 * Handles intelligent routing, context building, and model-specific adaptations
 */

import aiService from '../../services/aiService.js';
import documentService from '../../services/documentService.js';
import summaryService from '../../services/summaryService.js';
import discussionService from '../../services/discussionService.js';

class AIOrchestrator {
  constructor() {
    this.modelConfigs = {
      'groq': {
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
      }
    };
  }

  /**
   * Main orchestration entry point
   */
  async generateResponse(params) {
    const { projectId, discussionId, prompt, llmConfig, userId } = params;

    // 1. Detect and validate model
    const modelConfig = this.getModelConfig(llmConfig.provider);
    
    // 2. Build context intelligently
    const context = await this.buildIntelligentContext({
      projectId,
      discussionId,
      maxTokens: modelConfig.contextWindow
    });

    // 3. Construct model-specific prompt
    const messages = this.constructMessages({
      context,
      prompt,
      provider: llmConfig.provider
    });

    // 4. Execute AI call
    const response = await aiService.generateResponse(
      projectId,
      discussionId,
      prompt,
      llmConfig
    );

    return response;
  }

  /**
   * Build intelligent context with priority ranking
   */
  async buildIntelligentContext({ projectId, discussionId, maxTokens }) {
    const context = {
      project: null,
      discussion: null,
      documents: [],
      summaries: [],
      recentMessages: [],
      decisions: [],
      blockers: []
    };

    // Get project metadata
    const projectService = (await import('../../services/projectService.js')).default;
    const project = await projectService.getProjectById(projectId);
    if (project) {
      context.project = {
        title: project.title,
        description: project.description
      };
    }

    // Get discussion metadata
    const discussion = await discussionService.getDiscussionById(discussionId);
    if (discussion) {
      context.discussion = {
        title: discussion.title,
        description: discussion.description
      };
    }

    // Get documents (top priority)
    const documents = await documentService.getProjectDocuments(projectId);
    context.documents = documents.slice(0, 3).map(doc => ({
      title: doc.title,
      content: doc.content.substring(0, 1500)
    }));

    // Get structured summaries
    const summaries = await summaryService.getProjectSummaries(projectId, 3);
    context.summaries = summaries.map(s => s.content);

    // Get recent messages
    const messages = await discussionService.getDiscussionMessages(discussionId, 20);
    context.recentMessages = messages.map(m => ({
      user: m.user,
      text: m.text,
      timestamp: m.timestamp
    }));

    return context;
  }

  /**
   * Construct messages based on provider
   */
  constructMessages({ context, prompt, provider }) {
    const systemPrompt = this.buildSystemPrompt(context, provider);
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    context.recentMessages.forEach(m => {
      if (m.user === 'CollabAI') {
        messages.push({ role: 'assistant', content: m.text });
      } else {
        messages.push({ role: 'user', content: `${m.user}: ${m.text}` });
      }
    });

    return messages;
  }

  /**
   * Build system prompt with context
   */
  buildSystemPrompt(context, provider) {
    let prompt = `You are CollabAI, an intelligent collaborative assistant.

Your role:
- Help teams collaborate effectively
- Provide context-aware responses
- Track decisions and blockers
- Suggest actionable next steps

`;

    if (context.project) {
      prompt += `\nPROJECT: ${context.project.title}\n`;
      if (context.project.description) {
        prompt += `Description: ${context.project.description}\n`;
      }
    }

    if (context.discussion) {
      prompt += `\nDISCUSSION: ${context.discussion.title}\n`;
    }

    if (context.documents.length > 0) {
      prompt += `\nDOCUMENTS:\n`;
      context.documents.forEach(doc => {
        prompt += `\n${doc.title}:\n${doc.content}\n`;
      });
    }

    if (context.summaries.length > 0) {
      prompt += `\nPREVIOUS SUMMARIES:\n`;
      context.summaries.forEach((summary, i) => {
        prompt += `${i + 1}. ${summary}\n`;
      });
    }

    return prompt;
  }

  /**
   * Get model configuration
   */
  getModelConfig(provider) {
    return this.modelConfigs[provider] || this.modelConfigs['groq'];
  }
}

export default new AIOrchestrator();
