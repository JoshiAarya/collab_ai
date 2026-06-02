/**
 * AI Service - PHASE 1 Refactor
 * Thin wrapper that delegates all AI operations to AIOrchestrator
 * This maintains backward compatibility while centralizing AI logic
 */

import AIOrchestrator from '../core/orchestrator/AIOrchestrator.js';
import logger from '../utils/logger.js';

class AIService {
  /**
   * Generate AI response (delegates to orchestrator)
   */
  async generateResponse(projectId, discussionId, prompt, llmConfig, userId = null) {
    logger.info('aiService.generateResponse called - delegating to orchestrator');
    
    return await AIOrchestrator.handleRequest({
      projectId,
      discussionId,
      prompt,
      llmConfig,
      userId
    });
  }

  /**
   * Generate summary (delegates to orchestrator)
   */
  async generateSummary(projectId, discussionId, llmConfig, customPrompt = null) {
    logger.info('aiService.generateSummary called - delegating to orchestrator');
    
    return await AIOrchestrator.handleSummaryRequest({
      projectId,
      discussionId,
      llmConfig,
      customPrompt
    });
  }

  /**
   * Regenerate summary with custom prompt (delegates to orchestrator)
   */
  async regenerateSummary(projectId, discussionId, existingSummary, customPrompt, llmConfig) {
    logger.info('aiService.regenerateSummary called - delegating to orchestrator');
    
    return await AIOrchestrator.handleSummaryRefinement({
      projectId,
      discussionId,
      existingSummary,
      customPrompt,
      llmConfig
    });
  }
}

export default new AIService();
