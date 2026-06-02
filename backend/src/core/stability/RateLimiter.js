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
