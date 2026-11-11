import { describe, expect, it } from 'vitest';
import { at } from './at';
import {
	ADOPTED,
	ALIASES,
	buildAliasCss,
	buildAll,
	buildGridCss,
	buildThemeCss,
	cssName,
	declarations,
	flattenTokens,
	formatColor,
	formatNumber,
	formatValue,
	GRID,
	pathIndex,
	resolveValue,
	shadowDeclarations,
	shellShadowDeclarations,
	themeDeclarations,
	type GridSize,
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

// Shadow atoms as the export holds them: two layers each of position, blur, spread and colour, for four levels.
const atomsFor = (skip?: string): Record<string, unknown> =>
	Object.fromEntries(
		[0, 1, 2, 3]
			.flatMap((level) =>
				[1, 2].flatMap((layer) => [
					[`Shadow${level}_X_${layer}`, { $type: 'number', $value: 0 }],
					[`Shadow${level}_Y_${layer}`, { $type: 'number', $value: level + layer }],
					[`Shadow${level}_Blur_${layer}`, { $type: 'number', $value: 4 }],
					[`Shadow${level}_Spread_${layer}`, { $type: 'number', $value: 0 }],
					[`Shadow${level}_Color_${layer}`, { $type: 'color', $value: { hex: '#223548', alpha: 0.2 } }]
				])
			)
			.filter(([key]) => key !== skip)
	);
const treeWith = (atoms: Record<string, unknown>): TokenTree => ({
	'Additional Variables': { 'Shadow Atoms': atoms }
});

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
	it('can write rem, 16px to the rem, so spacing follows the browser font size', () => {
		expect(formatNumber('Tiny', 8, 'rem')).toBe('0.5rem');
		expect(formatNumber('Large', 48, 'rem')).toBe('3rem');
		expect(formatNumber('Zero', 0, 'rem')).toBe('0');
	});
});

describe('spacing units', () => {
	const spacing: TokenTree = {
		Container: {
			Spacing: {
				Tiny: { $type: 'number', $value: 8 },
				Zero: { $type: 'number', $value: 0 },
				sapContent_Space_Small: { $type: 'number', $value: 16 },
				sapBreakpoint_M_Min: { $type: 'number', $value: 600 }
			},
			sapPopover_BorderCornerRadius: { $type: 'number', $value: 8 }
		}
	};
	const tokens = flattenTokens(spacing);
	const index = pathIndex(tokens);
	const valueOf = (key: string): string | null =>
		formatValue(
			at(
				tokens.filter((t) => t.key === key),
				0
			),
			index
		);
	it('writes Container/Spacing in rem, but not breakpoints or other Container numbers', () => {
		expect(valueOf('Tiny')).toBe('0.5rem');
		expect(valueOf('sapContent_Space_Small')).toBe('1rem');
		expect(valueOf('Zero')).toBe('0');
		expect(valueOf('sapBreakpoint_M_Min')).toBe('600px');
		expect(valueOf('sapPopover_BorderCornerRadius')).toBe('8px');
	});
});

describe('shadowDeclarations', () => {
	it('composes the four Horizon shadows from their two layers of atoms', () => {
		const result = shadowDeclarations(flattenTokens(treeWith(atomsFor())));
		expect(result.map(([name]) => name)).toEqual([
			'--sapContent_Shadow0',
			'--sapContent_Shadow1',
			'--sapContent_Shadow2',
			'--sapContent_Shadow3'
		]);
		expect(at(result, 0)[1]).toBe('0 1px 4px 0 rgb(34 53 72 / 0.2), 0 2px 4px 0 rgb(34 53 72 / 0.2)');
		expect(at(result, 3)[1]).toBe('0 4px 4px 0 rgb(34 53 72 / 0.2), 0 5px 4px 0 rgb(34 53 72 / 0.2)');
	});
	it('throws when an atom is missing, naming it', () => {
		expect(() => shadowDeclarations(flattenTokens(treeWith(atomsFor('Shadow1_Blur_2'))))).toThrow(
			'Shadow1: no Blur_2 atom'
		);
	});
	it('are part of a theme next to the grouped tokens, and may not clash with them', () => {
		const names = themeDeclarations(flattenTokens(treeWith(atomsFor())), listed).map(([name]) => name);
		expect(names).toContain('--sapContent_Shadow2');
		const clash: TokenTree = {
			Shadow: { sapContent_Shadow0: { $type: 'color', $value: { hex: '#000000', alpha: 1 } } },
			...treeWith(atomsFor())
		};
		expect(() => themeDeclarations(flattenTokens(clash), ['Shadow'])).toThrow('--sapContent_Shadow0');
	});
});

