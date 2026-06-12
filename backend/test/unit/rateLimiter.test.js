import { describe, it, expect } from 'vitest';
import RateLimiter, { RateLimitError } from '../../src/core/stability/RateLimiter.js';

describe('RateLimiter', () => {
  it('allows requests up to the per-user limit, then blocks', () => {
    const userId = 'unit-test-user-1';
    const limit = RateLimiter.config.userRequestsPerMinute;

    for (let i = 0; i < limit; i++) {
      expect(RateLimiter.checkUserLimit(userId).allowed).toBe(true);
    }
    const blocked = RateLimiter.checkUserLimit(userId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('tracks users independently', () => {
    const limit = RateLimiter.config.userRequestsPerMinute;
    for (let i = 0; i < limit; i++) RateLimiter.checkUserLimit('unit-test-user-2');
    expect(RateLimiter.checkUserLimit('unit-test-user-2').allowed).toBe(false);
    expect(RateLimiter.checkUserLimit('unit-test-user-3').allowed).toBe(true);
  });

  it('checkLimits throws RateLimitError with retry metadata when exceeded', () => {
    const userId = 'unit-test-user-4';
    const limit = RateLimiter.config.userRequestsPerMinute;
    for (let i = 0; i < limit; i++) RateLimiter.checkUserLimit(userId);

    try {
      RateLimiter.checkLimits(userId, 'unit-test-project-1');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect(err.statusCode).toBe(429);
      expect(err.retryAfter).toBeGreaterThan(0);
    }
  });
});
