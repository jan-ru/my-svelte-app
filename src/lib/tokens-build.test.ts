import { describe, expect, it } from 'vitest';
import { at } from './at';
import {
	buildThemeCss,
	cssName,
	declarations,
	flattenTokens,
	formatColor,
	formatNumber,
	formatValue,
	pathIndex,
	resolveValue,
	type Theme,
	type TokenTree
} from './tokens-build';

const tree: TokenTree = {
	$extensions: { 'com.figma.modeName': 'Test' },
	Main: {
		sapBrandColor: {
			$type: 'color',
			$value: { hex: '#0070F2', alpha: 1 },
			$extensions: { 'com.figma.variableId': 'x' }
		}
	},
	Shadow: { sapShadow: { $type: 'color', $value: '{Main.sapBrandColor}' } },
	Container: { Spacing: { Tiny: { $type: 'number', $value: 8 } } }
};

describe('flattenTokens', () => {
	it('lists every token in order and skips the $-prefixed metadata', () => {
		const tokens = flattenTokens(tree);
		expect(tokens.map((t) => t.path.join('.'))).toEqual([
			'Main.sapBrandColor',
			'Shadow.sapShadow',
			'Container.Spacing.Tiny'
		]);
		expect(tokens.map((t) => t.key)).toEqual(['sapBrandColor', 'sapShadow', 'Tiny']);
		expect(at(tokens, 2)).toEqual({ path: ['Container', 'Spacing', 'Tiny'], key: 'Tiny', type: 'number', value: 8 });
	});
});

describe('cssName', () => {
	it('uses the key for SAP tokens and the path for the rest', () => {
		expect(cssName({ path: ['Main', 'sapBrandColor'], key: 'sapBrandColor' })).toBe('--sapBrandColor');
		expect(cssName({ path: ['Container', 'Spacing', 'Tiny'], key: 'Tiny' })).toBe('--hz-Container-Spacing-Tiny');
	});
	it('drops spaces and other characters a custom property name cannot hold', () => {
		expect(cssName({ path: ['Additional Variables', 'Shadow Atoms', 'Shadow0_X_1'], key: 'Shadow0_X_1' })).toBe(
			'--hz-AdditionalVariables-ShadowAtoms-Shadow0_X_1'
		);
		expect(cssName({ path: ['Shell', 'sapA b/c'], key: 'sapA b/c' })).toBe('--sapAbc');
	});
});

describe('resolveValue', () => {
	const tokens = flattenTokens(tree);
	const index = pathIndex(tokens);
	it('returns a literal value as it is', () => {
		expect(resolveValue(at(tokens, 2), index)).toBe(8);
	});
	it('follows an alias to the literal', () => {
		expect(resolveValue(at(tokens, 1), index)).toEqual({ hex: '#0070F2', alpha: 1 });
	});
	it('throws when an alias points at nothing', () => {
		const lost = flattenTokens({ G: { A: { $type: 'color', $value: '{G.Missing}' } } });
		expect(() => resolveValue(at(lost, 0), pathIndex(lost))).toThrow('points at no token');
	});
	it('throws on an alias loop instead of spinning', () => {
		const loop = flattenTokens({
			G: { A: { $type: 'color', $value: '{G.B}' }, B: { $type: 'color', $value: '{G.A}' } }
		});
		expect(() => resolveValue(at(loop, 0), pathIndex(loop))).toThrow('alias chain longer than 10');
	});
});

describe('formatColor', () => {
	it('writes an opaque colour as lowercase hex', () => {
		expect(formatColor({ hex: '#0070F2', alpha: 1 })).toBe('#0070f2');
	});
	it('writes a translucent colour as rgb() with a rounded alpha', () => {
		expect(formatColor({ hex: '#131E29', alpha: 0.6000000238418579 })).toBe('rgb(19 30 41 / 0.6)');
		expect(formatColor({ hex: '#FFFFFF', alpha: 0 })).toBe('rgb(255 255 255 / 0)');
	});
	it('refuses a hex it cannot read', () => {
		expect(() => formatColor({ hex: 'blue', alpha: 1 })).toThrow('Not a #rrggbb colour');
	});
});

