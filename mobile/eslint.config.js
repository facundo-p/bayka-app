// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

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
    // Prohíbe comparar contra códigos de error SQLSTATE de Postgres como literal
    // suelto (p.ej. `error.code === '23505'`). Deben venir de PG_ERROR
    // (src/supabase/postgresErrorCodes.ts). Detecta el patrón SQLSTATE: 2 dígitos
    // de clase + 3 alfanuméricos de subclase, como operando de una comparación de
    // igualdad. Las factories de jest.mock usan el código como PROPIEDAD de objeto
    // (no comparación) → no las marca.
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "BinaryExpression[operator=/^[!=]==?$/] > Literal[value=/^[0-9]{2}[0-9A-Z]{3}$/]",
          message:
            "No compares contra códigos de error SQLSTATE literales (p.ej. '23505'/'42501'). Usá PG_ERROR de src/supabase/postgresErrorCodes.ts.",
        },
      ],
    },
  },
]);
