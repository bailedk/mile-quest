/**
 * Enhanced Jest setup for comprehensive backend testing
 * Configures mocks, test utilities, and global setup for all backend tests
 */
import { jest } from '@jest/globals';
import { mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Extend Jest expect with custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidISODate(): R;
      toBeWithinRange(min: number, max: number): R;
      toHaveBeenCalledWithValidToken(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass,
    };
  },

  toBeValidISODate(received: string) {
    const pass = typeof received === 'string' && !isNaN(Date.parse(received));
    
    return {
      message: () => `expected ${received} to be a valid ISO date string`,
      pass,
    };
  },

  toBeWithinRange(received: number, min: number, max: number) {
    const pass = typeof received === 'number' && received >= min && received <= max;
    
    return {
      message: () => `expected ${received} to be within range [${min}, ${max}]`,
      pass,
    };
  },

  toHaveBeenCalledWithValidToken(received: jest.MockedFunction<any>) {
    const calls = received.mock.calls;
    const pass = calls.some(call => {
      const token = call[0];
      // Basic JWT structure check
      return typeof token === 'string' && token.split('.').length === 3;
    });

    return {
      message: () => `expected function to have been called with a valid JWT token`,
      pass,
    };
  },
});

// Global test configuration
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
  
  // Mock external service configurations
  process.env.COGNITO_USER_POOL_ID = 'test-user-pool';
  process.env.COGNITO_CLIENT_ID = 'test-client-id';
  process.env.PUSHER_APP_ID = 'test-pusher-app';
  process.env.PUSHER_KEY = 'test-pusher-key';
  process.env.PUSHER_SECRET = 'test-pusher-secret';
  process.env.PUSHER_CLUSTER = 'test-cluster';
  process.env.MAPBOX_ACCESS_TOKEN = 'test-mapbox-token';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
  
  // Mock database URL
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/mile_quest_test';
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset timers
  jest.clearAllTimers();
  
  // Reset console spies if any
  if (jest.isMockFunction(console.log)) {
    console.log.mockClear();
  }
  if (jest.isMockFunction(console.error)) {
    console.error.mockClear();
  }
  if (jest.isMockFunction(console.warn)) {
    console.warn.mockClear();
  }
});

afterEach(() => {
  // Restore all mocks after each test
  jest.restoreAllMocks();
});

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

// Mock global fetch for tests that need it
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  } as Response)
);

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({
    send: jest.fn(),
  })),
  AdminGetUserCommand: jest.fn(),
  AdminCreateUserCommand: jest.fn(),
  AdminSetUserPasswordCommand: jest.fn(),
  AdminDeleteUserCommand: jest.fn(),
  AdminInitiateAuthCommand: jest.fn(),
  AdminConfirmSignUpCommand: jest.fn(),
}));

// Mock Pusher
jest.mock('pusher', () => {
  return jest.fn().mockImplementation(() => ({
    trigger: jest.fn().mockResolvedValue({}),
    triggerBatch: jest.fn().mockResolvedValue({}),
    authenticate: jest.fn().mockReturnValue({ auth: 'test-auth' }),
    authorizeChannel: jest.fn().mockReturnValue({ auth: 'test-auth' }),
  }));
});

// Mock Mapbox SDK
jest.mock('@mapbox/mapbox-sdk', () => {
  return jest.fn(() => ({
    geocoding: {
      forwardGeocode: jest.fn().mockResolvedValue({
        body: {
          features: [{
            center: [-74.0060, 40.7128],
            place_name: 'New York, NY, USA',
          }],
        },
      }),
      reverseGeocode: jest.fn().mockResolvedValue({
        body: {
          features: [{
            place_name: 'New York, NY, USA',
          }],
        },
      }),
    },
    directions: {
      getDirections: jest.fn().mockResolvedValue({
        body: {
          routes: [{
            distance: 10000,
            duration: 3600,
            geometry: 'encoded-polyline-string',
          }],
        },
      }),
    },
  }));
});

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn((payload, secret, options) => 'mock.jwt.token'),
  verify: jest.fn((token, secret) => ({
    sub: 'test-user-id',
    email: 'test@example.com',
    'cognito:username': 'test-user-id',
  })),
  decode: jest.fn((token) => ({
    sub: 'test-user-id',
    email: 'test@example.com',
    'cognito:username': 'test-user-id',
  })),
}));

