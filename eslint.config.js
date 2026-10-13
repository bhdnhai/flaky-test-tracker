// @ts-check
import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { configs as tsConfigs } from 'typescript-eslint';

const apiSrc = 'apps/api/src';
const apiModules = readdirSync(apiSrc, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'generated')
  .map((entry) => entry.name);

/**
 * Design §4: code outside an API module may import it only through its index.ts.
 * Zones are derived from the folders under apps/api/src, so new modules are covered automatically.
 */
const apiModuleBoundaries = apiModules.map((module) => ({
  target: [
    `${apiSrc}/*.ts`,
    ...apiModules.filter((m) => m !== module).map((m) => `${apiSrc}/${m}`),
  ],
  from: `${apiSrc}/${module}`,
  except: ['./index.ts'],
  message: `Import the ${module} module through its index.ts, not its internals (design §4).`,
}));

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      `${apiSrc}/generated/**`,
    ],
  },
  js.configs.recommended,
  tsConfigs.recommendedTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          conditionNames: ['source', 'types', 'import', 'default'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      // ADR-0007: npm hoisting must not hide an undeclared dependency.
      'import-x/no-extraneous-dependencies': 'error',
      'import-x/no-unresolved': 'error',
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      'import-x/no-restricted-paths': ['error', { zones: apiModuleBoundaries }],
      // Nest modules are classes with only static members and decorators.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // NFR-08 / design §4, §7: Report-derived content must render as React text nodes only.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: 'dangerouslySetInnerHTML is banned (NFR-08): render Report-derived content as text.',
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tsConfigs.disableTypeChecked],
  },
  prettier,
);
