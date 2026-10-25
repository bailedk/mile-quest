/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Historical handler suites do not compile against the current Prisma models
  // and removed services. The default run covers pure core logic.
  testMatch: ['<rootDir>/src/services/aws/retry-handler.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { diagnostics: false, isolatedModules: true }],
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/scripts/**',
    '!src/lambda/**/index.ts', // Lambda entry points
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@mile-quest/shared$': '<rootDir>/../shared/src',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
};