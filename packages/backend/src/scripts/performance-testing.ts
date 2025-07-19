/**
 * Performance Testing Utilities - BE-701
 * Load testing and performance benchmarking tools for the API
 */

import axios, { AxiosResponse } from 'axios';
import { performance } from 'perf_hooks';

interface LoadTestConfig {
  baseUrl: string;
  endpoints: Array<{
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    weight?: number; // Relative frequency (default: 1)
  }>;
  duration: number; // Test duration in seconds
  concurrency: number; // Number of concurrent requests
  rampUp?: number; // Ramp up time in seconds
  authToken?: string;
}

interface TestResult {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  success: boolean;
  timestamp: number;
  error?: string;
}

interface LoadTestReport {
  config: LoadTestConfig;
  results: TestResult[];
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    requestsPerSecond: number;
    successRate: number;
    errorRate: number;
    testDuration: number;
  };
  errorSummary: Record<string, number>;
  endpointSummary: Array<{
    endpoint: string;
    method: string;
    requestCount: number;
    averageResponseTime: number;
    successRate: number;
    errorCount: number;
  }>;
}

export class PerformanceTester {
  private results: TestResult[] = [];
  private testStartTime = 0;
  private activeRequests = 0;

  /**
   * Run load test with specified configuration
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestReport> {
    console.log(`🚀 Starting load test with ${config.concurrency} concurrent users for ${config.duration}s`);
    console.log(`📍 Target: ${config.baseUrl}`);
    console.log(`🎯 Endpoints: ${config.endpoints.length}`);

    this.results = [];
    this.testStartTime = performance.now();
    this.activeRequests = 0;

    // Calculate endpoint weights
    const totalWeight = config.endpoints.reduce((sum, ep) => sum + (ep.weight || 1), 0);
    const endpointProbabilities = config.endpoints.map(ep => ({
      ...ep,
      probability: (ep.weight || 1) / totalWeight,
    }));

    // Create promise array for concurrent execution
    const testPromises: Promise<void>[] = [];

    // Ramp up users gradually if specified
    const rampUpDelay = config.rampUp ? (config.rampUp * 1000) / config.concurrency : 0;

    for (let i = 0; i < config.concurrency; i++) {
      const startDelay = rampUpDelay * i;
      
      testPromises.push(
        this.runUserSession(config, endpointProbabilities, startDelay)
      );
    }

    // Wait for all sessions to complete
    await Promise.all(testPromises);

    // Generate and return report
    return this.generateReport(config);
  }

  /**
   * Run a single user session
   */
  private async runUserSession(
    config: LoadTestConfig,
    endpoints: Array<LoadTestConfig['endpoints'][0] & { probability: number }>,
    startDelay: number
  ): Promise<void> {
    // Wait for ramp-up delay
    if (startDelay > 0) {
      await this.sleep(startDelay);
    }

    const sessionStart = performance.now();
    const sessionDuration = config.duration * 1000;

    while ((performance.now() - sessionStart) < sessionDuration) {
      try {
        // Select random endpoint based on weights
        const endpoint = this.selectRandomEndpoint(endpoints);
        
        this.activeRequests++;
        await this.makeRequest(config.baseUrl, endpoint, config.authToken);
        this.activeRequests--;

        // Small delay between requests to simulate real user behavior
        await this.sleep(Math.random() * 100 + 50); // 50-150ms
      } catch (error) {
        this.activeRequests--;
        console.error('Session error:', error);
      }
    }
  }

