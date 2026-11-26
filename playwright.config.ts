// playwright.config.ts
// Browser smoke tests against the production build (`npm run build` first). Not part of `npm test`, which stays offline.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npm run preview -- --port ${PORT} --strictPort`,
		port: PORT,
		reuseExistingServer: !process.env.CI,
		// test-only values: sign-in is configured, so /login offers it, and the tests log in by setting a signed session
		// cookie; no test calls Google or FMP. The bypass token makes
		// "interactive" need the bypass cookie, as in production.
		env: {
			GOOGLE_CLIENT_ID: 'e2e-client-id',
			GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
			ALLOWED_EMAILS: 'e2e@example.test',
			SESSION_SECRET: 'e2e-session-secret-0123456789abcdef',
			FMP_API_KEY: 'e2e',
			ISR_BYPASS_TOKEN: 'e2e-bypass-token-0123456789abcdefghij'
		}
	}
});
