declare global {
	namespace App {
		interface Locals {
			/** true when the request carries a valid /financials session cookie */
			authed: boolean;
			/** true when the request may see the interactive site: a valid session and, with the cache on, the bypass cookie */
			interactive: boolean;
		}
	}
}

export {};
