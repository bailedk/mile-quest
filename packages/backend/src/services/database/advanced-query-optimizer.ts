/**
 * Advanced Query Optimizer Service - DB-701
 * Implements advanced query optimization techniques beyond materialized views
 */

import { PrismaClient } from '@prisma/client';

export interface QueryAnalysis {
  query: string;
  executionTime: number;
  planType: string;
  cost: number;
  recommendations: OptimizationRecommendation[];
  suggestedIndexes: IndexRecommendation[];
  rewrittenQuery?: string;
}

export interface OptimizationRecommendation {
  type: 'index' | 'rewrite' | 'partition' | 'cache' | 'statistics';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedImprovement: string;
  implementation: string;
}

export interface IndexRecommendation {
  tableName: string;
  columns: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist' | 'partial' | 'covering' | 'expression';
  condition?: string;
  includes?: string[];
  estimatedSizeKB: number;
  estimatedImprovement: string;
}

export interface PartitioningStrategy {
  tableName: string;
  partitionType: 'range' | 'list' | 'hash';
  partitionColumn: string;
  partitionCount?: number;
  partitionRanges?: Array<{ name: string; from: any; to: any }>;
  estimatedBenefit: string;
}

export class AdvancedQueryOptimizer {
  private queryCache = new Map<string, QueryAnalysis>();
  private indexSuggestionHistory = new Map<string, IndexRecommendation[]>();
  
  constructor(private prisma: PrismaClient) {}

  /**
   * Analyze query and provide optimization recommendations
   */
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    // Check cache first
    const cached = this.queryCache.get(query);
    if (cached && (Date.now() - cached.executionTime < 3600000)) { // 1 hour cache
      return cached;
    }

