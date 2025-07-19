/**
 * Table Partitioning Service - DB-701
 * Implements partitioning strategies for large tables
 */

import { PrismaClient } from '@prisma/client';

export interface PartitionConfig {
  tableName: string;
  partitionType: 'range' | 'list' | 'hash';
  partitionColumn: string;
  partitionStrategy: 'monthly' | 'yearly' | 'custom';
  retentionMonths?: number;
}

export interface Partition {
  name: string;
  parent: string;
  rangeStart?: Date;
  rangeEnd?: Date;
  constraint: string;
  rowCount: number;
  sizeMB: number;
}

export class TablePartitioningService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Set up partitioning for large tables
   */
  async setupPartitioning(): Promise<void> {
    console.log('Setting up table partitioning for DB-701...');
    
    // Partition activities table by month
    await this.partitionActivitiesTable();
    
    // Partition notifications table by month
    await this.partitionNotificationsTable();
    
    // Set up automatic partition management
    await this.setupAutomaticPartitionManagement();
    
    console.log('Table partitioning setup complete');
  }

  /**
   * Partition activities table by month
   */
  private async partitionActivitiesTable(): Promise<void> {
    console.log('Partitioning activities table...');
    
    // Create partitioned table
    const createPartitionedTable = `
      -- Create new partitioned table
      CREATE TABLE IF NOT EXISTS activities_partitioned (
        LIKE activities INCLUDING ALL
      ) PARTITION BY RANGE (start_time);
      
      -- Create function to automatically create monthly partitions
      CREATE OR REPLACE FUNCTION create_activities_partition(start_date DATE)
      RETURNS void AS $$
      DECLARE
        partition_name TEXT;
        start_of_month DATE;
        end_of_month DATE;
      BEGIN
        start_of_month := DATE_TRUNC('month', start_date);
        end_of_month := start_of_month + INTERVAL '1 month';
        partition_name := 'activities_' || TO_CHAR(start_of_month, 'YYYY_MM');
        
        -- Check if partition already exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
          EXECUTE format(
            'CREATE TABLE %I PARTITION OF activities_partitioned 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_of_month,
            end_of_month
          );
          
          -- Create indexes on partition
          EXECUTE format(
            'CREATE INDEX %I ON %I (user_id, start_time)',
            partition_name || '_user_time_idx',
            partition_name
          );
          
          EXECUTE format(
            'CREATE INDEX %I ON %I (team_id, start_time)',
            partition_name || '_team_time_idx',
            partition_name
          );
          
          EXECUTE format(
            'CREATE INDEX %I ON %I (is_private, start_time) WHERE is_private = false',
            partition_name || '_public_idx',
            partition_name
          );
          
          RAISE NOTICE 'Created partition %', partition_name;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `;

    try {
      await this.prisma.$executeRawUnsafe(createPartitionedTable);
      
      // Create partitions for existing data
      await this.createHistoricalPartitions('activities');
      
      // Create future partitions
      await this.createFuturePartitions('activities', 3);
      
      console.log('Activities table partitioning complete');
    } catch (error) {
      console.error('Failed to partition activities table:', error);
    }
  }

  /**
   * Partition notifications table by month
   */
  private async partitionNotificationsTable(): Promise<void> {
    console.log('Partitioning notifications table...');
    
    const createPartitionedTable = `
      -- Create new partitioned table
      CREATE TABLE IF NOT EXISTS notifications_partitioned (
        LIKE notifications INCLUDING ALL
      ) PARTITION BY RANGE (created_at);
      
      -- Create function to automatically create monthly partitions
      CREATE OR REPLACE FUNCTION create_notifications_partition(start_date DATE)
      RETURNS void AS $$
      DECLARE
        partition_name TEXT;
        start_of_month DATE;
        end_of_month DATE;
      BEGIN
        start_of_month := DATE_TRUNC('month', start_date);
        end_of_month := start_of_month + INTERVAL '1 month';
        partition_name := 'notifications_' || TO_CHAR(start_of_month, 'YYYY_MM');
        
        IF NOT EXISTS (
          SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
          EXECUTE format(
            'CREATE TABLE %I PARTITION OF notifications_partitioned 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_of_month,
            end_of_month
          );
          
          -- Create indexes on partition
          EXECUTE format(
            'CREATE INDEX %I ON %I (user_id, created_at DESC)',
            partition_name || '_user_time_idx',
            partition_name
          );
          
          EXECUTE format(
            'CREATE INDEX %I ON %I (user_id, status) WHERE read_at IS NULL',
            partition_name || '_unread_idx',
            partition_name
          );
          
          RAISE NOTICE 'Created partition %', partition_name;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `;

    try {
      await this.prisma.$executeRawUnsafe(createPartitionedTable);
      
      // Create partitions for existing data
      await this.createHistoricalPartitions('notifications');
      
      // Create future partitions
      await this.createFuturePartitions('notifications', 3);
      
      console.log('Notifications table partitioning complete');
    } catch (error) {
      console.error('Failed to partition notifications table:', error);
    }
  }

  /**
   * Create partitions for historical data
   */
  private async createHistoricalPartitions(tableName: string): Promise<void> {
    // Get date range of existing data
    const dateColumn = tableName === 'activities' ? 'start_time' : 'created_at';
    const dateRange = await this.prisma.$queryRaw<Array<{
      min_date: Date;
      max_date: Date;
    }>>`
      SELECT 
        MIN(${dateColumn}) as min_date,
        MAX(${dateColumn}) as max_date
      FROM ${tableName}
    `;

    if (!dateRange[0] || !dateRange[0].min_date) {
      return;
    }

    const startDate = new Date(dateRange[0].min_date);
    const endDate = new Date(dateRange[0].max_date);
    
    // Create monthly partitions
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (current <= endDate) {
      const functionName = tableName === 'activities' 
        ? 'create_activities_partition' 
        : 'create_notifications_partition';
      
      await this.prisma.$executeRawUnsafe(
        `SELECT ${functionName}('${current.toISOString()}'::DATE)`
      );
      
      current.setMonth(current.getMonth() + 1);
    }
  }

  /**
   * Create future partitions
   */
  private async createFuturePartitions(tableName: string, months: number): Promise<void> {
    const current = new Date();
    
    for (let i = 0; i < months; i++) {
      const functionName = tableName === 'activities' 
        ? 'create_activities_partition' 
        : 'create_notifications_partition';
      
      await this.prisma.$executeRawUnsafe(
        `SELECT ${functionName}('${current.toISOString()}'::DATE)`
      );
      
      current.setMonth(current.getMonth() + 1);
    }
  }

  /**
   * Set up automatic partition management
   */
  private async setupAutomaticPartitionManagement(): Promise<void> {
    // Create partition management function
    const managementFunction = `
      CREATE OR REPLACE FUNCTION manage_partitions()
      RETURNS void AS $$
      DECLARE
        future_date DATE;
      BEGIN
        -- Create partitions for next 3 months
        future_date := DATE_TRUNC('month', NOW());
        
        FOR i IN 0..2 LOOP
          PERFORM create_activities_partition(future_date);
          PERFORM create_notifications_partition(future_date);
          future_date := future_date + INTERVAL '1 month';
        END LOOP;
        
        -- Drop old partitions (optional - based on retention policy)
        PERFORM drop_old_partitions('activities_partitioned', 12); -- Keep 12 months
        PERFORM drop_old_partitions('notifications_partitioned', 6); -- Keep 6 months
      END;
      $$ LANGUAGE plpgsql;
      
      -- Function to drop old partitions
      CREATE OR REPLACE FUNCTION drop_old_partitions(
        parent_table TEXT, 
        retention_months INTEGER
      )
      RETURNS void AS $$
      DECLARE
        partition_record RECORD;
        cutoff_date DATE;
      BEGIN
        cutoff_date := DATE_TRUNC('month', NOW() - (retention_months || ' months')::INTERVAL);
        
        FOR partition_record IN
          SELECT 
            c.relname AS partition_name,
            pg_get_expr(c.relpartbound, c.oid) AS partition_bound
          FROM pg_class c
          JOIN pg_inherits i ON c.oid = i.inhrelid
          JOIN pg_class p ON i.inhparent = p.oid
          WHERE p.relname = parent_table
            AND c.relkind = 'r'
        LOOP
          -- Parse partition bound to get date
          -- This is simplified - in production you'd parse the bound expression
          IF partition_record.partition_bound LIKE '%' || TO_CHAR(cutoff_date, 'YYYY-MM') || '%' THEN
            EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.partition_name);
            RAISE NOTICE 'Dropped old partition %', partition_record.partition_name;
          END IF;
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `;

    try {
      await this.prisma.$executeRawUnsafe(managementFunction);
      
      // Create scheduled job to manage partitions (using pg_cron if available)
      await this.createPartitionMaintenanceJob();
      
      console.log('Automatic partition management set up');
    } catch (error) {
      console.error('Failed to set up partition management:', error);
    }
  }

  /**
   * Create maintenance job for partitions
   */
  private async createPartitionMaintenanceJob(): Promise<void> {
    // Check if pg_cron is available
    const hasPgCron = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
      ) as exists
    `;

    if (hasPgCron[0]?.exists) {
      // Schedule monthly partition maintenance
      await this.prisma.$executeRawUnsafe(`
        SELECT cron.schedule(
          'partition-maintenance',
          '0 0 1 * *', -- First day of each month at midnight
          'SELECT manage_partitions()'
        )
      `);
      console.log('Scheduled partition maintenance with pg_cron');
    } else {
      console.log('pg_cron not available - partition maintenance must be run manually');
    }
  }

  /**
   * Migrate data from non-partitioned to partitioned table
   */
  async migrateToPartitionedTable(
    tableName: string,
    batchSize = 10000
  ): Promise<void> {
    console.log(`Migrating ${tableName} to partitioned table...`);
    
    const partitionedTable = `${tableName}_partitioned`;
    
    // Get total row count
    const countResult = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM ${tableName}
    `;
    const totalRows = Number(countResult[0].count);
    
    console.log(`Total rows to migrate: ${totalRows}`);
    
    // Migrate in batches
    let offset = 0;
    let migrated = 0;
    
    while (offset < totalRows) {
      // Copy batch to partitioned table
      const dateColumn = tableName === 'activities' ? 'start_time' : 'created_at';
      
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO ${partitionedTable}
        SELECT * FROM ${tableName}
        ORDER BY ${dateColumn}
        LIMIT ${batchSize}
        OFFSET ${offset}
        ON CONFLICT DO NOTHING
      `);
      
      migrated += batchSize;
      offset += batchSize;
      
      const progress = Math.min(100, (migrated / totalRows) * 100);
      console.log(`Migration progress: ${progress.toFixed(2)}%`);
    }
    
    console.log(`Migration complete for ${tableName}`);
  }

  /**
   * Get partition statistics
   */
  async getPartitionStats(parentTable: string): Promise<Partition[]> {
    const stats = await this.prisma.$queryRaw<Array<{
      partition_name: string;
      parent_name: string;
      partition_bound: string;
      row_count: bigint;
      size_mb: number;
    }>>`
      SELECT 
        c.relname as partition_name,
        p.relname as parent_name,
        pg_get_expr(c.relpartbound, c.oid) as partition_bound,
        c.reltuples::bigint as row_count,
        pg_total_relation_size(c.oid) / 1024.0 / 1024.0 as size_mb
      FROM pg_class c
      JOIN pg_inherits i ON c.oid = i.inhrelid
      JOIN pg_class p ON i.inhparent = p.oid
      WHERE p.relname = ${parentTable}
        AND c.relkind = 'r'
      ORDER BY c.relname
    `;

    return stats.map(stat => ({
      name: stat.partition_name,
      parent: stat.parent_name,
      constraint: stat.partition_bound,
      rowCount: Number(stat.row_count),
      sizeMB: stat.size_mb,
    }));
  }

  /**
   * Optimize partition constraints
   */
  async optimizePartitionConstraints(): Promise<void> {
    // Add constraint exclusion
    await this.prisma.$executeRaw`
      ALTER SYSTEM SET constraint_exclusion = 'partition'
    `;
    
    // Enable partition pruning
    await this.prisma.$executeRaw`
      ALTER SYSTEM SET enable_partition_pruning = 'on'
    `;
    
    // Reload configuration
    await this.prisma.$executeRaw`
      SELECT pg_reload_conf()
    `;
    
    console.log('Partition constraints optimized');
  }

  /**
   * Create partition-aware indexes
   */
  async createPartitionIndexes(parentTable: string): Promise<void> {
    const partitions = await this.getPartitionStats(parentTable);
    
    for (const partition of partitions) {
      // Create optimized indexes for each partition
      if (parentTable === 'activities_partitioned') {
        await this.createActivityPartitionIndexes(partition.name);
      } else if (parentTable === 'notifications_partitioned') {
        await this.createNotificationPartitionIndexes(partition.name);
      }
    }
  }

  /**
   * Create indexes for activity partition
   */
  private async createActivityPartitionIndexes(partitionName: string): Promise<void> {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS ${partitionName}_user_team_idx 
       ON ${partitionName} (user_id, team_id)`,
      
      `CREATE INDEX IF NOT EXISTS ${partitionName}_distance_idx 
       ON ${partitionName} (distance) 
       WHERE distance > 0`,
      
      `CREATE INDEX IF NOT EXISTS ${partitionName}_public_rank_idx 
       ON ${partitionName} (team_id, distance DESC) 
       WHERE is_private = false`,
    ];

    for (const sql of indexes) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (error) {
        console.error(`Failed to create index on ${partitionName}:`, error);
      }
    }
  }

  /**
   * Create indexes for notification partition
   */
  private async createNotificationPartitionIndexes(partitionName: string): Promise<void> {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS ${partitionName}_user_unread_idx 
       ON ${partitionName} (user_id, created_at DESC) 
       WHERE read_at IS NULL`,
      
      `CREATE INDEX IF NOT EXISTS ${partitionName}_scheduled_idx 
       ON ${partitionName} (scheduled_for) 
       WHERE status = 'SCHEDULED'`,
    ];

    for (const sql of indexes) {
      try {
        await this.prisma.$executeRawUnsafe(sql);
      } catch (error) {
        console.error(`Failed to create index on ${partitionName}:`, error);
      }
    }
  }
}