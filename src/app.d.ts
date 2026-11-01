declare global {
	/** Set by Vercel at build time for its Analytics and Speed Insights scripts (see `+layout.svelte`). */
	interface ImportMetaEnv {
		readonly VITE_VERCEL_OBSERVABILITY_BASEPATH?: string;
		readonly VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG?: string;
	}

	namespace App {
		interface Error {
			status: number;
			message: string;
			/** Set by `handleError` for unexpected errors, so the visitor can quote it and the log line can be found. */
			errorId?: string;
		}
		interface Locals {
			/** true when the request carries a valid /financials session cookie */
			authed: boolean;
			/** true when the request may see the interactive site: a valid session and, with the cache on, the bypass cookie */
			interactive: boolean;
		}
	}
}

export {};
