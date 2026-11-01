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
	it('posts to the login action with the page to return to, and links back to it', () => {
		const body = html(LoginForm, { configured: true, from: '/financials?symbol=AAPL' });
		expect(body).toContain('action="?/login&amp;from=%2Ffinancials%3Fsymbol%3DAAPL"');
		expect(body).toContain('type="password"');
		expect(body).toContain('href="/financials?symbol=AAPL"');
	});
	it('posts to the plain action without a page to return to', () => {
		const body = html(LoginForm, { configured: true, from: null });
		expect(body).toContain('action="?/login"');
		expect(body).not.toContain('Back without logging in');
	});
	it('shows the error message, and no form when logging in is not configured', () => {
		const body = html(LoginForm, { configured: false, from: null, message: 'Wrong password.' });
		expect(body).not.toContain('<form');
		expect(body).toContain('not configured');
		expect(body).toContain('Wrong password.');
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
