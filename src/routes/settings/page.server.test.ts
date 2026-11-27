import { describe, expect, it, vi } from 'vitest';
import { parsePageAccess } from '#lib/server/page-access';
import { actions, load } from './+page.server';

type LoadInput = Parameters<typeof load>[0];
const generate = (() => {
	const action = actions.default;
	if (!action) throw new Error('the settings page has no default action');
	return action;
})();
type ActionInput = Parameters<typeof generate>[0];

const settings = {
	allowed: ['boss@example.test', 'reader@example.test', 'viewer@example.test'],
	admins: ['boss@example.test', 'missing@example.test'],
	rules: parsePageAccess('reader@example.test=/countries,/financials; viewer@example.test=*')
};

const runLoad = (locals: Partial<App.Locals>) => {
	const setHeaders = vi.fn();
	return { setHeaders, result: () => load({ locals, setHeaders } as unknown as LoadInput) };
};

function runAction(locals: Partial<App.Locals>, fields: readonly [string, string][]) {
	const body = new FormData();
	for (const [k, v] of fields) body.append(k, v);
	const request = new Request('http://x.test/settings', { method: 'POST', body });
	return generate({ locals, request } as unknown as ActionInput);
}

const status = async (run: () => unknown): Promise<number | undefined> => {
	try {
		await run();
	} catch (e) {
		return (e as { status?: number }).status;
	}
	return undefined;
};

describe('settings load', () => {
	it('is a 404 for anyone who is not an admin on /settings', async () => {
		expect(await status(runLoad({ admin: false }).result)).toBe(404);
		expect(await status(runLoad({ admin: true }).result)).toBe(404);
	});

	it('lists the admins first, then everyone else with their pages, and is never cached', () => {
		const { setHeaders, result } = runLoad({ admin: true, settings });
		const data = result() as { rows: unknown };
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
		expect(data.rows).toEqual([
			{ email: 'boss@example.test', admin: true, canSignIn: true, all: true, pages: [] },
			{ email: 'missing@example.test', admin: true, canSignIn: false, all: true, pages: [] },
			{
				email: 'reader@example.test',
				admin: false,
				canSignIn: true,
				all: false,
				pages: ['/countries', '/financials']
			},
			{ email: 'viewer@example.test', admin: false, canSignIn: true, all: true, pages: [] }
		]);
	});
});

describe('settings action', () => {
	it('is a 404 for anyone who is not an admin', async () => {
		expect(await status(() => runAction({ admin: false }, [['access:reader@example.test', '*']]))).toBe(404);
	});

	it('writes the value for the ticked boxes, only for users on ALLOWED_EMAILS who are not admins', async () => {
		const result = (await runAction({ admin: true, settings }, [
			['access:reader@example.test', '/companies'],
			['access:viewer@example.test', '*'],
			['access:boss@example.test', '/countries'],
			['access:intruder@evil.test', '*']
		])) as { value: string; rows: readonly { email: string }[] };
		expect(result.value).toBe('reader@example.test=/companies; viewer@example.test=*');
		expect(result.rows.map((r) => r.email)).not.toContain('intruder@evil.test');
	});

	it('writes an empty value when nothing is ticked', async () => {
		const result = (await runAction({ admin: true, settings }, [])) as { value: string };
		expect(result.value).toBe('');
	});
});
