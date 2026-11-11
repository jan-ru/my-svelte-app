import { describe, expect, it } from 'vitest';
import { at } from './at';
import { cssName, flattenTokens, pathIndex, resolveValue, type TokenTree } from './tokens-build';

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
