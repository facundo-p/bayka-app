// Zona de los usuarios, igual en CI (UTC) que en local: con UTC no se ve el corrimiento de
// día de toISOString. Se fija antes de que arranquen los workers, que heredan el env.
process.env.TZ = 'America/Argentina/Buenos_Aires';

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./tests/jestSetup.js'],
  setupFilesAfterEnv: ['./tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|drizzle-orm)',
  ],
  moduleNameMapper: {
    '\\.sql$': '<rootDir>/tests/__mocks__/fileMock.js',
  },
  testEnvironment: 'node',
};
