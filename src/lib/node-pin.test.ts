import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The project stays on one Node LTS line. It is written down in four places that must not drift apart: the `engines`
// pin (which Vercel reads), the CI workflows, `.nvmrc` for local use, and the `@types/node` type definitions.
// Moving to the next LTS is a deliberate change of all four in one pull request.
const root = path.join(import.meta.dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json')) as { engines: { node: string }; devDependencies: Record<string, string> };
const major = (range: string) => Number(/(\d+)/.exec(range)![1]);

describe('Node LTS pin', () => {
	const pinned = major(pkg.engines.node);

	it('is an even-numbered major, because only those become LTS', () => {
		expect(pinned % 2).toBe(0);
	});
	it('is the same major in .nvmrc and in @types/node', () => {
		expect(major(read('.nvmrc'))).toBe(pinned);
		expect(major(pkg.devDependencies['@types/node'])).toBe(pinned);
	});
	it('is the same major in every CI workflow', () => {
		const workflows = fs.readdirSync(path.join(root, '.github/workflows')).filter((f) => f.endsWith('.yml'));
		const versions = workflows.flatMap((f) => [...read(`.github/workflows/${f}`).matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => Number(m[1])));
		expect(versions.length).toBeGreaterThan(0);
		for (const v of versions) expect(v).toBe(pinned);
	});
	it('keeps Dependabot from proposing a newer @types/node major', () => {
		expect(read('.github/dependabot.yml')).toMatch(/dependency-name:\s*"@types\/node"[\s\S]*?version-update:semver-major/);
	});
});
