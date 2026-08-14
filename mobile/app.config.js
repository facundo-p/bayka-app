const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Variante TEST (#253): APP_VARIANT=test → app "Bayka TEST" con applicationId
// propio (convive con la de producción en el mismo device) apuntando a
// Supabase STAGING. Sus env viven en mobile/.env.staging (gitignoreado) y
// PISAN las de .env. Uso: exportar APP_VARIANT=test en prebuild Y en gradlew.
const IS_TEST = process.env.APP_VARIANT === 'test';
if (IS_TEST) {
  require('dotenv').config({ path: path.resolve(__dirname, '.env.staging'), override: true });
}

module.exports = ({ config }) => ({
  ...config,
  name: IS_TEST ? 'Bayka TEST' : config.name,
  android: {
    ...config.android,
    package: IS_TEST ? `${config.android.package}.test` : config.android.package,
  },
  plugins: [
    ...(config.plugins || []),
    'expo-font',
  ],
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID || ''}`,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '',
    },
  },
});
