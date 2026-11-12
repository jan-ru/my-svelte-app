// e2e/smoke.spec.ts
// Each page loads in a real browser with no script or CSP errors and no serious axe violations.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PUBLIC_PAGES = ['/', '/classification', '/companies', '/countries', '/industries', '/about'] as const;

/** Collect page errors and console errors (a CSP block or a failed hydration shows up as one). */
function watchErrors(page: Page): string[] {
	const errors: string[] = [];
	// Vercel serves its analytics scripts only on Vercel; here they 404
	const offVercel = (url: string, text: string) => url.includes('/_vercel/') || text.includes('/_vercel/');
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error' && !offVercel(message.location().url, message.text())) errors.push(message.text());
	});
	return errors;
}

async function expectAccessible(page: Page): Promise<void> {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
	const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
	expect(
		serious.map(
			(v) => `${v.id}: ${v.help} (${v.nodes.map((n) => `${n.target.join(' ')} ${n.failureSummary ?? ''}`).join('; ')})`
		)
	).toEqual([]);
}

async function logIn(page: Page): Promise<void> {
	await page.goto('/login?from=%2Ffinancials');
	await page.getByLabel('Password').fill('e2e-password');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
}

for (const path of PUBLIC_PAGES) {
	test(`${path} loads without errors and is accessible`, async ({ page }) => {
		const errors = watchErrors(page);
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		await expect(page.locator('h1')).toBeVisible();
		await page.waitForLoadState('networkidle');
		await expectAccessible(page);
		expect(errors).toEqual([]);
	});
}

test('the menubar is one 44px row on a desktop', async ({ page }) => {
	const errors = watchErrors(page);
	await page.setViewportSize({ width: 1200, height: 900 });
	await page.goto('/about');
	const height = await page
		.getByRole('navigation', { name: 'Main' })
		.evaluate((nav) => nav.getBoundingClientRect().height);
	// 44px plus the 1px bottom border
	expect(height).toBeLessThanOrEqual(45);
	expect(errors).toEqual([]);
});

test('an unknown address shows the site error page', async ({ page }) => {
	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('a wrong password is refused', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Password').fill('wrong');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Wrong password.');
});

