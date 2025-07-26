/**
 * Advanced Indexing Service - DB-701
 * Implements advanced indexing strategies including partial, covering, and expression indexes
 */

import { PrismaClient } from '@prisma/client';

export interface AdvancedIndex {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'partial' | 'covering' | 'expression';
  condition?: string;
  includes?: string[];
  expression?: string;
  created?: boolean;
}

export class AdvancedIndexingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create all advanced indexes for optimal performance
   */
  async createAdvancedIndexes(): Promise<void> {
    console.log('Creating advanced indexes for DB-701...');
    
    // Create partial indexes
    await this.createPartialIndexes();
    
    // Create covering indexes
    await this.createCoveringIndexes();
    
    // Create expression indexes
    await this.createExpressionIndexes();
    
    // Create specialized indexes for complex queries
    await this.createSpecializedIndexes();
    
    console.log('Advanced indexes created successfully');
  }

  /**
   * Create partial indexes for common query patterns
   */
  private async createPartialIndexes(): Promise<void> {
    const partialIndexes: AdvancedIndex[] = [
      // Activities - Public activities only (for leaderboards)
      {
        name: 'idx_activities_public_user_date',
        table: 'activities',
        columns: ['user_id', 'start_time'],
        type: 'partial',
        condition: 'is_private = false',
      },
      {
        name: 'idx_activities_public_team_date',
        table: 'activities',
        columns: ['team_id', 'start_time'],
        type: 'partial',
        condition: 'is_private = false',
      },
      {
        name: 'idx_activities_public_distance_date',
        table: 'activities',
        columns: ['distance', 'start_time'],
        type: 'partial',
        condition: 'is_private = false AND distance > 0',
      },
      // Team members - Active members only
      {
        name: 'idx_team_members_active_team_user',
        table: 'team_members',
        columns: ['team_id', 'user_id'],
        type: 'partial',
        condition: 'left_at IS NULL',
      },
      {
        name: 'idx_team_members_active_admins',
        table: 'team_members',
        columns: ['team_id', 'role'],
        type: 'partial',
        condition: 'left_at IS NULL AND role = \'ADMIN\'',
      },
      // Teams - Public teams only
      {
        name: 'idx_teams_public_active',
        table: 'teams',
        columns: ['created_at', 'name'],
        type: 'partial',
        condition: 'is_public = true AND deleted_at IS NULL',
      },
      // Team invites - Valid invites only
      {
        name: 'idx_team_invites_valid',
        table: 'team_invites',
        columns: ['code', 'team_id'],
        type: 'partial',
        condition: 'status = \'PENDING\' AND expires_at > NOW()',
      },
    ];

    for (const index of partialIndexes) {
      await this.createPartialIndex(index);
    }
  }

  /**
   * Create covering indexes for index-only scans
   */
  private async createCoveringIndexes(): Promise<void> {
    const coveringIndexes: AdvancedIndex[] = [
      // Dashboard queries - User stats with all needed data
      {
        name: 'idx_activities_user_dashboard_covering',
        table: 'activities',
        columns: ['user_id', 'start_time'],
        type: 'covering',
        includes: ['distance', 'duration', 'team_id', 'is_private'],
      },
      // Team leaderboard queries
      {
        name: 'idx_activities_team_leaderboard_covering',
        table: 'activities',
        columns: ['team_id', 'user_id', 'is_private'],
        type: 'covering',
        includes: ['distance', 'start_time'],
      },
      // User profile queries
      {
        name: 'idx_users_profile_covering',
        table: 'users',
        columns: ['id'],
        type: 'covering',
        includes: ['name', 'email', 'avatar_url', 'created_at'],
      },
      // Team member listings
      {
        name: 'idx_team_members_listing_covering',
        table: 'team_members',
        columns: ['team_id', 'left_at'],
        type: 'covering',
        includes: ['user_id', 'role', 'joined_at'],
      },
      // Achievement progress queries
      {
        name: 'idx_user_achievements_progress_covering',
        table: 'user_achievements',
        columns: ['user_id', 'achievement_id'],
        type: 'covering',
        includes: ['earned_at', 'team_id'],
      },
    ];

    for (const index of coveringIndexes) {
      await this.createCoveringIndex(index);
    }
  }

  /**
   * Create expression indexes for computed values
   */
  private async createExpressionIndexes(): Promise<void> {
    const expressionIndexes: AdvancedIndex[] = [
      // Date truncation for daily/weekly/monthly aggregations
      {
        name: 'idx_activities_date_trunc_day',
        table: 'activities',
        columns: [],
        type: 'expression',
        expression: 'DATE_TRUNC(\'day\', start_time)',
      },
      {
        name: 'idx_activities_date_trunc_week',
        table: 'activities',
        columns: [],
        type: 'expression',
        expression: 'DATE_TRUNC(\'week\', start_time)',
      },
      {
        name: 'idx_activities_date_trunc_month',
        table: 'activities',
        columns: [],
        type: 'expression',
        expression: 'DATE_TRUNC(\'month\', start_time)',
      },
      // Lower case searches
      {
        name: 'idx_users_email_lower',
        table: 'users',
        columns: [],
        type: 'expression',
        expression: 'LOWER(email)',
      },
      {
        name: 'idx_teams_name_lower',
        table: 'teams',
        columns: [],
        type: 'expression',
        expression: 'LOWER(name)',
      },
      // Activity pace calculation (meters per minute)
      {
        name: 'idx_activities_pace',
        table: 'activities',
        columns: [],
        type: 'expression',
        expression: '(distance / NULLIF(duration, 0))',
      },
      // Days since last activity (for streak calculations)
      {
        name: 'idx_user_stats_days_since_activity',
        table: 'user_stats',
        columns: [],
        type: 'expression',
        expression: 'EXTRACT(DAY FROM (NOW() - last_activity_at))',
      },
    ];

    for (const index of expressionIndexes) {
      await this.createExpressionIndex(index);
    }
  }

  /**
   * Create specialized indexes for complex query patterns
   */
  private async createSpecializedIndexes(): Promise<void> {
    // GIN indexes for JSON columns
    await this.createGinIndexes();
    
    // Hash indexes for equality comparisons
    await this.createHashIndexes();
    
    // Composite indexes for complex queries
    await this.createCompositeIndexes();
  }

  /**
   * Create GIN indexes for JSON columns
   */
  private async createGinIndexes(): Promise<void> {
    const ginIndexes = [
      // Team goal waypoints
      'CREATE INDEX IF NOT EXISTS idx_team_goals_waypoints_gin ON team_goals USING gin (waypoints)',
      // Team goal route data
      'CREATE INDEX IF NOT EXISTS idx_team_goals_route_data_gin ON team_goals USING gin (route_data)',
      // Achievement criteria
      'CREATE INDEX IF NOT EXISTS idx_achievements_criteria_gin ON achievements USING gin (criteria)',
    ];

    for (const sql of ginIndexes) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
        console.log(`Created GIN index: ${sql.match(/idx_\w+/)?.[0]}`);
      } catch (error) {
        console.error(`Failed to create GIN index:`, error);
      }
    }
  }

  /**
   * Create hash indexes for exact match queries
   */
  private async createHashIndexes(): Promise<void> {
    const hashIndexes = [
      // User lookups by cognito ID
      'CREATE INDEX IF NOT EXISTS idx_users_cognito_id_hash ON users USING hash (cognito_id)',
      // Team invite code lookups
      'CREATE INDEX IF NOT EXISTS idx_team_invites_code_hash ON team_invites USING hash (code)',
      // Activity external ID lookups
      'CREATE INDEX IF NOT EXISTS idx_activities_external_id_hash ON activities USING hash (external_id) WHERE external_id IS NOT NULL',
    ];

    for (const sql of hashIndexes) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
        console.log(`Created hash index: ${sql.match(/idx_\w+/)?.[0]}`);
      } catch (error) {
        console.error(`Failed to create hash index:`, error);
      }
    }
  }

  /**
   * Create composite indexes for complex queries
   */
  private async createCompositeIndexes(): Promise<void> {
    const compositeIndexes = [
      // Complex leaderboard queries
      'CREATE INDEX IF NOT EXISTS idx_activities_leaderboard_complex ON activities (team_id, is_private, start_time DESC, distance DESC, user_id)',
      // User activity history with filters
      'CREATE INDEX IF NOT EXISTS idx_activities_user_history_complex ON activities (user_id, team_id, is_private, start_time DESC) INCLUDE (distance, duration)',
      // Team member activity summary
      'CREATE INDEX IF NOT EXISTS idx_activities_team_member_summary ON activities (team_id, user_id, start_time) INCLUDE (distance, duration) WHERE is_private = false',
      // Achievement progress tracking
      'CREATE INDEX IF NOT EXISTS idx_user_achievements_progress ON user_achievements (user_id, earned_at DESC) INCLUDE (achievement_id, team_id)',
    ];

    for (const sql of compositeIndexes) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
        console.log(`Created composite index: ${sql.match(/idx_\w+/)?.[0]}`);
      } catch (error) {
        console.error(`Failed to create composite index:`, error);
      }
    }
  }

  /**
   * Helper method to create a partial index
   */
  private async createPartialIndex(index: AdvancedIndex): Promise<void> {
    const sql = `
      CREATE INDEX IF NOT EXISTS ${index.name}
      ON ${index.table} (${index.columns.join(', ')})
      WHERE ${index.condition}
    `;

    try {
      await this.prisma.$executeRawUnsafe(sql);
      console.log(`Created partial index: ${index.name}`);
    } catch (error) {
      console.error(`Failed to create partial index ${index.name}:`, error);
    }
  }

  /**
   * Helper method to create a covering index
   */
  private async createCoveringIndex(index: AdvancedIndex): Promise<void> {
    const sql = `
      CREATE INDEX IF NOT EXISTS ${index.name}
      ON ${index.table} (${index.columns.join(', ')})
      INCLUDE (${index.includes?.join(', ')})
    `;

    try {
      await this.prisma.$executeRawUnsafe(sql);
      console.log(`Created covering index: ${index.name}`);
    } catch (error) {
      console.error(`Failed to create covering index ${index.name}:`, error);
    }
  }

  /**
   * Helper method to create an expression index
   */
  private async createExpressionIndex(index: AdvancedIndex): Promise<void> {
    const sql = `
      CREATE INDEX IF NOT EXISTS ${index.name}
      ON ${index.table} ((${index.expression}))
    `;

    try {
      await this.prisma.$executeRawUnsafe(sql);
      console.log(`Created expression index: ${index.name}`);
    } catch (error) {
      console.error(`Failed to create expression index ${index.name}:`, error);
    }
  }

  /**
   * Analyze index usage and recommend improvements
   */
  async analyzeIndexUsage(): Promise<{
    unusedIndexes: string[];
    redundantIndexes: string[];
    missingIndexes: string[];
  }> {
    // Find unused indexes
    const unusedIndexes = await this.prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexrelname NOT LIKE 'pk_%'
        AND indexrelname NOT LIKE '%_pkey'
    `;

    // Find redundant indexes (indexes that are prefixes of other indexes)
    const redundantIndexes = await this.findRedundantIndexes();

    // Find missing indexes based on slow queries
    const missingIndexes = await this.findMissingIndexes();

    return {
      unusedIndexes: unusedIndexes.map(idx => idx.indexname),
      redundantIndexes,
      missingIndexes,
    };
  }

  /**
   * Find redundant indexes
   */
  private async findRedundantIndexes(): Promise<string[]> {
    const allIndexes = await this.prisma.$queryRaw<Array<{
      indexname: string;
      columns: string[];
    }>>`
      SELECT 
        i.relname as indexname,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND i.relname NOT LIKE 'pk_%'
        AND i.relname NOT LIKE '%_pkey'
      GROUP BY i.relname
    `;

    const redundant: string[] = [];

    // Check if any index is a prefix of another
    for (let i = 0; i < allIndexes.length; i++) {
      for (let j = 0; j < allIndexes.length; j++) {
        if (i !== j) {
          const idx1 = allIndexes[i];
          const idx2 = allIndexes[j];
          
          // Check if idx1 columns are a prefix of idx2 columns
          if (idx2.columns.length > idx1.columns.length) {
            const isPrefix = idx1.columns.every((col, index) => 
              col === idx2.columns[index]
            );
            
            if (isPrefix) {
              redundant.push(idx1.indexname);
            }
          }
        }
      }
    }

    return [...new Set(redundant)];
  }

  /**
   * Find missing indexes based on query patterns
   */
  private async findMissingIndexes(): Promise<string[]> {
    // This would analyze pg_stat_statements or slow query log
    // For now, return common patterns
    return [
      'Consider index on activities(user_id, team_id, start_time) for multi-team queries',
      'Consider index on team_goals(team_id, status) for active goal queries',
    ];
  }

  /**
   * Drop unused indexes to save space
   */
  async dropUnusedIndexes(dryRun = true): Promise<string[]> {
    const { unusedIndexes } = await this.analyzeIndexUsage();
    const dropped: string[] = [];

    for (const indexName of unusedIndexes) {
      const sql = `DROP INDEX IF EXISTS ${indexName}`;
      
      if (dryRun) {
        console.log(`Would drop: ${sql}`);
      } else {
        try {
          await this.prisma.$executeRawUnsafe(sql);
          dropped.push(indexName);
          console.log(`Dropped unused index: ${indexName}`);
        } catch (error) {
          console.error(`Failed to drop index ${indexName}:`, error);
        }
      }
    }

    return dropped;
  }
}