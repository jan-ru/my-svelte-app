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
	await page.goto('/financials');
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

test('an unknown address shows the site error page', async ({ page }) => {
	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('a wrong password is refused', async ({ page }) => {
	await page.goto('/financials');
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
	await expect(page.getByLabel('Password')).toBeVisible();
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
