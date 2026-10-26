declare global {
	namespace App {
		interface Locals {
			/** true when the request carries a valid /financials session cookie */
			authed: boolean;
		}
	}
}

export {};
