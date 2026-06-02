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
