module.exports = {
    testEnvironment: 'node',
    verbose: true,
    testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.js'],
    setupFilesAfterEnv: ['./jest.setup.js'],
  };