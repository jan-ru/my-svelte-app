// Fails when the repository contains JavaScript source: .js/.mjs/.cjs/.jsx files, or a Svelte <script> without lang="ts".
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const problems: string[] = [];

for (const file of files) {
	if (/\.(js|mjs|cjs|jsx)$/.test(file)) problems.push(`${file}: JavaScript file`);
	if (file.endsWith('.svelte') && fs.existsSync(file)) {
		const source = fs.readFileSync(file, 'utf8');
		for (const tag of source.match(/<script\b[^>]*>/g) ?? []) {
			if (!/lang=["']ts["']/.test(tag)) problems.push(`${file}: ${tag} is missing lang="ts"`);
		}
	}
}

if (problems.length > 0) {
	console.error(`TypeScript only: found JavaScript source\n${problems.map((p) => `  ${p}`).join('\n')}`);
	process.exit(1);
}
console.log(`TypeScript only: ${files.length} tracked files checked, no JavaScript source`);
