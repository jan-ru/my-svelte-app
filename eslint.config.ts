// eslint.config.ts
// typescript-eslint's strict, type-aware rules for .ts and Svelte files; formatting is left to Prettier.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig(
	{ ignores: ['.lighthouseci/', '.svelte-kit/', '.vercel/', 'build/', 'coverage/', 'docs/api/', 'node_modules/'] },
	js.configs.recommended,
	ts.configs.strictTypeChecked,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: { projectService: true, extraFileExtensions: ['.svelte'], tsconfigRootDir: import.meta.dirname }
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		rules: {
			// numbers in messages and labels are the common case and always print as expected
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
			// links are built by tested helpers (sizeHref, quoteLink, ...) that return paths with a query string
			'svelte/no-navigation-without-resolve': 'off',
			// a leading underscore marks a parameter or binding that is unused on purpose
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }
			]
		}
	},
	{
		files: ['**/*.test.ts', '**/*.live.ts'],
		rules: {
			// fakes are async to match the real functions; `!` on a fixture fails the test loudly anyway;
			// expect(fake.method) passes the method without calling it; matchers such as expect.any() are typed any
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/unbound-method': 'off'
		}
	}
);
