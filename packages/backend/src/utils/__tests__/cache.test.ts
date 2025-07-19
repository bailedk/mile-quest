import { cache, cacheKeys, cacheTTL } from '../cache';

describe('Cache Utilities', () => {
  beforeEach(() => {
    // Clear cache before each test
    cache.clear();
  });

  afterAll(() => {
    // Clean up resources
    cache.destroy();
  });

  describe('cache operations', () => {
    it('should set and get values', () => {
      const key = 'test-key';
      const value = { data: 'test value' };
      const ttl = 60; // 60 seconds
      
      cache.set(key, value, ttl);
      const retrieved = cache.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete values', () => {
      const key = 'test-key';
      cache.set(key, 'value', 60);
      
      cache.delete(key);
      
      expect(cache.get(key)).toBeNull();
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should expire values after TTL', () => {
      jest.useFakeTimers();
      const key = 'test-key';
      const value = 'test-value';
      const ttlSeconds = 5;
      
      cache.set(key, value, ttlSeconds);
      expect(cache.get(key)).toBe(value);
      
      // Advance time past TTL
      jest.advanceTimersByTime((ttlSeconds + 1) * 1000);
      
      expect(cache.get(key)).toBeNull();
      jest.useRealTimers();
    });

    it('should track cache size', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
      
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('cacheKeys', () => {
    it('should generate correct team progress key', () => {
      const teamId = 'team-123';
      const key = cacheKeys.teamProgress(teamId);
      expect(key).toBe('team:progress:team-123');
    });

    it('should generate correct user stats key', () => {
      const userId = 'user-456';
      const key = cacheKeys.userStats(userId);
      expect(key).toBe('user:stats:user-456');
    });

    it('should generate correct activity summary key without teamId', () => {
      const userId = 'user-789';
      const period = 'weekly';
      const key = cacheKeys.activitySummary(userId, period);
      expect(key).toBe('activity:summary:user-789:weekly');
    });

    it('should generate correct activity summary key with teamId', () => {
      const userId = 'user-999';
      const period = 'monthly';
      const teamId = 'team-999';
      const key = cacheKeys.activitySummary(userId, period, teamId);
      expect(key).toBe('activity:summary:user-999:monthly:team-999');
    });
  });

  describe('cacheTTL', () => {
    it('should have correct TTL values', () => {
      expect(cacheTTL.userStats).toBe(300); // 5 minutes
      expect(cacheTTL.teamProgress).toBe(300); // 5 minutes
      expect(cacheTTL.activitySummary).toBe(600); // 10 minutes
    });
  });
});