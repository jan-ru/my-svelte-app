import type { LayoutServerLoad } from './$types';

// `admin` only on an interactive request: those are never cached, so the Settings link can never reach the cached
// public copy that anonymous visitors get.
export const load: LayoutServerLoad = ({ locals }) => ({
	interactive: locals.interactive,
	admin: locals.admin && locals.interactive
});