// Mock AWS Lambda Powertools
jest.mock('@aws-lambda-powertools/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    addContext: jest.fn(),
    removeKeys: jest.fn(),
  })),
}));

jest.mock('@aws-lambda-powertools/metrics', () => ({
  Metrics: jest.fn().mockImplementation(() => ({
    addMetric: jest.fn(),
    publishStoredMetrics: jest.fn(),
    setDefaultDimensions: jest.fn(),
  })),
  MetricUnits: {
    Count: 'Count',
    Milliseconds: 'Milliseconds',
    Bytes: 'Bytes',
  },
}));

jest.mock('@aws-lambda-powertools/tracer', () => ({
  Tracer: jest.fn().mockImplementation(() => ({
    captureAWS: jest.fn((service) => service),
    captureHTTPS: jest.fn((https) => https),
    captureAsyncFunc: jest.fn((name, fn) => fn()),
    annotateColdStart: jest.fn(),
    addServiceNameAnnotation: jest.fn(),
  })),
}));

// Test utilities
export const createMockLambdaEvent = (overrides: any = {}) => ({
  resource: '/test',
  path: '/test',
  httpMethod: 'GET',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer mock.jwt.token',
  },
  multiValueHeaders: {},
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api-id',
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    path: '/test',
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '01/Jan/2025:00:00:00 +0000',
    requestTimeEpoch: 1704067200000,
    resourceId: 'test-resource-id',
    resourcePath: '/test',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-user-agent',
      userArn: null,
    },
    authorizer: null,
  },
  body: null,
  isBase64Encoded: false,
  ...overrides,
});

export const createMockLambdaContext = () => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2025/01/19/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
});

// Database test utilities
export const createMockPrismaClient = () => {
  return mockDeep<PrismaClient>();
};

// Async test helpers
export const waitForAsync = () => new Promise(resolve => setImmediate(resolve));

export const expectAsyncThrow = async (fn: () => Promise<any>, errorMessage?: string) => {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error: any) {
    if (errorMessage) {
      expect(error.message).toContain(errorMessage);
    }
    return error;
  }
};

// Mock data generators
export const generateMockActivity = (overrides: any = {}) => ({
  id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  userId: 'test-user-id',
  activityType: 'WALK',
  distance: 5000,
  duration: 3600,
  pace: 12.0,
  startTime: new Date(),
  activityDate: new Date(),
  notes: 'Test activity',
  isPrivate: false,
  source: 'MANUAL',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateMockTeam = (overrides: any = {}) => ({
  id: `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Team',
  createdBy: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const generateMockUser = (overrides: any = {}) => ({
  id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  email: `test-${Date.now()}@example.com`,
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Performance testing utilities
export const measureExecutionTime = async (fn: () => Promise<any>) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const executionTime = Number(end - start) / 1_000_000; // Convert to milliseconds
  
  return { result, executionTime };
};

export const expectPerformanceWithin = async (
  fn: () => Promise<any>, 
  maxExecutionTime: number
) => {
  const { result, executionTime } = await measureExecutionTime(fn);
  expect(executionTime).toBeLessThan(maxExecutionTime);
  return result;
};

// Console monitoring for tests
export const captureConsoleOutput = () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const logs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log = jest.fn((...args) => {
    logs.push(args.join(' '));
  });
  
  console.error = jest.fn((...args) => {
    errors.push(args.join(' '));
  });
  
  console.warn = jest.fn((...args) => {
    warnings.push(args.join(' '));
  });
  
  return {
    logs,
    errors,
    warnings,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
};

console.log('✅ Backend test environment configured successfully');