test('logging in opens /financials and logging out locks it again', async ({ page }) => {
	const errors = watchErrors(page);
	await logIn(page);
	await expect(page.getByLabel('Ticker')).toBeVisible();
	await expectAccessible(page);
	await page.getByRole('button', { name: 'Log out' }).click();
	await page.goto('/financials');
	await expect(page.getByRole('note').getByRole('link', { name: 'Log in' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('the menubar login returns to the page it was opened from', async ({ page }) => {
	const errors = watchErrors(page);
	await page.goto('/companies');
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
	await expect(page).toHaveURL(/\/login\?from=%2Fcompanies$/);
	await expectAccessible(page);
	await page.getByLabel('Password').fill('e2e-password');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL(/\/companies$/);
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
	expect(errors).toEqual([]);
});

test('an uploaded template values a private company', async ({ page }) => {
	const errors = watchErrors(page);
	await logIn(page);
	await page.goto('/financials/valuation');
	const csv = [
		'Company,E2E BV',
		'Currency,EUR',
		'Net debt,0',
		'Year,2024,2025',
		'Type,Actual,Actual',
		'Revenue,100000,110000',
		'EBITDA,20000,22000'
	].join('\n');
	await page
		.getByLabel('Private company')
		.setInputFiles({ name: 'figures.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
	await page.getByRole('button', { name: 'Upload figures' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E BV valuation');
	expect(page.url()).toContain('co=');
	await expectAccessible(page);
	expect(errors).toEqual([]);
});

/** The country tiles of the first treemap on /countries. */
const countryTile = (page: Page, country: string) =>
	page
		.getByRole('group', { name: /^Treemap of/ })
		.first()
		.locator('a.tile', { has: page.locator('title', { hasText: new RegExp(`^${country}:`) }) });

test('clicking a country tile selects it and clicking it again removes it', async ({ page }) => {
	const errors = watchErrors(page);
	await logIn(page);
	await page.goto('/countries');
	await countryTile(page, 'China').click();
	await expect(page).toHaveURL(/\/countries\?country=China$/);
	await expect(page.getByRole('heading', { name: 'Selected countries versus global' })).toBeVisible();
	await countryTile(page, 'Japan').click();
	await expect(page).toHaveURL(/\/countries\?country=China&country=Japan$/);
	await countryTile(page, 'Japan').click();
	await expect(page).toHaveURL(/\/countries\?country=China$/);
	expect(errors).toEqual([]);
});

test('a logged-in browser that lost the bypass cookie gets it back from the Log in link', async ({ page, context }) => {
	await logIn(page);
	await context.clearCookies({ name: '__prerender_bypass' });
	await page.goto('/countries');
	await expect(page.locator('svg a.tile')).toHaveCount(0);
	await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }).click();
	await expect(page).toHaveURL(/\/countries$/);
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
	await countryTile(page, 'China').click();
	await expect(page).toHaveURL(/\/countries\?country=China$/);
});

for (const [menu, param] of [
	['Countries', 'country'],
	['Industries', 'industry']
] as const) {
	const query = new RegExp(`\\?${param}=`);
	test(`after opening ${menu} from the menu, clicking a tile selects it`, async ({ page }) => {
		const errors = watchErrors(page);
		await logIn(page);
		// client-side navigation renders the treemap in the browser instead of hydrating server HTML
		await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Explore' }).click();
		await page.getByRole('link', { name: menu, exact: true }).first().click();
		await expect(page.locator('h1')).toHaveText(menu);
		await page.locator(`svg a.tile[href*="?${param}="]`).first().click();
		await expect(page).toHaveURL(query);
		expect(errors).toEqual([]);
	});
}

test('the Home pickers follow the Horizon grid: 4, 8, 12 and 16 columns', async ({ page }) => {
	const errors = watchErrors(page);
	await logIn(page);
	const columnsAt = async (width: number): Promise<number> => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		const tracks = await page.locator('.controls').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
		return tracks.split(' ').length;
	};
	expect(await columnsAt(400)).toBe(4);
	expect(await columnsAt(800)).toBe(8);
	expect(await columnsAt(1200)).toBe(12);
	expect(await columnsAt(1600)).toBe(16);
	// the picker widths follow the spans: stacked on a phone, side by side on a wide screen
	await page.setViewportSize({ width: 400, height: 900 });
	await page.goto('/');
	const tops = await page
		.locator('.controls > div')
		.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
	expect(new Set(tops).size).toBe(3);
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.goto('/');
	const wideTops = await page
		.locator('.controls > div')
		.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
	expect(new Set(wideTops).size).toBe(1);
	expect(errors).toEqual([]);
});

// Every view works without JavaScript (README, docs/overview.md): the pages are server-rendered and every control is a
// plain link or form. `javaScriptEnabled: false` turns scripts off in the browser, so nothing here can be hydration.
test.describe('without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	/** SvelteKit's inline bootstrap script defines a `__sveltekit_*` global; it only exists if scripts ran. */
	const scriptsRan = () => Object.keys(window).some((key) => key.startsWith('__sveltekit'));

	for (const path of PUBLIC_PAGES) {
		test(`${path} shows its heading and the menu`, async ({ page }) => {
			const response = await page.goto(path);
			expect(response?.status()).toBe(200);
			expect(await page.evaluate(scriptsRan), 'scripts must be off for this test to mean anything').toBe(false);
			await expect(page.locator('h1')).toBeVisible();
			await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
		});
	}

	test('the classification search, shown to a logged-in visitor, is a plain GET form', async ({ page }) => {
		await logIn(page);
		await page.goto('/classification');
		await page.getByLabel('Search by code or words').fill('6419');
		await page.getByRole('button', { name: 'Search' }).click();
		await expect(page).toHaveURL(/\/classification\?q=6419/);
		await expect(page.locator('h1')).toBeVisible();
	});

	test('a wrong password is refused and the right one opens /financials', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Password').fill('wrong');
		await page.getByRole('button', { name: 'Log in' }).click();
		await expect(page.getByRole('alert')).toHaveText('Wrong password.');
		await logIn(page);
		await expect(page.getByLabel('Ticker')).toBeVisible();
	});

	test('an uploaded template shows the company figures and the valuation as tables', async ({ page }) => {
		await logIn(page);
		await page.goto('/financials/valuation');
		const csv = [
			'Company,E2E BV',
			'Currency,EUR',
			'Net debt,0',
			'Year,2024,2025',
			'Type,Actual,Actual',
			'Revenue,100000,110000',
			'EBITDA,20000,22000'
		].join('\n');
		await page
			.getByLabel('Private company')
			.setInputFiles({ name: 'figures.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
		await page.getByRole('button', { name: 'Upload figures' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E BV valuation');
		const figures = page.getByRole('table').filter({ hasText: 'Revenue' }).first();
		await expect(figures.getByRole('columnheader', { name: /2025/ })).toBeVisible();
		await expect(figures.getByRole('rowheader', { name: 'Revenue' })).toBeVisible();
	});
});
