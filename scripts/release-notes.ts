// Prints the CHANGELOG.md section of a release: its GitHub release notes, word for word (RELEASING.md).
//
//   node scripts/release-notes.ts 2026.11.29 > notes.md
import fs from 'node:fs';
import { releaseNotes } from '../src/lib/overview/changelog.ts';

const version = process.argv[2];
if (!version) {
	console.error('usage: node scripts/release-notes.ts <YYYY.0M.0D>');
	process.exit(2);
}
process.stdout.write(releaseNotes(fs.readFileSync('CHANGELOG.md', 'utf8'), version));
