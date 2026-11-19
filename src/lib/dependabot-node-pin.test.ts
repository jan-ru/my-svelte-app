import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Dependabot's share of the Node LTS pin (see node-pin.test.ts). A file of its own because .github/dependabot.yml
// exists only in the private repository: .public-exclude leaves this test out of the public snapshots with it.
const root = path.join(import.meta.dirname, '../..');

describe('Node LTS pin', () => {
	it('keeps Dependabot from proposing a newer @types/node major', () => {
		expect(fs.readFileSync(path.join(root, '.github/dependabot.yml'), 'utf8')).toMatch(
			/dependency-name:\s*"@types\/node"[\s\S]*?version-update:semver-major/
		);
	});
});
