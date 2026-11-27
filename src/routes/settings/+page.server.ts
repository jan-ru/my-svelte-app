// Admin-only (ADR-015). Shows who may use which page and writes the PAGE_ACCESS value for a new choice; it stores
// nothing, so the admin pastes the value into the host's environment. Anyone else gets a 404, which says nothing
// about the page. The data comes from hooks.server.ts (locals.settings), which alone reads the variables.
import { error } from '@sveltejs/kit';
import { ACCESS_PAGES, ALL_PAGES, formatPageAccess, rulesFromForm, type AccessRules } from '#lib/server/page-access';
import type { Actions, PageServerLoad } from './$types';

/** One row of the grid: an address and what it may use. `pages` is ignored when `all` is set. */
export interface SettingsRow {
	readonly email: string;
	readonly admin: boolean;
	/** false for an admin missing from ALLOWED_EMAILS, who cannot sign in */
	readonly canSignIn: boolean;
	readonly all: boolean;
	readonly pages: readonly string[];
}

type Settings = NonNullable<App.Locals['settings']>;

function settingsOf(locals: App.Locals): Settings {
	if (!locals.settings) error(404, 'Not Found');
	return locals.settings;
}

/** The users an admin can grant pages to: everyone on ALLOWED_EMAILS who is not an admin. */
const grantable = (s: Settings): readonly string[] => s.allowed.filter((email) => !s.admins.includes(email));

function rowsOf(s: Settings, rules: AccessRules): readonly SettingsRow[] {
	const admins = s.admins.map((email) => ({
		email,
		admin: true,
		canSignIn: s.allowed.includes(email),
		all: true,
		pages: []
	}));
	const users = grantable(s).map((email) => {
		const grant = rules.get(email);
		return {
			email,
			admin: false,
			canSignIn: true,
			all: grant === ALL_PAGES,
			pages: grant === undefined || grant === ALL_PAGES ? [] : [...grant]
		};
	});
	return [...admins, ...users];
}

export const load: PageServerLoad = ({ locals, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const s = settingsOf(locals);
	return { pages: ACCESS_PAGES, rows: rowsOf(s, s.rules) };
};

export const actions: Actions = {
	/** Turns the ticked boxes into a PAGE_ACCESS value. Only addresses already on ALLOWED_EMAILS are read. */
	default: async ({ locals, request }) => {
		const s = settingsOf(locals);
		const rules = rulesFromForm(await request.formData(), grantable(s));
		return { value: formatPageAccess(rules), rows: rowsOf(s, rules) };
	}
};
