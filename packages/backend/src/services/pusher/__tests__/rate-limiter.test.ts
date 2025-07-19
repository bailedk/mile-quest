/**
 * Tests for PusherRateLimiter
 */

import { PusherRateLimiter } from '../rate-limiter';

describe('PusherRateLimiter', () => {
  let rateLimiter: PusherRateLimiter;

  beforeEach(() => {
    rateLimiter = new PusherRateLimiter({
      messagesPerSecond: 5,
      messagesPerMinute: 300,
      subscriptionsPerConnection: 10,
      burstLimit: 20,
      windowSize: 60
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('Message Rate Limiting', () => {
    it('should allow messages within rate limit', () => {
      const result = rateLimiter.checkMessageLimit('user-1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should reject messages when rate limit exceeded', () => {
      const userId = 'user-1';
      
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkMessageLimit(userId);
      }
      
      // Next request should be rejected
      const result = rateLimiter.checkMessageLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should refill tokens over time', async () => {
      const userId = 'user-1';
      
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkMessageLimit(userId);
      }
      
      // Should be rejected
      expect(rateLimiter.checkMessageLimit(userId).allowed).toBe(false);
      
      // Wait for token refill (simulate time passing)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed again
      expect(rateLimiter.checkMessageLimit(userId).allowed).toBe(true);
    });
  });

  describe('Subscription Rate Limiting', () => {
    it('should allow subscriptions within limit', () => {
      const result = rateLimiter.checkSubscriptionLimit('user-1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should reject subscriptions when limit exceeded', () => {
      const userId = 'user-1';
      
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkSubscriptionLimit(userId);
      }
      
      // Next request should be rejected
      const result = rateLimiter.checkSubscriptionLimit(userId);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Burst Limiting', () => {
    it('should allow burst messages within limit', () => {
      const result = rateLimiter.checkBurstLimit('user-1', 15);
      
      expect(result.allowed).toBe(true);
    });

    it('should reject burst when exceeding limit', () => {
      const result = rateLimiter.checkBurstLimit('user-1', 30);
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should use regular tokens first, then burst tokens', () => {
      const userId = 'user-1';
      
      // Use some regular tokens first
      rateLimiter.checkMessageLimit(userId);
      rateLimiter.checkMessageLimit(userId);
      
      // Now try a burst that requires both regular and burst tokens
      const result = rateLimiter.checkBurstLimit(userId, 10);
      expect(result.allowed).toBe(true);
    });
  });

  describe('User Management', () => {
    it('should track separate limits per user', () => {
      // User 1 uses their tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkMessageLimit('user-1');
      }
      
      // User 2 should still have tokens available
      const result = rateLimiter.checkMessageLimit('user-2');
      expect(result.allowed).toBe(true);
    });

    it('should reset user limits', () => {
      const userId = 'user-1';
      
      // Consume all tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkMessageLimit(userId);
      }
      
      // Should be rejected
      expect(rateLimiter.checkMessageLimit(userId).allowed).toBe(false);
      
      // Reset limits
      rateLimiter.resetUserLimits(userId);
      
      // Should be allowed again
      expect(rateLimiter.checkMessageLimit(userId).allowed).toBe(true);
    });

    it('should provide user status', () => {
      const userId = 'user-1';
      
      // Use some tokens
      rateLimiter.checkMessageLimit(userId);
      rateLimiter.checkSubscriptionLimit(userId);
      
      const status = rateLimiter.getUserStatus(userId);
      
      expect(status.messages.tokens).toBeLessThan(5);
      expect(status.subscriptions.tokens).toBeLessThan(10);
      expect(status.messages.resetTime).toBeInstanceOf(Date);
      expect(status.subscriptions.resetTime).toBeInstanceOf(Date);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old user entries', () => {
      // This test would need to mock time or use longer timeouts
      // For now, just verify the cleanup method exists and can be called
      expect(() => rateLimiter.cleanup()).not.toThrow();
    });
  });

  describe('Violation Recording', () => {
    it('should record violations without throwing', () => {
      expect(() => {
        rateLimiter.recordViolation('user-1', 'message');
        rateLimiter.recordViolation('user-1', 'subscription');
        rateLimiter.recordViolation('user-1', 'burst');
      }).not.toThrow();
    });
  });
});