module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./tests/jestSetup.js'],
  setupFilesAfterEnv: ['./tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|drizzle-orm)',
  ],
  moduleNameMapper: {
    '\\.sql$': '<rootDir>/tests/__mocks__/fileMock.js',
  },
  testEnvironment: 'node',
};
