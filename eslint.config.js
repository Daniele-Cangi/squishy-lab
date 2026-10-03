import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'work/**', 'evidence/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended, ...ts.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'error' } }
);
