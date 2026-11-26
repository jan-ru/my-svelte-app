import { describe, expect, it } from 'vitest';
import { absoluteLinks, blobBase } from './links.ts';

const base = 'https://github.com/o/r/blob/2026.11.29/';

describe('absoluteLinks', () => {
	it('resolves a link against the directory of the file it was written in', () => {
		expect(absoluteLinks('see [ADR-005](adr/0005-x.md)', 'docs/overview.md', base)).toBe(
			'see [ADR-005](https://github.com/o/r/blob/2026.11.29/docs/adr/0005-x.md)'
		);
		expect(absoluteLinks('[log](../CHANGELOG.md)', 'docs/overview.md', base)).toBe(
			'[log](https://github.com/o/r/blob/2026.11.29/CHANGELOG.md)'
		);
		expect(absoluteLinks('[how](RELEASING.md)', 'CHANGELOG.md', base)).toBe(
			'[how](https://github.com/o/r/blob/2026.11.29/RELEASING.md)'
		);
	});

	it('keeps anchors and titles, and handles several links and images', () => {
		expect(absoluteLinks('[a](x.md#part "T") and ![i](img.png)', 'docs/quality/README.md', base)).toBe(
			'[a](https://github.com/o/r/blob/2026.11.29/docs/quality/x.md#part "T") and ' +
				'![i](https://github.com/o/r/blob/2026.11.29/docs/quality/img.png)'
		);
	});

	it('leaves absolute, anchor and root-relative links alone', () => {
		const text = '[w](https://example.com/a) [m](mailto:a@b.c) [s](#top) [r](/abs)';
		expect(absoluteLinks(text, 'docs/overview.md', base)).toBe(text);
	});
});

describe('blobBase', () => {
	it('joins the repository URL, blob and the ref', () => {
		expect(blobBase('https://github.com/o/r', '2026.11.29')).toBe(base);
		expect(blobBase('https://github.com/o/r/', 'abc123')).toBe('https://github.com/o/r/blob/abc123/');
	});
});
