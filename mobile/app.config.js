const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Variante TEST (#253): APP_VARIANT=test → app "Bayka TEST" con applicationId
// propio (convive con la de producción en el mismo device) apuntando a
// Supabase STAGING, con ícono/splash marcados con la franja roja "TEST"
// (assets *-test.png, generados por scripts/generate-test-assets.py). Sus env
// viven en mobile/.env.staging (gitignoreado) y PISAN las de .env.
// Uso: exportar APP_VARIANT=test en prebuild Y en gradlew — o directamente
// scripts/build-apk.sh test (ver skill build-apk-local).
const IS_TEST = process.env.APP_VARIANT === 'test';

// Commit del build (#321), solo para la variante TEST: identifica QUÉ se está
// probando, cosa que la versión no hace (la bumpea /deploy recién al pasar a
// main). En EAS viene por env; en builds locales y en `eas update` sale de git,
// con sufijo -dirty si había cambios sin commitear. Si git no está disponible
// queda vacío y el banner muestra solo la versión.
const { execFileSync } = require('child_process');
function gitSiEsPosible(...args) {
  try {
    // Sin cwd: expo y eas corren siempre desde mobile/, y git busca el repo hacia arriba.
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}
function commitDelBuild() {
  const sha = process.env.EAS_BUILD_GIT_COMMIT_HASH || gitSiEsPosible('rev-parse', 'HEAD');
  if (!sha) return '';
  const sucio = !process.env.EAS_BUILD_GIT_COMMIT_HASH && gitSiEsPosible('status', '--porcelain') !== '';
  return sha.slice(0, 7) + (sucio ? '-dirty' : '');
}
if (IS_TEST) {
  require('dotenv').config({ path: path.resolve(__dirname, '.env.staging'), override: true });
}

module.exports = ({ config }) => ({
  ...config,
  name: IS_TEST ? 'Bayka TEST' : config.name,
  icon: IS_TEST ? './assets/icon-bayka-test.png' : config.icon,
  splash: IS_TEST
    ? { ...config.splash, image: './assets/splash-bayka-test.png' }
    : config.splash,
  android: {
    ...config.android,
    package: IS_TEST ? `${config.android.package}.test` : config.android.package,
    adaptiveIcon: IS_TEST
      ? {
          ...config.android.adaptiveIcon,
          foregroundImage: './assets/android-foreground-bayka-test.png',
        }
      : config.android.adaptiveIcon,
  },
  ios: {
    ...config.ios,
    // No hay builds iOS todavía; queda definido con el mismo sufijo que Android.
    bundleIdentifier: IS_TEST ? `${config.android.package}.test` : config.android.package,
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
    // Variante de build (#287): src/config/entorno.ts la lee en runtime para
    // mostrar el banner "Entorno de pruebas" solo en la app TEST.
    appVariant: IS_TEST ? 'test' : 'prod',
    ...(IS_TEST ? { commit: commitDelBuild() } : {}),
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '',
    },
  },
});
