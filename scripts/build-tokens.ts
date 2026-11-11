// Builds src/lib/styles/generated/*.css (one stylesheet per Horizon theme, plus aliases.css) from the Figma
// "export variable modes" files in design/horizon/. See docs/horizon-tokens.md.
// Usage: node scripts/build-tokens.ts   (no network)
import fs from 'node:fs';
import path from 'node:path';
import { buildAll, type TokenTree } from '../src/lib/tokens-build.ts';
import { THEMES } from '../src/lib/tokens-tables.ts';

const root = path.join(import.meta.dirname, '..');
const sources: Record<string, TokenTree> = Object.fromEntries(
	THEMES.map((theme) => [
		theme.slug,
		JSON.parse(fs.readFileSync(path.join(root, 'design/horizon', `${theme.slug}.tokens.json`), 'utf8')) as TokenTree
	])
);

const out = path.join(root, 'src/lib/styles/generated');
fs.mkdirSync(out, { recursive: true });
for (const [file, css] of Object.entries(buildAll(sources))) {
	fs.writeFileSync(path.join(out, file), css);
	console.log(`${path.relative(root, path.join(out, file))}: ${css.split('\n').length - 3} lines`);
}