    try {
      // Get query plan
      const explainResult = await this.prisma.$queryRawUnsafe(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      );
      
      const plan = explainResult[0]?.['QUERY PLAN']?.[0];
      
      // Analyze the plan
      const analysis: QueryAnalysis = {
        query,
        executionTime: plan?.['Execution Time'] || 0,
        planType: plan?.['Node Type'] || 'Unknown',
        cost: plan?.['Total Cost'] || 0,
        recommendations: [],
        suggestedIndexes: [],
      };

      // Generate recommendations
      analysis.recommendations = await this.generateRecommendations(plan, query);
      analysis.suggestedIndexes = await this.suggestIndexes(plan, query);
      
      // Try query rewriting
      const rewritten = await this.rewriteQuery(query, plan);
      if (rewritten && rewritten !== query) {
        analysis.rewrittenQuery = rewritten;
      }

      // Cache the analysis
      this.queryCache.set(query, analysis);
      
      return analysis;
    } catch (error) {
      console.error('Query analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate optimization recommendations based on query plan
   */
  private async generateRecommendations(
    plan: any, 
    query: string
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for sequential scans
    if (this.hasSequentialScan(plan)) {
      recommendations.push({
        type: 'index',
        severity: 'high',
        description: 'Sequential scan detected on large table',
        estimatedImprovement: '50-80% faster query execution',
        implementation: 'Create appropriate index on filter columns',
      });
    }

    // Check for missing join indexes
    if (this.hasMissingJoinIndex(plan)) {
      recommendations.push({
        type: 'index',
        severity: 'high',
        description: 'Join operation without proper indexes',
        estimatedImprovement: '60-90% faster joins',
        implementation: 'Create composite index on join columns',
      });
    }

    // Check for suboptimal aggregations
    if (this.hasSuboptimalAggregation(plan)) {
      recommendations.push({
        type: 'rewrite',
        severity: 'medium',
        description: 'Aggregation could be optimized with window functions',
        estimatedImprovement: '30-50% faster aggregation',
        implementation: 'Use window functions instead of subqueries',
      });
    }

    // Check if partitioning would help
    if (await this.wouldBenefitFromPartitioning(query, plan)) {
      recommendations.push({
        type: 'partition',
        severity: 'medium',
        description: 'Table would benefit from partitioning',
        estimatedImprovement: '40-70% faster for time-based queries',
        implementation: 'Implement range partitioning on date columns',
      });
    }

    // Check for stale statistics
    if (this.hasStaleStatistics(plan)) {
      recommendations.push({
        type: 'statistics',
        severity: 'low',
        description: 'Table statistics appear to be outdated',
        estimatedImprovement: 'Better query planning',
        implementation: 'Run ANALYZE on affected tables',
      });
    }

    return recommendations;
  }

  /**
   * Suggest indexes based on query pattern
   */
  private async suggestIndexes(plan: any, query: string): Promise<IndexRecommendation[]> {
    const suggestions: IndexRecommendation[] = [];
    const tables = this.extractTablesFromQuery(query);

    for (const table of tables) {
      // Check for missing indexes on filter columns
      const filterColumns = this.extractFilterColumns(query, table);
      if (filterColumns.length > 0) {
        const existingIndexes = await this.getExistingIndexes(table);
        const missingIndexes = this.findMissingIndexes(filterColumns, existingIndexes);
        
        for (const columns of missingIndexes) {
          suggestions.push({
            tableName: table,
            columns,
            indexType: 'btree',
            estimatedSizeKB: await this.estimateIndexSize(table, columns),
            estimatedImprovement: '50-80% faster queries',
          });
        }
      }

      // Suggest partial indexes for common conditions
      const partialIndexCandidates = await this.findPartialIndexCandidates(query, table);
      suggestions.push(...partialIndexCandidates);

      // Suggest covering indexes for SELECT queries
      if (query.toLowerCase().includes('select')) {
        const coveringIndexes = await this.suggestCoveringIndexes(query, table);
        suggestions.push(...coveringIndexes);
      }

      // Suggest expression indexes for computed columns
      const expressionIndexes = await this.suggestExpressionIndexes(query, table);
      suggestions.push(...expressionIndexes);
    }

    return suggestions;
  }

  /**
   * Rewrite query for better performance
   */
  private async rewriteQuery(originalQuery: string, plan: any): Promise<string | null> {
    let rewritten = originalQuery;

    // Convert correlated subqueries to joins
    rewritten = this.convertCorrelatedSubqueries(rewritten);

    // Replace IN with EXISTS where beneficial
    rewritten = this.optimizeInClauses(rewritten);

    // Use CTEs for complex queries
    rewritten = this.introduceCTEs(rewritten);

    // Optimize aggregations with window functions
    rewritten = this.optimizeAggregations(rewritten);

    // Push down predicates
    rewritten = this.pushDownPredicates(rewritten);

    // If no changes were made, return null
    return rewritten !== originalQuery ? rewritten : null;
  }

  /**
   * Suggest partitioning strategies for large tables
   */
  async suggestPartitioning(tableName: string): Promise<PartitioningStrategy | null> {
    // Get table size and row count
    const tableStats = await this.prisma.$queryRaw<Array<{
      size_mb: number;
      row_count: number;
    }>>`
      SELECT 
        pg_total_relation_size('${tableName}') / 1024.0 / 1024.0 as size_mb,
        reltuples::bigint as row_count
      FROM pg_class
      WHERE relname = ${tableName}
    `;

    if (!tableStats[0] || tableStats[0].size_mb < 1000) { // Less than 1GB
      return null;
    }

    // Analyze common query patterns
    const queryPatterns = await this.analyzeTableQueryPatterns(tableName);

    // Determine best partitioning strategy
    if (queryPatterns.timeBasedQueries > 0.7) {
      // Range partitioning by date
      return {
        tableName,
        partitionType: 'range',
        partitionColumn: queryPatterns.mostCommonDateColumn || 'created_at',
        partitionRanges: this.generateDateRanges(queryPatterns.dateRange),
        estimatedBenefit: '60-80% improvement for time-based queries',
      };
    } else if (queryPatterns.categoryBasedQueries > 0.7) {
      // List partitioning by category
      return {
        tableName,
        partitionType: 'list',
        partitionColumn: queryPatterns.mostCommonCategoryColumn || 'status',
        estimatedBenefit: '40-60% improvement for category-based queries',
      };
    } else if (tableStats[0].row_count > 10000000) {
      // Hash partitioning for very large tables
      return {
        tableName,
        partitionType: 'hash',
        partitionColumn: 'id',
        partitionCount: Math.ceil(tableStats[0].row_count / 5000000),
        estimatedBenefit: '30-50% improvement for large table scans',
      };
    }

    return null;
  }

  /**
   * Optimize database statistics
   */
  async optimizeStatistics(): Promise<void> {
    // Update statistics for all tables
    const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;

    for (const { tablename } of tables) {
      await this.prisma.$executeRawUnsafe(`ANALYZE ${tablename}`);
    }

    // Set custom statistics for commonly joined columns
    await this.setCustomStatistics();

    // Update default_statistics_target for important columns
    await this.updateStatisticsTargets();
  }

  /**
   * Implement query result caching at database level
   */
  async setupQueryCaching(): Promise<void> {
    // Create query result cache table
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS query_cache (
        query_hash VARCHAR(64) PRIMARY KEY,
        query_text TEXT NOT NULL,
        result_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL,
        hit_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create indexes for cache management
    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_query_cache_expires 
      ON query_cache (expires_at) 
      WHERE expires_at > NOW()
    `;

    // Create cache cleanup function
    await this.prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION cleanup_query_cache()
      RETURNS void AS $$
      BEGIN
        DELETE FROM query_cache WHERE expires_at < NOW();
      END;
      $$ LANGUAGE plpgsql
    `;
  }

  // Helper methods

  private hasSequentialScan(plan: any): boolean {
    if (plan?.['Node Type'] === 'Seq Scan') return true;
    if (plan?.Plans) {
      return plan.Plans.some((subPlan: any) => this.hasSequentialScan(subPlan));
    }
    return false;
  }

  private hasMissingJoinIndex(plan: any): boolean {
    if (plan?.['Node Type']?.includes('Join') && !plan?.['Index Name']) {
      return true;
    }
    if (plan?.Plans) {
      return plan.Plans.some((subPlan: any) => this.hasMissingJoinIndex(subPlan));
    }
    return false;
  }

  private hasSuboptimalAggregation(plan: any): boolean {
    // Check for multiple aggregation nodes that could be combined
    let aggCount = 0;
    const countAggregations = (p: any) => {
      if (p?.['Node Type']?.includes('Aggregate')) aggCount++;
      if (p?.Plans) p.Plans.forEach(countAggregations);
    };
    countAggregations(plan);
    return aggCount > 1;
  }

  private async wouldBenefitFromPartitioning(query: string, plan: any): Promise<boolean> {
    // Check if query filters on date/time columns
    const hasDateFilter = /WHERE.*(?:created_at|updated_at|start_time|end_time)/i.test(query);
    const tableSizeThreshold = 1000; // MB
    
    if (hasDateFilter && plan?.['Relation Name']) {
      const size = await this.getTableSize(plan['Relation Name']);
      return size > tableSizeThreshold;
    }
    
    return false;
  }

  private hasStaleStatistics(plan: any): boolean {
    // Check if actual rows significantly differ from estimated
    const checkEstimates = (p: any): boolean => {
      if (p?.['Actual Rows'] && p?.['Plan Rows']) {
        const ratio = p['Actual Rows'] / p['Plan Rows'];
        if (ratio < 0.1 || ratio > 10) return true;
      }
      if (p?.Plans) {
        return p.Plans.some(checkEstimates);
      }
      return false;
    };
    return checkEstimates(plan);
  }

  private extractTablesFromQuery(query: string): string[] {
    const tableRegex = /(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const matches = query.matchAll(tableRegex);
    return [...new Set([...matches].map(m => m[1]))];
  }

  private extractFilterColumns(query: string, table: string): string[][] {
    const whereRegex = new RegExp(`WHERE.*?${table}\\.(\\w+)`, 'gi');
    const columns = [...query.matchAll(whereRegex)].map(m => m[1]);
    
    // Return combinations for composite indexes
    const combinations: string[][] = [];
    for (let i = 0; i < columns.length; i++) {
      combinations.push([columns[i]]);
      if (i < columns.length - 1) {
        combinations.push([columns[i], columns[i + 1]]);
      }
    }
    
    return combinations;
  }

  private async getExistingIndexes(table: string): Promise<string[][]> {
    const indexes = await this.prisma.$queryRaw<Array<{ columns: string[] }>>`
      SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum)) as columns
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE c.relname = ${table}
      GROUP BY i.indexrelid
    `;
    
    return indexes.map(idx => idx.columns);
  }

  private findMissingIndexes(needed: string[][], existing: string[][]): string[][] {
    return needed.filter(need => 
      !existing.some(exist => 
        JSON.stringify(exist) === JSON.stringify(need)
      )
    );
  }

  private async estimateIndexSize(table: string, columns: string[]): Promise<number> {
    // Rough estimation based on column types and row count
    const stats = await this.prisma.$queryRaw<Array<{ 
      row_count: number;
      avg_width: number;
    }>>`
      SELECT 
        reltuples::bigint as row_count,
        AVG(avg_width) as avg_width
      FROM pg_class c
      JOIN pg_stats s ON s.tablename = c.relname
      WHERE c.relname = ${table}
        AND s.attname = ANY(${columns})
      GROUP BY c.reltuples
    `;
    
    if (stats[0]) {
      // B-tree overhead is roughly 40%
      return Math.round((stats[0].row_count * stats[0].avg_width * 1.4) / 1024);
    }
    
    return 0;
  }

  private async findPartialIndexCandidates(
    query: string, 
    table: string
  ): Promise<IndexRecommendation[]> {
    const suggestions: IndexRecommendation[] = [];
    
    // Look for common conditions
    const conditions = [
      { pattern: /WHERE\s+\w+\s*=\s*false/i, condition: 'is_private = false' },
      { pattern: /WHERE\s+\w+\s+IS\s+NULL/i, condition: 'deleted_at IS NULL' },
      { pattern: /WHERE\s+\w+\s*>\s*NOW\(\)/i, condition: 'expires_at > NOW()' },
    ];
    
    for (const { pattern, condition } of conditions) {
      if (pattern.test(query)) {
        suggestions.push({
          tableName: table,
          columns: this.extractColumnsFromCondition(condition),
          indexType: 'partial',
          condition,
          estimatedSizeKB: 100, // Partial indexes are typically smaller
          estimatedImprovement: '70-90% faster for filtered queries',
        });
      }
    }
    
    return suggestions;
  }

  private async suggestCoveringIndexes(
    query: string, 
    table: string
  ): Promise<IndexRecommendation[]> {
    const suggestions: IndexRecommendation[] = [];
    
    // Extract SELECT columns
    const selectRegex = new RegExp(`SELECT\\s+([^FROM]+)\\s+FROM\\s+${table}`, 'i');
    const match = query.match(selectRegex);
    
    if (match) {
      const selectColumns = match[1]
        .split(',')
        .map(col => col.trim())
        .filter(col => !col.includes('*') && !col.includes('('));
      
      if (selectColumns.length > 0 && selectColumns.length <= 5) {
        const whereColumns = this.extractWhereColumns(query, table);
        
        suggestions.push({
          tableName: table,
          columns: whereColumns,
          indexType: 'covering',
          includes: selectColumns,
          estimatedSizeKB: await this.estimateIndexSize(table, [...whereColumns, ...selectColumns]),
          estimatedImprovement: '80-95% faster - index-only scan',
        });
      }
    }
    
    return suggestions;
  }

  private async suggestExpressionIndexes(
    query: string, 
    table: string
  ): Promise<IndexRecommendation[]> {
    const suggestions: IndexRecommendation[] = [];
    
    // Look for function calls in WHERE clause
    const functionPatterns = [
      { pattern: /LOWER\((\w+)\)/i, expression: 'LOWER($1)' },
      { pattern: /DATE_TRUNC\('(\w+)',\s*(\w+)\)/i, expression: "DATE_TRUNC('$1', $2)" },
      { pattern: /EXTRACT\((\w+)\s+FROM\s+(\w+)\)/i, expression: 'EXTRACT($1 FROM $2)' },
    ];
    
    for (const { pattern, expression } of functionPatterns) {
      const match = query.match(pattern);
      if (match) {
        suggestions.push({
          tableName: table,
          columns: [expression.replace(/\$\d/g, (m) => match[parseInt(m[1])])],
          indexType: 'expression',
          estimatedSizeKB: 200,
          estimatedImprovement: '60-80% faster for expression queries',
        });
      }
    }
    
    return suggestions;
  }

  // Query rewriting methods

  private convertCorrelatedSubqueries(query: string): string {
    // Convert EXISTS subqueries to JOINs where beneficial
    return query.replace(
      /WHERE\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)\s*\)/gi,
      'JOIN $1 ON $2.$3 = $4.$5'
    );
  }

  private optimizeInClauses(query: string): string {
    // Replace large IN clauses with EXISTS
    const inClauseRegex = /WHERE\s+(\w+)\s+IN\s*\(([^)]+)\)/gi;
    return query.replace(inClauseRegex, (match, column, values) => {
      const valueCount = values.split(',').length;
      if (valueCount > 10) {
        return `WHERE EXISTS (SELECT 1 FROM (VALUES ${values}) AS v(val) WHERE v.val = ${column})`;
      }
      return match;
    });
  }

  private introduceCTEs(query: string): string {
    // Identify repeated subqueries and convert to CTEs
    const subqueryRegex = /\(SELECT[^)]+\)/g;
    const subqueries = query.match(subqueryRegex) || [];
    const repeated = subqueries.filter((sq, idx) => 
      subqueries.indexOf(sq) !== idx
    );
    
    if (repeated.length > 0) {
      let cteQuery = 'WITH ';
      repeated.forEach((sq, idx) => {
        const cteName = `cte_${idx}`;
        cteQuery += `${cteName} AS ${sq}, `;
        query = query.replace(sq, cteName);
      });
      cteQuery = cteQuery.slice(0, -2) + ' ' + query;
      return cteQuery;
    }
    
    return query;
  }

