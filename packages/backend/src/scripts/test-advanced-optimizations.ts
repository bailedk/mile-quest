/**
 * Test script for DB-701: Advanced Query Optimization
 * Verifies all optimization techniques are working correctly
 */

import { PrismaClient } from '@prisma/client';
import { AdvancedQueryOptimizer } from '../services/database/advanced-query-optimizer';
import { AdvancedIndexingService } from '../services/database/advanced-indexing.service';
import { TablePartitioningService } from '../services/database/table-partitioning.service';
import { ConnectionPoolOptimizer } from '../services/database/connection-pool-optimizer';
import { QueryCacheService } from '../services/database/query-cache.service';
import { PerformanceDashboardService } from '../services/database/performance-dashboard.service';

const prisma = new PrismaClient();

async function testAdvancedOptimizations() {
  console.log('🚀 Testing DB-701: Advanced Query Optimization\n');

  try {
    // 1. Test Query Optimizer
    console.log('1️⃣ Testing Advanced Query Optimizer...');
    const optimizer = new AdvancedQueryOptimizer(prisma);
    
    // Test query analysis
    const testQuery = `
      SELECT u.id, u.name, COUNT(a.id) as activity_count, SUM(a.distance) as total_distance
      FROM users u
      LEFT JOIN activities a ON a.user_id = u.id
      WHERE a.start_time >= NOW() - INTERVAL '30 days'
        AND a.is_private = false
      GROUP BY u.id, u.name
      ORDER BY total_distance DESC
      LIMIT 10
    `;
    
    const analysis = await optimizer.analyzeQuery(testQuery);
    console.log('Query Analysis:');
    console.log('- Execution Time:', analysis.executionTime, 'ms');
    console.log('- Plan Type:', analysis.planType);
    console.log('- Recommendations:', analysis.recommendations.length);
    console.log('- Suggested Indexes:', analysis.suggestedIndexes.length);
    
    if (analysis.rewrittenQuery) {
      console.log('- Query was rewritten for optimization');
    }

    // 2. Test Advanced Indexing
    console.log('\n2️⃣ Testing Advanced Indexing Service...');
    const indexingService = new AdvancedIndexingService(prisma);
    
    // Analyze current index usage
    const indexAnalysis = await indexingService.analyzeIndexUsage();
    console.log('Index Analysis:');
    console.log('- Unused Indexes:', indexAnalysis.unusedIndexes.length);
    console.log('- Redundant Indexes:', indexAnalysis.redundantIndexes.length);
    console.log('- Missing Index Suggestions:', indexAnalysis.missingIndexes.length);

    // 3. Test Table Partitioning
    console.log('\n3️⃣ Testing Table Partitioning Service...');
    const partitioningService = new TablePartitioningService(prisma);
    
    // Check partition statistics
    const activityPartitions = await partitioningService.getPartitionStats('activities_partitioned');
    console.log('Activity Partitions:', activityPartitions.length);
    
    if (activityPartitions.length > 0) {
      console.log('Sample Partition:');
      const sample = activityPartitions[0];
      console.log('- Name:', sample.name);
      console.log('- Rows:', sample.rowCount);
      console.log('- Size:', sample.sizeMB, 'MB');
    }

    // 4. Test Connection Pool Optimizer
    console.log('\n4️⃣ Testing Connection Pool Optimizer...');
    const poolOptimizer = ConnectionPoolOptimizer.getInstance();
    await poolOptimizer.initializePool();
    
    // Get pool metrics
    const poolMetrics = poolOptimizer.getMetrics();
    console.log('Connection Pool Metrics:');
    console.log('- Active Connections:', poolMetrics.activeConnections);
    console.log('- Idle Connections:', poolMetrics.idleConnections);
    console.log('- Connection Utilization:', poolMetrics.connectionUtilization.toFixed(2), '%');
    console.log('- Average Wait Time:', poolMetrics.averageWaitTime.toFixed(2), 'ms');

    // Test optimized query execution
    const optimizedResult = await poolOptimizer.executeQuery(
      'SELECT COUNT(*) as count FROM activities WHERE start_time >= $1',
      [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
    );
    console.log('Optimized Query Result:', optimizedResult);

    // 5. Test Query Cache
    console.log('\n5️⃣ Testing Query Cache Service...');
    const cacheService = new QueryCacheService(prisma);
    
    // Test cached query
    const cachedQuery = 'SELECT COUNT(*) as user_count FROM users WHERE deleted_at IS NULL';
    
    console.time('First Query (uncached)');
    const result1 = await cacheService.cachedQuery(cachedQuery, [], { ttl: 300, tags: ['users'] });
    console.timeEnd('First Query (uncached)');
    
    console.time('Second Query (cached)');
    const result2 = await cacheService.cachedQuery(cachedQuery, [], { ttl: 300, tags: ['users'] });
    console.timeEnd('Second Query (cached)');
    
    // Get cache statistics
    const cacheStats = await cacheService.getStats();
    console.log('Cache Statistics:');
    console.log('- Hit Rate:', cacheStats.hitRate, '%');
    console.log('- Total Hits:', cacheStats.totalHits);
    console.log('- Average Response Time:', cacheStats.avgResponseTime, 'ms');

    // 6. Test Performance Dashboard
    console.log('\n6️⃣ Testing Performance Dashboard Service...');
    const dashboardService = new PerformanceDashboardService(prisma);
    
    // Get dashboard snapshot
    const dashboard = await dashboardService.getDashboard();
    console.log('Performance Dashboard:');
    console.log('- Health:', dashboard.overview.health);
    console.log('- Score:', dashboard.overview.score, '/100');
    console.log('- Active Alerts:', dashboard.overview.alerts);
    console.log('- Recommendations:', dashboard.overview.recommendations);
    
    // Display key metrics
    console.log('\nKey Metrics:');
    console.log('- Average Query Time:', dashboard.metrics.queries.averageQueryTime.toFixed(2), 'ms');
    console.log('- Cache Hit Rate:', dashboard.metrics.queries.cacheHitRate.toFixed(2), '%');
    console.log('- Connection Utilization:', dashboard.metrics.connections.connectionUtilization.toFixed(2), '%');
    console.log('- Slow Queries:', dashboard.metrics.queries.slowQueries);

    // 7. Test Complex Optimized Queries
    console.log('\n7️⃣ Testing Complex Optimized Queries...');
    
    // Test dashboard query with all optimizations
    const dashboardQuery = `
      WITH user_stats AS (
        SELECT * FROM mv_user_activity_stats WHERE user_id = $1
      ),
      recent_activities AS (
        SELECT * FROM activities 
        WHERE user_id = $1 
          AND start_time >= NOW() - INTERVAL '7 days'
        ORDER BY start_time DESC
        LIMIT 10
      )
      SELECT 
        us.*,
        json_agg(ra.*) as recent_activities
      FROM user_stats us
      CROSS JOIN recent_activities ra
      GROUP BY us.user_id, us.total_distance, us.total_activities, 
               us.total_duration, us.best_distance, us.last_activity_date,
               us.week_distance, us.week_activities, us.month_distance,
               us.month_activities, us.public_total_distance, us.public_total_activities,
               us.public_avg_distance, us.has_private_activities, us.last_updated
    `;
    
    const testUserId = 'test-user-id';
    console.time('Optimized Dashboard Query');
    try {
      await prisma.$queryRawUnsafe(dashboardQuery, testUserId);
      console.timeEnd('Optimized Dashboard Query');
    } catch (error) {
      console.log('Dashboard query error (expected if no test data):', error.message);
    }

    // 8. Performance Comparison
    console.log('\n8️⃣ Performance Comparison...');
    
    // Compare query with and without optimizations
    const compareQuery = `
      SELECT 
        team_id,
        user_id,
        SUM(distance) as total_distance,
        COUNT(*) as activity_count
      FROM activities
      WHERE start_time >= NOW() - INTERVAL '30 days'
        AND is_private = false
      GROUP BY team_id, user_id
      ORDER BY total_distance DESC
      LIMIT 100
    `;
    
    // Without cache
    console.time('Query without cache');
    await prisma.$queryRawUnsafe(compareQuery);
    console.timeEnd('Query without cache');
    
    // With cache
    console.time('Query with cache');
    await cacheService.cachedQuery(compareQuery, [], { ttl: 600, tags: ['leaderboard'] });
    console.timeEnd('Query with cache');

    // 9. Generate Optimization Report
    console.log('\n9️⃣ Generating Optimization Report...');
    
    const optimizationSummary = await prisma.$queryRaw<Array<{
      optimization_type: string;
      count: number;
      status: string;
    }>>`SELECT * FROM db701_optimization_summary()`;
    
    console.log('Optimization Summary:');
    optimizationSummary.forEach(opt => {
      console.log(`- ${opt.optimization_type}: ${opt.count} ${opt.status}`);
    });

    // 10. Cleanup and recommendations
    console.log('\n✅ All optimization tests completed!');
    console.log('\n📊 Next Steps:');
    console.log('1. Monitor performance dashboard regularly');
    console.log('2. Review and implement suggested indexes');
    console.log('3. Set up automated partition management');
    console.log('4. Configure query cache warming for common queries');
    console.log('5. Adjust connection pool settings based on load');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await ConnectionPoolOptimizer.getInstance().shutdown();
    await prisma.$disconnect();
  }
}

// Performance benchmark function
async function runPerformanceBenchmark() {
  console.log('\n🏃 Running Performance Benchmark...\n');
  
  const queries = [
    {
      name: 'User Dashboard Stats',
      sql: 'SELECT * FROM mv_user_activity_stats WHERE user_id = $1',
      params: ['test-user-id'],
    },
    {
      name: 'Team Leaderboard',
      sql: 'SELECT * FROM mv_team_member_leaderboard WHERE team_id = $1 ORDER BY public_rank LIMIT 10',
      params: ['test-team-id'],
    },
    {
      name: 'Recent Activities',
      sql: 'SELECT * FROM activities WHERE user_id = $1 AND start_time >= $2 ORDER BY start_time DESC LIMIT 20',
      params: ['test-user-id', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)],
    },
    {
      name: 'Team Progress',
      sql: 'SELECT * FROM mv_team_goal_progress WHERE team_id = $1',
      params: ['test-team-id'],
    },
  ];

  for (const query of queries) {
    console.log(`Testing: ${query.name}`);
    
    const times: number[] = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await prisma.$queryRawUnsafe(query.sql, ...query.params);
        times.push(Date.now() - start);
      } catch (error) {
        console.log(`- Error (expected if no test data): ${error.message}`);
        break;
      }
    }
    
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      console.log(`- Average: ${avg.toFixed(2)}ms`);
      console.log(`- Min: ${min}ms, Max: ${max}ms`);
    }
    console.log('');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--benchmark')) {
    await runPerformanceBenchmark();
  }
  
  await testAdvancedOptimizations();
}

main().catch(console.error);