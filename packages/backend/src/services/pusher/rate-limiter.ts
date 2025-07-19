/**
 * Rate limiting implementation for Pusher connections
 */

import { RateLimitConfig, RateLimitResult, PusherConnectionError, PusherErrorCode } from './types';

interface RateLimitBucket {
  tokens: number;
  lastRefill: Date;
  burstTokens: number;
}

interface UserRateLimit {
  messages: RateLimitBucket;
  subscriptions: RateLimitBucket;
  connections: RateLimitBucket;
}

export class PusherRateLimiter {
  private userLimits = new Map<string, UserRateLimit>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private config: RateLimitConfig) {
    // Start cleanup process to remove old entries
    this.startCleanup();
  }

  /**
   * Check if a message is allowed for the given user
   */
  checkMessageLimit(userId: string): RateLimitResult {
    const userLimit = this.getUserLimit(userId);
    const bucket = userLimit.messages;
    
    this.refillBucket(bucket, this.config.messagesPerSecond);
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: new Date(Date.now() + 1000) // Next second
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(Date.now() + 1000),
      retryAfter: 1000
    };
  }

  /**
   * Check if a channel subscription is allowed for the given user
   */
  checkSubscriptionLimit(userId: string): RateLimitResult {
    const userLimit = this.getUserLimit(userId);
    const bucket = userLimit.subscriptions;
    
    this.refillBucket(bucket, this.config.subscriptionsPerConnection);
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: new Date(Date.now() + 60000) // Next minute
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(Date.now() + 60000),
      retryAfter: 60000
    };
  }

  /**
   * Check if a burst of messages is allowed (for batch operations)
   */
  checkBurstLimit(userId: string, messageCount: number): RateLimitResult {
    const userLimit = this.getUserLimit(userId);
    const bucket = userLimit.messages;
    
    this.refillBucket(bucket, this.config.messagesPerSecond);
    
    // Check if we have enough burst tokens
    const totalTokensNeeded = messageCount;
    const availableTokens = bucket.tokens + bucket.burstTokens;
    
    if (availableTokens >= totalTokensNeeded) {
      // Use regular tokens first, then burst tokens
      const regularTokensUsed = Math.min(bucket.tokens, totalTokensNeeded);
      bucket.tokens -= regularTokensUsed;
      
      const burstTokensUsed = totalTokensNeeded - regularTokensUsed;
      bucket.burstTokens -= burstTokensUsed;
      
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens + bucket.burstTokens),
        resetTime: new Date(Date.now() + 1000)
      };
    }

    return {
      allowed: false,
      remaining: Math.floor(availableTokens),
      resetTime: new Date(Date.now() + 1000),
      retryAfter: Math.ceil((totalTokensNeeded - availableTokens) / this.config.messagesPerSecond * 1000)
    };
  }

  /**
   * Record a rate limit violation
   */
  recordViolation(userId: string, type: 'message' | 'subscription' | 'burst'): void {
    // This could be enhanced to implement progressive penalties
    // For now, we just log the violation
    console.warn(`Rate limit violation for user ${userId}, type: ${type}`);
  }

  /**
   * Reset rate limits for a user (useful for testing or admin actions)
   */
  resetUserLimits(userId: string): void {
    this.userLimits.delete(userId);
  }

  /**
   * Get current rate limit status for a user
   */
  getUserStatus(userId: string): {
    messages: { tokens: number; resetTime: Date };
    subscriptions: { tokens: number; resetTime: Date };
  } {
    const userLimit = this.getUserLimit(userId);
    
    this.refillBucket(userLimit.messages, this.config.messagesPerSecond);
    this.refillBucket(userLimit.subscriptions, this.config.subscriptionsPerConnection);
    
    return {
      messages: {
        tokens: Math.floor(userLimit.messages.tokens),
        resetTime: new Date(userLimit.messages.lastRefill.getTime() + 1000)
      },
      subscriptions: {
        tokens: Math.floor(userLimit.subscriptions.tokens),
        resetTime: new Date(userLimit.subscriptions.lastRefill.getTime() + 60000)
      }
    };
  }

  /**
   * Cleanup old rate limit entries
   */
  cleanup(): void {
    const now = Date.now();
    const cleanupThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [userId, userLimit] of this.userLimits.entries()) {
      const lastActivity = Math.max(
        userLimit.messages.lastRefill.getTime(),
        userLimit.subscriptions.lastRefill.getTime()
      );

      if (now - lastActivity > cleanupThreshold) {
        this.userLimits.delete(userId);
      }
    }
  }

  /**
   * Destroy the rate limiter and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.userLimits.clear();
  }

  private getUserLimit(userId: string): UserRateLimit {
    if (!this.userLimits.has(userId)) {
      const now = new Date();
      this.userLimits.set(userId, {
        messages: {
          tokens: this.config.messagesPerSecond,
          lastRefill: now,
          burstTokens: this.config.burstLimit
        },
        subscriptions: {
          tokens: this.config.subscriptionsPerConnection,
          lastRefill: now,
          burstTokens: 0
        },
        connections: {
          tokens: 1, // Assuming 1 connection per user for now
          lastRefill: now,
          burstTokens: 0
        }
      });
    }
    return this.userLimits.get(userId)!;
  }

  private refillBucket(bucket: RateLimitBucket, refillRate: number): void {
    const now = new Date();
    const timeSinceLastRefill = now.getTime() - bucket.lastRefill.getTime();
    const tokensToAdd = (timeSinceLastRefill / 1000) * refillRate;
    
    bucket.tokens = Math.min(refillRate, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Refill burst tokens more slowly
    if (bucket.burstTokens < this.config.burstLimit) {
      const burstRefillRate = this.config.burstLimit / 60; // Refill burst over 1 minute
      const burstTokensToAdd = (timeSinceLastRefill / 1000) * burstRefillRate;
      bucket.burstTokens = Math.min(this.config.burstLimit, bucket.burstTokens + burstTokensToAdd);
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }
}