describe('formatNumber', () => {
	it('uses px, a bare 0, and a 0 to 1 scale for opacity', () => {
		expect(formatNumber('sapFontSize', 14)).toBe('14px');
		expect(formatNumber('Zero', 0)).toBe('0');
		expect(formatNumber('sapShell_BackgroundImageOpacity', 100)).toBe('1');
	});
});

const sample: TokenTree = {
	Main: {
		sapBrandColor: { $type: 'color', $value: { hex: '#0070F2', alpha: 1 } },
		sapDim: { $type: 'color', $value: { hex: '#131E29', alpha: 0.6000000238418579 } }
	},
	Shadow: { sapShadow: { $type: 'color', $value: '{Main.sapBrandColor}' } },
	Container: { Spacing: { Tiny: { $type: 'number', $value: 8 }, Zero: { $type: 'number', $value: 0 } } },
	Shell: { sapShell_BackgroundImageOpacity: { $type: 'number', $value: 100 } },
	Font: { Weight: { sapFontFamily: { $type: 'string', $value: 'Regular' } } },
	Other: { sapOther: { $type: 'color', $value: { hex: '#000000', alpha: 1 } } }
};
const listed = ['Main', 'Shadow', 'Container', 'Shell', 'Font'];

describe('formatValue', () => {
	const tokens = flattenTokens(sample);
	const index = pathIndex(tokens);
	const find = (key: string) =>
		at(
			tokens.filter((t) => t.key === key),
			0
		);
	it('formats colours (aliases included) and numbers, and skips strings', () => {
		expect(formatValue(find('sapShadow'), index)).toBe('#0070f2');
		expect(formatValue(find('Tiny'), index)).toBe('8px');
		expect(formatValue(find('sapFontFamily'), index)).toBeNull();
	});
	it('throws when a colour resolves to something that is not a colour', () => {
		const odd = flattenTokens({ G: { A: { $type: 'color', $value: 5 } } });
		expect(() => formatValue(at(odd, 0), pathIndex(odd))).toThrow('G.A');
	});
	it('throws when a number resolves to something that is not a number', () => {
		const odd = flattenTokens({ G: { A: { $type: 'number', $value: { hex: '#000000', alpha: 1 } } } });
		expect(() => formatValue(at(odd, 0), pathIndex(odd))).toThrow('G.A');
	});
});

describe('declarations', () => {
	it('keeps only the listed groups, in file order, without strings', () => {
		expect(declarations(flattenTokens(sample), listed)).toEqual([
			['--sapBrandColor', '#0070f2'],
			['--sapDim', 'rgb(19 30 41 / 0.6)'],
			['--sapShadow', '#0070f2'],
			['--hz-Container-Spacing-Tiny', '8px'],
			['--hz-Container-Spacing-Zero', '0'],
			['--sapShell_BackgroundImageOpacity', '1']
		]);
	});
	it('throws when two tokens would write the same custom property', () => {
		const clash = flattenTokens({
			A: { sapSame: { $type: 'color', $value: { hex: '#000000', alpha: 1 } } },
			B: { sapSame: { $type: 'color', $value: { hex: '#ffffff', alpha: 1 } } }
		});
		expect(() => declarations(clash, ['A', 'B'])).toThrow('--sapSame');
	});
});

describe('buildThemeCss', () => {
	const morning: Theme = { slug: 'morning', name: 'Morning Horizon', selector: ':root' };
	it('writes a header and one rule with a declaration per token', () => {
		expect(buildThemeCss(morning, sample, listed)).toBe(
			[
				'/* Generated by `npm run build:tokens` from design/horizon/morning.tokens.json (Morning Horizon). Do not edit. */',
				':root {',
				'\t--sapBrandColor: #0070f2;',
				'\t--sapDim: rgb(19 30 41 / 0.6);',
				'\t--sapShadow: #0070f2;',
				'\t--hz-Container-Spacing-Tiny: 8px;',
				'\t--hz-Container-Spacing-Zero: 0;',
				'\t--sapShell_BackgroundImageOpacity: 1;',
				'}',
				''
			].join('\n')
		);
	});
	it('uses the theme selector', () => {
		const evening: Theme = { slug: 'evening', name: 'Evening Horizon', selector: ":root[data-theme='evening']" };
		expect(buildThemeCss(evening, sample, ['Main'])).toContain(":root[data-theme='evening'] {");
	});
});