  /**
   * Make a single HTTP request and record results
   */
  private async makeRequest(
    baseUrl: string,
    endpoint: LoadTestConfig['endpoints'][0],
    authToken?: string
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...endpoint.headers,
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response: AxiosResponse = await axios({
        method: endpoint.method,
        url: `${baseUrl}${endpoint.path}`,
        headers,
        data: endpoint.body,
        timeout: 30000, // 30 second timeout
        validateStatus: () => true, // Don't throw on non-2xx status codes
      });

      const responseTime = performance.now() - startTime;

      this.results.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        responseTime,
        statusCode: response.status,
        success: response.status >= 200 && response.status < 400,
        timestamp: Date.now(),
      });
    } catch (error) {
      const responseTime = performance.now() - startTime;

      this.results.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        responseTime,
        statusCode: 0,
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Select random endpoint based on probability weights
   */
  private selectRandomEndpoint(
    endpoints: Array<LoadTestConfig['endpoints'][0] & { probability: number }>
  ): LoadTestConfig['endpoints'][0] {
    const random = Math.random();
    let cumulativeProbability = 0;

    for (const endpoint of endpoints) {
      cumulativeProbability += endpoint.probability;
      if (random <= cumulativeProbability) {
        return endpoint;
      }
    }

    // Fallback to first endpoint
    return endpoints[0];
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(config: LoadTestConfig): LoadTestReport {
    const testDuration = (performance.now() - this.testStartTime) / 1000;
    const totalRequests = this.results.length;
    const successfulRequests = this.results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    // Calculate response time statistics
    const responseTimes = this.results.map(r => r.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalRequests;
    const p50ResponseTime = this.percentile(responseTimes, 50);
    const p95ResponseTime = this.percentile(responseTimes, 95);
    const p99ResponseTime = this.percentile(responseTimes, 99);
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);

    // Calculate rates
    const requestsPerSecond = totalRequests / testDuration;
    const successRate = (successfulRequests / totalRequests) * 100;
    const errorRate = (failedRequests / totalRequests) * 100;

    // Error summary
    const errorSummary: Record<string, number> = {};
    this.results.filter(r => !r.success).forEach(r => {
      const key = r.error || `HTTP ${r.statusCode}`;
      errorSummary[key] = (errorSummary[key] || 0) + 1;
    });

    // Endpoint summary
    const endpointMap = new Map<string, TestResult[]>();
    this.results.forEach(result => {
      const key = `${result.method} ${result.endpoint}`;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, []);
      }
      endpointMap.get(key)!.push(result);
    });

    const endpointSummary = Array.from(endpointMap.entries()).map(([key, results]) => {
      const [method, endpoint] = key.split(' ', 2);
      const successfulResults = results.filter(r => r.success);
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const successRate = (successfulResults.length / results.length) * 100;
      const errorCount = results.length - successfulResults.length;

      return {
        endpoint,
        method,
        requestCount: results.length,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        errorCount,
      };
    });

    return {
      config,
      results: this.results,
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        p50ResponseTime: Math.round(p50ResponseTime * 100) / 100,
        p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
        p99ResponseTime: Math.round(p99ResponseTime * 100) / 100,
        minResponseTime: Math.round(minResponseTime * 100) / 100,
        maxResponseTime: Math.round(maxResponseTime * 100) / 100,
        requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        testDuration: Math.round(testDuration * 100) / 100,
      },
      errorSummary,
      endpointSummary,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print report to console
   */
  printReport(report: LoadTestReport): void {
    console.log('\n📊 Load Test Report');
    console.log('='.repeat(50));
    
    // Test configuration
    console.log('\n🔧 Test Configuration:');
    console.log(`  Duration: ${report.config.duration}s`);
    console.log(`  Concurrency: ${report.config.concurrency} users`);
    console.log(`  Endpoints: ${report.config.endpoints.length}`);
    
    // Summary statistics
    console.log('\n📈 Summary Statistics:');
    console.log(`  Total Requests: ${report.summary.totalRequests}`);
    console.log(`  Successful: ${report.summary.successfulRequests} (${report.summary.successRate}%)`);
    console.log(`  Failed: ${report.summary.failedRequests} (${report.summary.errorRate}%)`);
    console.log(`  Requests/sec: ${report.summary.requestsPerSecond}`);
    
    // Response time statistics
    console.log('\n⏱️  Response Times:');
    console.log(`  Average: ${report.summary.averageResponseTime}ms`);
    console.log(`  50th percentile: ${report.summary.p50ResponseTime}ms`);
    console.log(`  95th percentile: ${report.summary.p95ResponseTime}ms`);
    console.log(`  99th percentile: ${report.summary.p99ResponseTime}ms`);
    console.log(`  Min: ${report.summary.minResponseTime}ms`);
    console.log(`  Max: ${report.summary.maxResponseTime}ms`);
    
    // Endpoint breakdown
    console.log('\n🎯 Endpoint Performance:');
    report.endpointSummary
      .sort((a, b) => b.requestCount - a.requestCount)
      .forEach(ep => {
        console.log(`  ${ep.method} ${ep.endpoint}:`);
        console.log(`    Requests: ${ep.requestCount}`);
        console.log(`    Avg Response: ${ep.averageResponseTime}ms`);
        console.log(`    Success Rate: ${ep.successRate}%`);
        if (ep.errorCount > 0) {
          console.log(`    Errors: ${ep.errorCount}`);
        }
      });
    
    // Error breakdown
    if (Object.keys(report.errorSummary).length > 0) {
      console.log('\n❌ Error Summary:');
      Object.entries(report.errorSummary)
        .sort(([,a], [,b]) => b - a)
        .forEach(([error, count]) => {
          console.log(`  ${error}: ${count} occurrences`);
        });
    }
    
    console.log('\n' + '='.repeat(50));
  }

  /**
   * Save report to JSON file
   */
  async saveReport(report: LoadTestReport, filename: string): Promise<void> {
    const fs = await import('fs/promises');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = filename.replace('.json', `-${timestamp}.json`);
    
    await fs.writeFile(finalFilename, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${finalFilename}`);
  }
}

/**
 * Predefined test configurations
 */
export const testConfigs = {
  /**
   * Quick smoke test
   */
  smokeTest: {
    baseUrl: 'http://localhost:3001',
    duration: 30,
    concurrency: 2,
    endpoints: [
      { path: '/health', method: 'GET' as const, weight: 1 },
      { path: '/dashboard', method: 'GET' as const, weight: 1 },
    ],
  },

  /**
   * API health check test
   */
  healthCheck: {
    baseUrl: 'http://localhost:3001',
    duration: 60,
    concurrency: 5,
    endpoints: [
      { path: '/health', method: 'GET' as const },
    ],
  },

  /**
   * Realistic user behavior simulation
   */
  realisticLoad: {
    baseUrl: 'http://localhost:3001',
    duration: 300, // 5 minutes
    concurrency: 10,
    rampUp: 60, // 1 minute ramp up
    endpoints: [
      { path: '/dashboard', method: 'GET' as const, weight: 5 },
      { path: '/teams/{teamId}/progress', method: 'GET' as const, weight: 3 },
      { path: '/activities', method: 'GET' as const, weight: 3 },
      { path: '/leaderboards/global', method: 'GET' as const, weight: 2 },
      { path: '/activities', method: 'POST' as const, weight: 1, body: {
        type: 'walk',
        distance: 1000,
        duration: 600,
        timestamp: new Date().toISOString(),
      }},
    ],
  },

  /**
   * Stress test to find breaking point
   */
  stressTest: {
    baseUrl: 'http://localhost:3001',
    duration: 600, // 10 minutes
    concurrency: 50,
    rampUp: 120, // 2 minute ramp up
    endpoints: [
      { path: '/dashboard', method: 'GET' as const, weight: 4 },
      { path: '/activities', method: 'GET' as const, weight: 3 },
      { path: '/leaderboards/global', method: 'GET' as const, weight: 2 },
      { path: '/teams/{teamId}/progress', method: 'GET' as const, weight: 2 },
      { path: '/activities', method: 'POST' as const, weight: 1, body: {
        type: 'walk',
        distance: 1000,
        duration: 600,
        timestamp: new Date().toISOString(),
      }},
    ],
  },
};

/**
 * CLI interface for running tests
 */
export async function runPerformanceTest(): Promise<void> {
  const testName = process.argv[2] || 'smokeTest';
  const config = testConfigs[testName as keyof typeof testConfigs];
  
  if (!config) {
    console.error(`❌ Unknown test configuration: ${testName}`);
    console.log('Available tests:', Object.keys(testConfigs).join(', '));
    process.exit(1);
  }

  const tester = new PerformanceTester();
  
  try {
    const report = await tester.runLoadTest(config);
    tester.printReport(report);
    
    // Save report if requested
    if (process.argv.includes('--save')) {
      await tester.saveReport(report, `performance-test-${testName}.json`);
    }
    
    // Exit with error code if test failed
    if (report.summary.errorRate > 10) {
      console.error(`❌ Test failed - error rate too high: ${report.summary.errorRate}%`);
      process.exit(1);
    }
    
    console.log('✅ Performance test completed successfully');
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  runPerformanceTest();
}