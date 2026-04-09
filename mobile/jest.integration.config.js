const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/tests/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['./tests/setup.integration.ts'],
  // Remove expo-sqlite and drizzle-orm/expo-sqlite from transformIgnorePatterns
  // to allow real better-sqlite3 usage without native module mocking
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|drizzle-orm)',
  ],
};
