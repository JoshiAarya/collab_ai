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
        'llama-3.1-405b-reasoning',
        'mixtral-8x7b-32768',
        'gemma-7b-it'
      ],
      'server': [
        'llama-3.1-8b-instant',
        'llama-3.1-70b-versatile'
      ],
      'openai': ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
      'anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      'google': ['gemini-pro', 'gemini-ultra']
    };

    this.maxTimeoutMs = 30000; // 30 seconds
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
      return { category: 'rate_limit', retryable: false };
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
          logger.info('Retrying LLM call', { requestId });
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
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
