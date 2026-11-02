import { describe, expect, it } from 'vitest';
import { SourceError, failureKind, sourceFailureMessage } from './source-error';

describe('failureKind', () => {
	it("is a SourceError's kind and 'error' for anything else", () => {
		expect(failureKind(new SourceError('limit', 'x'))).toBe('limit');
		expect(failureKind(new Error('boom'))).toBe('error');
		expect(failureKind('text')).toBe('error');
	});
});

describe('sourceFailureMessage', () => {
	it.each([
		[new SourceError('config', 'x'), 'The FMP key was not accepted. Check FMP_API_KEY.'],
		[
			new SourceError('plan', 'Premium endpoint'),
			'FMP does not provide this for AAPL on your plan (Premium endpoint).'
		],
		[new SourceError('limit', 'x'), 'FMP rate limit reached. Try again in a minute.'],
		[new SourceError('unavailable', 'x'), 'FMP is unavailable right now for AAPL. Try again shortly.']
	])('says what went wrong for %s', (error, message) => {
		expect(sourceFailureMessage(error, 'AAPL', 'FMP')).toBe(message);
	});
	it('never shows the text of an error that is not a SourceError', () => {
		const message = sourceFailureMessage(new Error('https://example.com/?apikey=secret'), 'AAPL', 'FMP');
		expect(message).toBe('FMP is unavailable right now for AAPL. Try again shortly.');
		expect(message).not.toContain('secret');
	});
});
