// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
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
