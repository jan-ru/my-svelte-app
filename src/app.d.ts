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
			/** true when the request carries a valid session cookie and that person may use this page (ADR-015) */
			authed: boolean;
			/** true when the request may see the interactive page: `authed` and, with the cache on, the bypass cookie */
			interactive: boolean;
			/** true when a signed-in person is on a page their PAGE_ACCESS does not grant, so it can say so */
			denied: boolean;
			/** true when the signed-in person is on ADMIN_EMAILS */
			admin: boolean;
			/** Only on /settings, for an admin: the signed-in list, the admins and the rules in force. */
			settings?: {
				readonly allowed: readonly string[];
				readonly admins: readonly string[];
				readonly rules: import('#lib/server/page-access').AccessRules;
			};
		}
	}
}

export {};
