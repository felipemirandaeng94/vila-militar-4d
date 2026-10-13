import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/', 'node_modules/', 'src-legado/', '*.html', 'scripts/geo/.venv/', 'geo/', 'ferramentas/', 'public/modelos/basis/'] },
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-useless-assignment': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  { files: ['*.config.js', 'scripts/**/*.js', 'scripts/**/*.mjs', 'e2e/**/*.mjs'], languageOptions: { globals: { ...globals.node } } }
];
