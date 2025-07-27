/**
 * Cache Constants and Key Builders - BE-701
 */

/**
 * Cache TTL values in seconds
 */
export const cacheTTL = {
  // User data
  userProfile: 900,           // 15 minutes
  userStats: 300,            // 5 minutes
  userPreferences: 1800,     // 30 minutes
  userActivities: 600,       // 10 minutes
  
  // Team data
  teamDetails: 600,          // 10 minutes
  teamProgress: 300,         // 5 minutes
  teamMembers: 900,          // 15 minutes
  teamActivities: 300,       // 5 minutes
  teamStats: 600,            // 10 minutes
  
  // Leaderboards
  globalLeaderboard: 900,    // 15 minutes
  teamLeaderboard: 600,      // 10 minutes
  userRanking: 300,          // 5 minutes
  
  // Dashboard
  dashboardData: 300,        // 5 minutes
  activitySummary: 600,      // 10 minutes
  progressSummary: 300,      // 5 minutes
  
  // System data
  systemConfig: 1800,        // 30 minutes
  
  // API responses
  apiResponse: 60,           // 1 minute
  apiError: 30,              // 30 seconds
  
  // Short-term caching
  session: 3600,             // 1 hour
  temporary: 300,            // 5 minutes
  
  // Long-term caching
  static: 86400,             // 24 hours
  reference: 43200,          // 12 hours
} as const;

/**
 * Cache key builders for consistent key generation
 */
export const cacheKeys = {
  // User keys
  user: {
    profile: (userId: string) => `user:profile:${userId}`,
    stats: (userId: string) => `user:stats:${userId}`,
    preferences: (userId: string) => `user:preferences:${userId}`,
    activities: (userId: string, period?: string) => 
      `user:activities:${userId}${period ? `:${period}` : ''}`,
    teams: (userId: string) => `user:teams:${userId}`,
    session: (sessionId: string) => `session:${sessionId}`,
  },
  
  // Team keys
  team: {
    details: (teamId: string) => `team:details:${teamId}`,
    progress: (teamId: string) => `team:progress:${teamId}`,
    members: (teamId: string) => `team:members:${teamId}`,
    activities: (teamId: string, period?: string) =>
      `team:activities:${teamId}${period ? `:${period}` : ''}`,
    stats: (teamId: string) => `team:stats:${teamId}`,
    goals: (teamId: string) => `team:goals:${teamId}`,
    leaderboard: (teamId: string) => `team:leaderboard:${teamId}`,
    ranking: (teamId: string) => `team:ranking:${teamId}`,
  },
  
  // Dashboard keys
  dashboard: {
    user: (userId: string) => `dashboard:user:${userId}`,
    team: (teamId: string) => `dashboard:team:${teamId}`,
    summary: (userId: string, period: string) => 
      `dashboard:summary:${userId}:${period}`,
    charts: (entityId: string, type: string, period: string) =>
      `dashboard:charts:${type}:${entityId}:${period}`,
  },
  
  // Leaderboard keys
  leaderboard: {
    global: (period?: string) => `leaderboard:global${period ? `:${period}` : ''}`,
    team: (teamId: string, period?: string) => 
      `leaderboard:team:${teamId}${period ? `:${period}` : ''}`,
    user: (userId: string, context?: string) =>
      `leaderboard:user:${userId}${context ? `:${context}` : ''}`,
  },
  
  // Activity keys
  activity: {
    details: (activityId: string) => `activity:details:${activityId}`,
    summary: (userId: string, period: string, teamId?: string) => 
      `activity:summary:${userId}:${period}${teamId ? `:${teamId}` : ''}`,
    aggregated: (entityType: string, entityId: string, period: string) =>
      `activity:aggregated:${entityType}:${entityId}:${period}`,
  },
  
  // API response keys
  api: {
    response: (endpoint: string, params: string, userId?: string) =>
      `api:response:${endpoint}:${params}${userId ? `:${userId}` : ''}`,
    error: (endpoint: string, error: string) => `api:error:${endpoint}:${error}`,
    rate_limit: (userId: string, endpoint: string) => 
      `api:rate_limit:${userId}:${endpoint}`,
  },
  
  // System keys
  system: {
    config: (key: string) => `system:config:${key}`,
  },
  
  // Lock keys (for distributed operations)
  lock: {
    user: (userId: string, operation: string) => `lock:user:${userId}:${operation}`,
    team: (teamId: string, operation: string) => `lock:team:${teamId}:${operation}`,
    system: (operation: string) => `lock:system:${operation}`,
  },
  
  // Counter keys
  counter: {
    api_calls: (endpoint: string, period: string) => `counter:api_calls:${endpoint}:${period}`,
    user_actions: (userId: string, action: string, period: string) =>
      `counter:user_actions:${userId}:${action}:${period}`,
    team_actions: (teamId: string, action: string, period: string) =>
      `counter:team_actions:${teamId}:${action}:${period}`,
  },
} as const;

/**
 * Cache tags for bulk invalidation
 */
export const cacheTags = {
  user: (userId: string) => [`user:${userId}`],
  team: (teamId: string) => [`team:${teamId}`],
  leaderboard: () => ['leaderboard'],
  dashboard: () => ['dashboard'],
  activities: () => ['activities'],
  system: () => ['system'],
} as const;

/**
 * Cache configuration presets
 */
export const cachePresets = {
  // High-frequency, short-lived data
  realtime: {
    ttl: cacheTTL.temporary,
    enableCompression: false,
    tags: ['realtime'],
  },
  
  // User-specific data with medium TTL
  userSession: {
    ttl: cacheTTL.session,
    enableCompression: true,
    compressionThreshold: 1024,
  },
  
  // Team data with coordinated invalidation
  teamData: {
    ttl: cacheTTL.teamDetails,
    enableCompression: true,
    tags: ['team'],
  },
  
  // API responses with short TTL
  apiResponse: {
    ttl: cacheTTL.apiResponse,
    enableCompression: true,
    compressionThreshold: 512,
    tags: ['api'],
  },
  
  // Long-lived reference data
  reference: {
    ttl: cacheTTL.reference,
    enableCompression: true,
    tags: ['reference'],
  },
} as const;