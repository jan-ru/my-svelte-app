import { render } from 'svelte/server';
import { createRawSnippet, type Component, type ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import LoginForm from './LoginForm.svelte';
import LoginPrompt from './LoginPrompt.svelte';

type Renderer = (component: unknown, options: { props: unknown }) => { body: string };

/** Server-render a component to HTML (see financials-views.test.ts for why the cast). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ComponentProps needs it
const html = <C extends Component<any>>(component: C, props: ComponentProps<C>): string =>
	(render as unknown as Renderer)(component, { props }).body;

describe('LoginForm', () => {
	it('links to the Google sign-in with the page to return to, and back to it', () => {
		const body = html(LoginForm, { configured: true, from: '/financials?symbol=AAPL', error: null });
		expect(body).toContain('href="/login/google?from=%2Ffinancials%3Fsymbol%3DAAPL"');
		expect(body).toContain('Sign in with Google');
		expect(body).toContain('data-sveltekit-reload');
		expect(body).toContain('href="/financials?symbol=AAPL"');
		expect(body).not.toContain('type="password"');
	});
	it('links to the plain sign-in without a page to return to', () => {
		const body = html(LoginForm, { configured: true, from: null, error: null });
		expect(body).toContain('href="/login/google"');
		expect(body).not.toContain('Back without logging in');
	});
	it('says sign-in is only on production, with no link, where it is not configured', () => {
		const body = html(LoginForm, { configured: false, from: null, error: null });
		expect(body).toContain('Logging in is only available on the production site.');
		expect(body).not.toContain('/login/google');
	});
	it.each([
		['denied', 'This Google account has no access.'],
		['failed', 'Signing in did not work. Try again.']
	] as const)('shows the %s message', (error, text) => {
		expect(html(LoginForm, { configured: true, from: null, error })).toContain(text);
	});
});

describe('LoginPrompt', () => {
	const children = createRawSnippet(() => ({ render: () => '<span>to change the selection.</span>' }));
	it('links to the login page with the page to return to', () => {
		const body = html(LoginPrompt, { from: '/companies?q=bank', children });
		expect(body).toContain('href="/login?from=%2Fcompanies%3Fq%3Dbank"');
		expect(body).toContain('to change the selection.');
	});
});