  private optimizeAggregations(query: string): string {
    // Convert subquery aggregations to window functions
    return query.replace(
      /\(SELECT\s+(\w+)\((\w+)\)\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)\)/gi,
      '$1($2) OVER (PARTITION BY $6.$7)'
    );
  }

  private pushDownPredicates(query: string): string {
    // Push WHERE conditions into subqueries
    // This is a simplified implementation
    return query.replace(
      /FROM\s*\(SELECT\s+([^)]+)\)\s+AS\s+(\w+)\s+WHERE\s+(\w+\.\w+\s*=\s*[^AND]+)/gi,
      'FROM (SELECT $1 WHERE $3) AS $2'
    );
  }

  // Utility methods

  private async getTableSize(tableName: string): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ size_mb: number }>>`
      SELECT pg_total_relation_size(${tableName}) / 1024.0 / 1024.0 as size_mb
    `;
    return result[0]?.size_mb || 0;
  }

  private extractColumnsFromCondition(condition: string): string[] {
    const columnRegex = /(\w+)\s*[=<>]/g;
    const matches = condition.matchAll(columnRegex);
    return [...matches].map(m => m[1]);
  }

  private extractWhereColumns(query: string, table: string): string[] {
    const whereRegex = new RegExp(`WHERE.*?${table}\\.(\\w+)`, 'gi');
    const matches = query.matchAll(whereRegex);
    return [...new Set([...matches].map(m => m[1]))];
  }

  private async analyzeTableQueryPatterns(tableName: string): Promise<any> {
    // This would analyze historical query patterns
    // Simplified implementation
    return {
      timeBasedQueries: 0.8,
      categoryBasedQueries: 0.2,
      mostCommonDateColumn: 'created_at',
      mostCommonCategoryColumn: 'status',
      dateRange: { from: new Date('2024-01-01'), to: new Date() },
    };
  }

  private generateDateRanges(range: { from: Date; to: Date }): any[] {
    const ranges = [];
    const current = new Date(range.from);
    
    while (current < range.to) {
      const next = new Date(current);
      next.setMonth(next.getMonth() + 1);
      
      ranges.push({
        name: `p_${current.getFullYear()}_${String(current.getMonth() + 1).padStart(2, '0')}`,
        from: current.toISOString(),
        to: next.toISOString(),
      });
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return ranges;
  }

  private async setCustomStatistics(): Promise<void> {
    // Set higher statistics for frequently joined columns
    const joinColumns = [
      { table: 'activities', column: 'user_id' },
      { table: 'activities', column: 'team_id' },
      { table: 'team_members', column: 'user_id' },
      { table: 'team_members', column: 'team_id' },
    ];
    
    for (const { table, column } of joinColumns) {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE ${table} ALTER COLUMN ${column} SET STATISTICS 1000`
      );
    }
  }

  private async updateStatisticsTargets(): Promise<void> {
    // Update default_statistics_target for better planning
    await this.prisma.$executeRaw`
      ALTER SYSTEM SET default_statistics_target = 500
    `;
    
    // Reload configuration
    await this.prisma.$executeRaw`
      SELECT pg_reload_conf()
    `;
  }
}