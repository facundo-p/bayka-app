import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { window: 'readonly', document: 'readonly' } },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Prohíbe comparar contra códigos de error SQLSTATE de Postgres como
      // literal suelto (p.ej. `error.code === '23505'`). Deben venir de PG_ERROR
      // (src/lib/postgresErrorCodes.ts), igual que en mobile.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "BinaryExpression[operator=/^[!=]==?$/] > Literal[value=/^[0-9]{2}[0-9A-Z]{3}$/]",
          message:
            "No compares contra códigos de error SQLSTATE literales (p.ej. '23505'/'42501'). Usá PG_ERROR de src/lib/postgresErrorCodes.ts.",
        },
      ],
    },
  },
);
