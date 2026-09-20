/**
 * El canal de EAS Update se graba en el build y no hay nada en runtime que
 * delate su ausencia: un APK sin `expo-channel-name` simplemente no recibe
 * ningún OTA, en silencio (#384). De ahí este test sobre `app.config.js`.
 *
 * `.env.staging` se simula con un spy: está gitignoreado, así que no existe en CI,
 * y escribir el archivo real pisaría las credenciales de quien corra los tests.
 */
import fs from 'fs';
import path from 'path';

type ConfigDeExpo = {
  updates: { url: string; requestHeaders?: Record<string, string> };
  extra: { appVariant: string };
};

type DefinirConfig = (arg: { config: unknown }) => ConfigDeExpo;

const CONFIG_BASE = {
  name: 'Bayka App',
  icon: './assets/icon.png',
  splash: { image: './assets/splash.png' },
  android: {
    package: 'com.bayka.app',
    adaptiveIcon: { foregroundImage: './assets/android-foreground.png' },
  },
  ios: {},
  plugins: [],
};

const CLAVES_DE_ENTORNO = ['APP_VARIANT', 'EAS_BUILD'] as const;

const RUTA_ENV_STAGING = path.resolve(__dirname, '../../.env.staging');

/** Finge la presencia (o ausencia) de `.env.staging` sin tocar el archivo real. */
function simularEnvStaging(existe: boolean) {
  const existsSyncReal = fs.existsSync.bind(fs);
  jest
    .spyOn(fs, 'existsSync')
    .mockImplementation((ruta) => (ruta === RUTA_ENV_STAGING ? existe : existsSyncReal(ruta)));
}

function cargarAppConfig(entorno: Partial<Record<(typeof CLAVES_DE_ENTORNO)[number], string>>): ConfigDeExpo {
  for (const clave of CLAVES_DE_ENTORNO) {
    const valor = entorno[clave];
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
  jest.resetModules();
  // app.config.js es CJS y lee el env al cargarse: hay que re-requerirlo por variante.
  const definirConfig = require('../../app.config.js') as DefinirConfig;
  return definirConfig({ config: CONFIG_BASE });
}

function canalDe(config: ConfigDeExpo): string | undefined {
  return config.updates.requestHeaders?.['expo-channel-name'];
}

describe('app.config.js · canal de EAS Update', () => {
  const entornoOriginal = { ...process.env };

  beforeEach(() => {
    simularEnvStaging(true);
  });

  afterEach(() => {
    process.env = { ...entornoOriginal };
    jest.restoreAllMocks();
  });

  it('la variante test queda en el canal test', () => {
    const config = cargarAppConfig({ APP_VARIANT: 'test' });
    expect(canalDe(config)).toBe('test');
    expect(config.extra.appVariant).toBe('test');
  });

  it('la variante prod queda en el canal production', () => {
    const config = cargarAppConfig({});
    expect(canalDe(config)).toBe('production');
    expect(config.extra.appVariant).toBe('prod');
  });

  it('en un build de EAS no pone el header: el canal lo graba el profile de eas.json', () => {
    expect(canalDe(cargarAppConfig({ APP_VARIANT: 'test', EAS_BUILD: 'true' }))).toBeUndefined();
    expect(canalDe(cargarAppConfig({ EAS_BUILD: 'true' }))).toBeUndefined();
  });

  it('siempre apunta al servidor de updates', () => {
    expect(cargarAppConfig({ APP_VARIANT: 'test' }).updates.url).toMatch(/^https:\/\/u\.expo\.dev\//);
  });
});

/**
 * Sin el archivo, dotenv no pisa nada y la app TEST sale con las credenciales de
 * producción manteniendo la franja de pruebas: hay que cortar el build (#444).
 */
describe('app.config.js · guard de .env.staging', () => {
  const entornoOriginal = { ...process.env };

  afterEach(() => {
    process.env = { ...entornoOriginal };
    jest.restoreAllMocks();
  });

  it('la variante test sin .env.staging no deja cargar la config', () => {
    simularEnvStaging(false);
    expect(() => cargarAppConfig({ APP_VARIANT: 'test' })).toThrow(/\.env\.staging/);
  });

  it('la variante prod no necesita .env.staging', () => {
    simularEnvStaging(false);
    expect(cargarAppConfig({}).extra.appVariant).toBe('prod');
  });

  it('un build de EAS no lo necesita: las env las trae el profile de eas.json', () => {
    simularEnvStaging(false);
    expect(cargarAppConfig({ APP_VARIANT: 'test', EAS_BUILD: 'true' }).extra.appVariant).toBe('test');
  });
});
