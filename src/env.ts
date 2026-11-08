import { defineEnvVars } from '@sveltejs/kit/env';

// All optional: a missing value must not crash the app. The /financials code fails closed
// (locked page, "not configured" messages) when SITE_PASSWORD, SESSION_SECRET or, for a source, its API key (FMP_API_KEY, EULERPOOL_API_KEY) is unset.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	SITE_PASSWORD: { schema: optional, description: 'Shared password for /financials' },
	SESSION_SECRET: { schema: optional, description: 'HMAC secret for the /financials session cookie' },
	FMP_API_KEY: { schema: optional, description: 'Financial Modeling Prep API key' },
	EULERPOOL_API_KEY: { schema: optional, description: 'Eulerpool API key' },
	ISR_BYPASS_TOKEN: {
		schema: optional,
		description:
			'Random string (32+ characters) that lets a logged-in browser skip the ISR cache; unset turns the cache off'
	}
});
