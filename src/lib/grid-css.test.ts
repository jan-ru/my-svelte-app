import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRID } from './tokens-build';

const styles = path.join(import.meta.dirname, 'styles');
const helper = readFileSync(path.join(styles, 'grid.css'), 'utf8');
const morning = readFileSync(path.join(styles, 'generated/morning.css'), 'utf8');

/** The CSS inside `@media (min-width: <px>px) { ... }`, or `null`. The blocks here do not nest braces beyond one rule. */
function mediaBlock(css: string, px: number): string | null {
	const start = css.indexOf(`@media (min-width: ${px}px) {`);
	if (start === -1) return null;
	const end = css.indexOf('\n}\n', start);
	return css.slice(start, end);
}

const breakpoint = (name: string): number => {
	const match = new RegExp(`--sapBreakpoint_${name}_Min: (\\d+)px;`).exec(morning);
	if (!match?.[1]) throw new Error(`no ${name} breakpoint in morning.css`);
	return Number(match[1]);
};

describe('the grid helper stylesheet', () => {
	it('writes the same breakpoints as the Horizon tokens', () => {
		for (const size of ['M', 'L', 'XL'] as const) expect(mediaBlock(helper, breakpoint(size)), size).not.toBeNull();
	});
	it('has a span class for every column of every size', () => {
		const columns = (size: string): number => GRID.find((g) => g.size === size)?.columns ?? 0;
		for (let i = 1; i <= columns('S'); i++) expect(helper).toContain(`.span-${i} {\n\tgrid-column: span ${i};`);
		for (const [prefix, size] of [
			['m', 'M'],
			['l', 'L'],
			['xl', 'XL']
		] as const) {
			const block = mediaBlock(helper, breakpoint(size)) ?? '';
			for (let i = 1; i <= columns(size); i++)
				expect(block, `.span-${prefix}-${i}`).toContain(`.span-${prefix}-${i} {\n\t\tgrid-column: span ${i};`);
			expect(block).not.toContain(`.span-${prefix}-${columns(size) + 1} `);
		}
	});
	it('puts the full-width default before the span classes so that a span class wins', () => {
		expect(helper.indexOf('.grid > *')).toBeGreaterThan(-1);
		expect(helper.indexOf('.grid > *')).toBeLessThan(helper.indexOf('.span-1 '));
	});
	it('caps the page container at 80rem and reads the grid margin', () => {
		expect(helper).toContain('max-width: 80rem;');
		expect(helper).toContain('padding-inline: var(--hz-grid-margin);');
	});
});
