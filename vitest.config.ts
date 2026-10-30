import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// compiles the .svelte files that the component render tests import
	plugins: [svelte()],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.ts'],
			// the live check hits the network and the test helper only builds fixtures
			exclude: ['src/**/*.test.ts', 'src/lib/server/nyu.live.ts', 'src/lib/server/testing/**'],
			reporter: ['text-summary', 'text'],
			// measured at 98.8 / 91.8 / 98.9 / 99.8 on 2026-10-27; the floor leaves room for normal change but catches untested new code
			thresholds: { statements: 95, branches: 85, functions: 95, lines: 95 }
		}
	}
});
