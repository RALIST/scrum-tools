// server/jest.config.js

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm', // Preset for ESM projects
  testEnvironment: 'node',
  testTimeout: 10000, // Increased timeout (original script had 1200ms)
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Handle potential issues with imports ending in .js within ESM
    // Adjust if you face import issues for .js files from .ts files
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    // Use ts-jest for .ts files, telling it to output ESM
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  // Include both .js and .ts test files during migration
  testMatch: [
    '**/__tests__/**/*.test.[jt]s', // Matches .test.js, .test.ts
    '**/?(*.)+(spec|test).[jt]s'
  ],
  // Optionally, clear mocks between tests
  clearMocks: true,
};