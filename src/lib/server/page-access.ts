// Which signed-in person may use which page (ADR-015). The rules come from two environment variables, never from a
// store the app writes: ADMIN_EMAILS (comma-separated, every page plus /settings) and PAGE_ACCESS (see parsePageAccess).
// Pure: hooks.server.ts reads the variables and passes them in.
import { parseAllowed } from './session';

/** The pages a permission can grant, in menu order. A path below one (`/financials/valuation/template`) belongs to it. */
export const ACCESS_PAGES = [
	{ path: '/', label: 'Multiples' },
	{ path: '/countries', label: 'Countries' },
	{ path: '/industries', label: 'Industries' },
	{ path: '/companies', label: 'Companies' },
	{ path: '/classification', label: 'Find Industry' },
	{ path: '/financials', label: 'Financials' },
	{ path: '/financials/valuation', label: 'Valuation' }
] as const;

export type AccessPage = (typeof ACCESS_PAGES)[number]['path'];

/** The admin-only page. */
export const SETTINGS_PATH = '/settings';

/** Every page, written `*` in PAGE_ACCESS. */
export const ALL_PAGES = '*';

/** One person's grant: every page, or a set of them. */
export type Grant = typeof ALL_PAGES | ReadonlySet<AccessPage>;

export type AccessRules = ReadonlyMap<string, Grant>;

const isAccessPage = (path: string): path is AccessPage => ACCESS_PAGES.some((p) => p.path === path);

/** The page a path belongs to, or null for a path no permission covers (About, the login pages). */
export function accessPageOf(pathname: string): AccessPage | null {
	if (pathname === '/') return '/';
	const matches = ACCESS_PAGES.filter(
		(p) => p.path !== '/' && (pathname === p.path || pathname.startsWith(`${p.path}/`))
	);
	// the longest match wins, so /financials/valuation is not taken for /financials
	return matches.reduce<AccessPage | null>(
		(best, p) => (best === null || p.path.length > best.length ? p.path : best),
		null
	);
}

/**
 * `PAGE_ACCESS`: entries separated by `;`, each `<address>=<pages>`, where pages is `*` or comma-separated paths from
 * ACCESS_PAGES, for example `a@x.test=*; b@y.test=/financials,/countries`. Addresses are compared lower-cased.
 * Fails closed: an entry, address or path it cannot read grants nothing, and unset grants nothing to anyone.
 */
export function parsePageAccess(raw: string | undefined): AccessRules {
	const entries = (raw ?? '').split(';').flatMap((entry): [string, Grant][] => {
		const eq = entry.indexOf('=');
		if (eq < 0) return [];
		const address = [...parseAllowed(entry.slice(0, eq))];
		if (address.length !== 1 || address[0] === undefined) return [];
		const pages = entry
			.slice(eq + 1)
			.split(',')
			.map((p) => p.trim())
			.filter((p) => p !== '');
		if (pages.includes(ALL_PAGES)) return [[address[0], ALL_PAGES]];
		return [[address[0], new Set(pages.filter(isAccessPage))]];
	});
	return new Map(entries);
}

/** The PAGE_ACCESS value for these rules, in a stable order: addresses sorted, pages in menu order, none left out. */
export function formatPageAccess(rules: AccessRules): string {
	return [...rules]
		.filter(([, grant]) => grant === ALL_PAGES || grant.size > 0)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(
			([address, grant]) =>
				`${address}=${
					grant === ALL_PAGES
						? ALL_PAGES
						: ACCESS_PAGES.filter((p) => grant.has(p.path))
								.map((p) => p.path)
								.join(',')
				}`
		)
		.join('; ');
}

/** Whether a person (null when not signed in) may use the page at `pathname`. Pages no permission covers are open. */
export function mayUse(
	email: string | null,
	pathname: string,
	admins: ReadonlySet<string>,
	rules: AccessRules
): boolean {
	const isAdmin = email !== null && admins.has(email.toLowerCase());
	if (pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`)) return isAdmin;
	const page = accessPageOf(pathname);
	if (page === null) return true;
	if (email === null) return false;
	if (isAdmin) return true;
	const grant = rules.get(email.toLowerCase());
	return grant === ALL_PAGES || (grant?.has(page) ?? false);
}

/** The rules the settings form describes: a field per address, named `access:<address>`, holding `*` or page paths. */
export function rulesFromForm(form: FormData, addresses: readonly string[]): AccessRules {
	return new Map(
		addresses.map((address): [string, Grant] => {
			const values = form.getAll(`access:${address}`).filter((v): v is string => typeof v === 'string');
			return [address, values.includes(ALL_PAGES) ? ALL_PAGES : new Set(values.filter(isAccessPage))];
		})
	);
}
