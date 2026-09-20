// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

// Prohíbe comparar contra códigos de error SQLSTATE de Postgres como literal suelto
// (p.ej. `error.code === '23505'`). Deben venir de PG_ERROR
// (src/supabase/postgresErrorCodes.ts). Detecta el patrón SQLSTATE: 2 dígitos de
// clase + 3 alfanuméricos de subclase, como operando de una comparación de igualdad.
// Las factories de jest.mock usan el código como PROPIEDAD de objeto (no
// comparación) → no las marca.
const SQLSTATE_LITERAL = {
  selector: "BinaryExpression[operator=/^[!=]==?$/] > Literal[value=/^[0-9]{2}[0-9A-Z]{3}$/]",
  message:
    "No compares contra códigos de error SQLSTATE literales (p.ej. '23505'/'42501'). Usá PG_ERROR de src/supabase/postgresErrorCodes.ts.",
};

// `.transaction()` de drizzle/expo-sqlite es síncrona: con un callback async
// commitea vacío y las filas se escriben en autocommit, sin atomicidad (#448). No se
// ata al nombre `db` porque `(db as any)`, un alias del import o `db['transaction']`
// la esquivaban. Solo en `src/`: los tests de integración corren sobre
// better-sqlite3, donde la API síncrona es la correcta.
const MENSAJE_TRANSACCION =
  "`.transaction()` no espera callbacks async: commitea vacío. Usá enTransaccion de src/database/transaccion.ts.";
const TRANSACCION_SINCRONA = [
  {
    selector: "CallExpression > MemberExpression[computed=false][property.name='transaction']",
    message: MENSAJE_TRANSACCION,
  },
  {
    selector: "CallExpression > MemberExpression[computed=true][property.value='transaction']",
    message: MENSAJE_TRANSACCION,
  },
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Config y scripts de tooling corren en Node como CommonJS, no en la app;
    // expoConfig solo le da globals de Node a metro.config.js.
    files: ["*.config.js", "sql-transformer.js", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    // Los mocks manuales en JS usan el global `jest` sin importarlo.
    files: ["__mocks__/**/*.js", "tests/__mocks__/**/*.js"],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    // `no-restricted-syntax` NO se acumula entre bloques: el último que matchea un
    // archivo reemplaza la lista entera. Por eso los selectores se componen acá.
    rules: { "no-restricted-syntax": ["error", SQLSTATE_LITERAL] },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: { "no-restricted-syntax": ["error", SQLSTATE_LITERAL, ...TRANSACCION_SINCRONA] },
  },
  {
    // El idioma de Jest, no un descuido: `jest.mock()` se hoistea por encima de
    // los imports, así que va escrito arriba de ellos, y los mocks manuales se
    // cargan con `require()`. Con las dos reglas prendidas, los tests aportaban
    // 253 de los 352 warnings del repo y tapaban los que sí importan (#599).
    files: ["tests/**"],
    rules: {
      "import/first": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
