import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.live.ts'],
		environment: 'node',
		testTimeout: 120_000
	}
});