describe('shellShadowDeclarations', () => {
	const shell = (skip?: string): TokenTree => ({
		Shell: Object.fromEntries(
			[1, 2]
				.flatMap((layer) => [
					[`Shell_Shadow_X_${layer}`, { $type: 'number', $value: 0 }],
					[`Shell_Shadow_Y_${layer}`, { $type: 'number', $value: layer }],
					[`Shell_Shadow_Blur_${layer}`, { $type: 'number', $value: 2 }],
					[`Shell_Shadow_Spread_${layer}`, { $type: 'number', $value: 0 }],
					[`Shell_ShadowColor_${layer}`, { $type: 'color', $value: { hex: '#223548', alpha: 0.1 } }]
				])
				.filter(([key]) => key !== skip)
		)
	});
	it('composes --sapShell_Shadow from its two layers', () => {
		expect(shellShadowDeclarations(flattenTokens(shell()))).toEqual([
			['--sapShell_Shadow', '0 1px 2px 0 rgb(34 53 72 / 0.1), 0 2px 2px 0 rgb(34 53 72 / 0.1)']
		]);
	});
	it('writes nothing when the export has no shell shadow', () => {
		expect(shellShadowDeclarations(flattenTokens(treeWith(atomsFor())))).toEqual([]);
	});
	it('throws when an atom is missing, naming it', () => {
		expect(() => shellShadowDeclarations(flattenTokens(shell('Shell_Shadow_Blur_2')))).toThrow(
			'Shell shadow: no Shadow_Blur_2 atom'
		);
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
		expect(formatValue(find('Tiny'), index)).toBe('0.5rem');
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
			['--hz-Container-Spacing-Tiny', '0.5rem'],
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
	const withShadows: TokenTree = { ...sample, ...treeWith(atomsFor()) };
	it('writes a header and one rule with a declaration per token, the composed shadows last', () => {
		expect(buildThemeCss(morning, withShadows, listed)).toBe(
			[
				'/* Generated by `npm run build:tokens` from design/horizon/morning.tokens.json (Morning Horizon). Do not edit. */',
				':root {',
				'\t--sapBrandColor: #0070f2;',
				'\t--sapDim: rgb(19 30 41 / 0.6);',
				'\t--sapShadow: #0070f2;',
				'\t--hz-Container-Spacing-Tiny: 0.5rem;',
				'\t--hz-Container-Spacing-Zero: 0;',
				'\t--sapShell_BackgroundImageOpacity: 1;',
				'\t--sapContent_Shadow0: 0 1px 4px 0 rgb(34 53 72 / 0.2), 0 2px 4px 0 rgb(34 53 72 / 0.2);',
				'\t--sapContent_Shadow1: 0 2px 4px 0 rgb(34 53 72 / 0.2), 0 3px 4px 0 rgb(34 53 72 / 0.2);',
				'\t--sapContent_Shadow2: 0 3px 4px 0 rgb(34 53 72 / 0.2), 0 4px 4px 0 rgb(34 53 72 / 0.2);',
				'\t--sapContent_Shadow3: 0 4px 4px 0 rgb(34 53 72 / 0.2), 0 5px 4px 0 rgb(34 53 72 / 0.2);',
				'}',
				''
			].join('\n')
		);
	});
	it('uses the theme selector', () => {
		const evening: Theme = { slug: 'evening', name: 'Evening Horizon', selector: ":root[data-theme='evening']" };
		expect(buildThemeCss(evening, withShadows, ['Main'])).toContain(":root[data-theme='evening'] {");
	});
});

describe('buildAliasCss', () => {
	const morning = declarations(flattenTokens(sample), listed);
	it('writes var() references for names whose value still matches', () => {
		const css = buildAliasCss([{ name: '--brand', token: 'sapBrandColor', was: '#0070f2' }], morning);
		expect(css).toContain(':root {');
		expect(css).toContain('\t--brand: var(--sapBrandColor);');
	});
	it('throws when the Horizon value no longer equals the old one', () => {
		expect(() => buildAliasCss([{ name: '--brand', token: 'sapBrandColor', was: '#ffffff' }], morning)).toThrow(
			'--brand was #ffffff'
		);
	});
	it('throws when the Horizon token is not written at all', () => {
		expect(() => buildAliasCss([{ name: '--brand', token: 'sapGone', was: '#ffffff' }], morning)).toThrow('missing');
	});
});

describe('buildAliasCss with adopted names', () => {
	const morning = [['--sapContent_Shadow0', '0 0 2px 0 rgb(34 53 72 / 0.2)']] as const;
	it('writes adopted names too, which keep no old value because they are meant to change', () => {
		const css = buildAliasCss([], morning, [{ name: '--shadow-1', token: 'sapContent_Shadow0' }]);
		expect(css).toContain('\t--shadow-1: var(--sapContent_Shadow0);');
	});
	it('throws when the Horizon token of an adopted name is not written', () => {
		expect(() => buildAliasCss([], morning, [{ name: '--shadow-1', token: 'sapGone' }])).toThrow('missing');
	});
});

describe('ALIASES', () => {
	it('names each custom property once, and writes each as a var() of a different property', () => {
		expect(new Set(ALIASES.map((a) => a.name)).size).toBe(ALIASES.length);
		expect(ALIASES.every((a) => /^(#[0-9a-f]{6}|[0-9.]+rem)$/.test(a.was) && a.name !== `--${a.token}`)).toBe(true);
	});
	it('include the four spacing steps that equal Horizon exactly, as rem', () => {
		const spacing = ALIASES.filter((a) => a.name.startsWith('--space-')).map((a) => [a.name, a.token, a.was]);
		expect(spacing).toEqual([
			['--space-2', 'sapContent_Space_Tiny', '0.5rem'],
			['--space-4', 'sapContent_Space_Small', '1rem'],
			['--space-8', 'sapContent_Space_Medium', '2rem'],
			['--space-12', 'sapContent_Space_Large', '3rem']
		]);
	});
});

describe('ADOPTED', () => {
	it('moves the shadows and the focus ring onto Horizon', () => {
		expect(ADOPTED.map((a) => [a.name, a.token])).toEqual([
			['--shadow-1', 'sapContent_Shadow0'],
			['--shadow-2', 'sapContent_Shadow1'],
			['--shadow-3', 'sapContent_Shadow2'],
			['--shadow-4', 'sapContent_Shadow3'],
			['--border-focus', 'sapContent_FocusColor'],
			['--focus-ring', 'sapContent_FocusWidth']
		]);
	});
});

describe('buildAll', () => {
	const all = {
		morning: {
			Main: { sapHighlightColor: { $type: 'color', $value: { hex: '#0064D9', alpha: 1 } } },
			...treeWith(atomsFor())
		},
		evening: { Main: { sapHighlightColor: { $type: 'color', $value: { hex: '#4DA1FF', alpha: 1 } } } },
		'high-contrast-white': { Main: {} },
		'high-contrast-black': { Main: {} }
	};
	it('throws when a theme file is missing', () => {
		expect(() => buildAll({ morning: all.morning })).toThrow('No token file for theme evening');
	});
});

describe('buildGridCss', () => {
	const breakpoints = [
		['--sapBreakpoint_S_Min', '0'],
		['--sapBreakpoint_M_Min', '600px'],
		['--sapBreakpoint_L_Min', '1024px'],
		['--sapBreakpoint_XL_Min', '1440px']
	] as const;
	const css = buildGridCss(GRID, breakpoints);

	it('writes the smallest size as the default on :root, in rem', () => {
		expect(css).toContain(
			':root {\n\t--hz-grid-columns: 4;\n\t--hz-grid-margin: 1rem;\n\t--hz-grid-gutter: 0.5rem;\n}'
		);
	});
	it('overrides the three properties at each larger breakpoint, smallest first', () => {
		const order = [...css.matchAll(/@media \(min-width: (\d+)px\)/g)].map((m) => m[1]);
		expect(order).toEqual(['600', '1024', '1440']);
		expect(css).toContain(
			'@media (min-width: 600px) {\n\t:root {\n\t\t--hz-grid-columns: 8;\n\t\t--hz-grid-margin: 2rem;\n\t\t--hz-grid-gutter: 1rem;\n\t}\n}'
		);
		expect(css).toContain('--hz-grid-columns: 12;');
		expect(css).toContain(
			'@media (min-width: 1440px) {\n\t:root {\n\t\t--hz-grid-columns: 16;\n\t\t--hz-grid-margin: 3rem;\n\t\t--hz-grid-gutter: 1rem;\n\t}\n}'
		);
	});
	it('throws when a breakpoint token is missing, not in px, or not increasing', () => {
		const [s, m, , xl] = breakpoints;
		expect(() => buildGridCss(GRID, breakpoints.slice(0, 2))).toThrow('--sapBreakpoint_L_Min');
		expect(() => buildGridCss(GRID, [s, m, ['--sapBreakpoint_L_Min', '60rem'], xl])).toThrow('--sapBreakpoint_L_Min');
		expect(() => buildGridCss(GRID, [s, m, ['--sapBreakpoint_L_Min', '500px'], xl])).toThrow('increasing');
	});
	it('throws when there is no size', () => {
		expect(() => buildGridCss([], breakpoints)).toThrow('no sizes');
	});
});

describe('GRID', () => {
	it('holds the four Horizon layout-guide sizes read from Figma', () => {
		const rows: readonly GridSize[] = [
			{ size: 'S', columns: 4, margin: 16, gutter: 8 },
			{ size: 'M', columns: 8, margin: 32, gutter: 16 },
			{ size: 'L', columns: 12, margin: 32, gutter: 16 },
			{ size: 'XL', columns: 16, margin: 48, gutter: 16 }
		];
		expect(GRID).toEqual(rows);
	});
});
