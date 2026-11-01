import { describe, expect, it } from 'vitest';
import { errorView } from './error-view';

describe('errorView', () => {
	it('names a missing page plainly, whatever the framework message says', () => {
		expect(errorView(404, 'Not Found')).toEqual({
			title: 'Page not found',
			detail: 'There is no page at this address.',
			reference: null
		});
	});

	it('keeps the safe message of an expected error', () => {
		expect(errorView(401, 'Log in to download the template.')).toMatchObject({
			title: 'Log in needed',
			detail: 'Log in to download the template.'
		});
	});

	it('gives an unexpected error a generic title and its reference', () => {
		expect(errorView(500, 'Something went wrong.', 'abc')).toEqual({
			title: 'Something went wrong',
			detail: 'Something went wrong.',
			reference: 'abc'
		});
	});

	it('falls back for an unlisted status and an empty message', () => {
		expect(errorView(418, '')).toEqual({
			title: 'Request not handled',
			detail: 'The request could not be completed.',
			reference: null
		});
		expect(errorView(502, '').title).toBe('Something went wrong');
	});
});
