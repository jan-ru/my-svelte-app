// Publishes a snapshot of this private repository's main to the public repository, as a pull request there.
//
// The public repository receives the current tree of main minus the paths listed in .public-exclude, as one new
// commit on top of its own main. Private history, commit messages and excluded files never leave this repository.
// The public main is protected (a PR and a passing `test` check), so the snapshot arrives as a PR that the public
// repository's CI checks before it is merged.
//
// Run from a clean main that is pushed to origin:
//   node scripts/publish-public.ts            # push the snapshot branch and open the PR
//   node scripts/publish-public.ts --dry-run  # build and commit the snapshot locally, show what changes, push nothing
//
// Expects the remote `public` to point at jan-ru/my-svelte-app, and `gh` to be logged in. See RELEASING.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PUBLIC_REMOTE = 'public';
const PUBLIC_REPO = 'jan-ru/my-svelte-app';
const EXCLUDE_FILE = '.public-exclude';

class PublishError extends Error {}

function git(args: string[], cwd?: string): string {
	return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function readExcludes(root: string): string[] {
	const lines = fs
		.readFileSync(path.join(root, EXCLUDE_FILE), 'utf8')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '' && !line.startsWith('#'));
	if (lines.length === 0) throw new PublishError(`${EXCLUDE_FILE} lists no paths`);
	return lines;
}

function checkSource(): string {
	if (git(['branch', '--show-current']) !== 'main') throw new PublishError('run this on main');
	if (git(['status', '--porcelain']) !== '') throw new PublishError('the working tree has uncommitted changes');
	git(['fetch', '--quiet', 'origin', 'main']);
	const source = git(['rev-parse', 'HEAD']);
	if (source !== git(['rev-parse', 'origin/main'])) {
		throw new PublishError('main differs from origin/main; push or pull first');
	}
	return source;
}

/** Builds the snapshot commit in `dir` (a worktree on the public main). Returns false when nothing changes. */
function buildSnapshot(dir: string, source: string, excludes: string[]): boolean {
	// Make the index and the files match the private tree exactly, including deletions...
	git(['read-tree', '-u', '--reset', source], dir);
	// ...then drop what must stay private, which also removes it from the public tree if it is there today. --force
	// because an excluded file that differs from the public main is staged by the read-tree, and git rm refuses those.
	git(['rm', '-r', '-q', '--force', '--ignore-unmatch', '--', ...excludes], dir);
	const left = git(['ls-files', '--', ...excludes], dir);
	if (left !== '') throw new PublishError(`excluded paths are still in the snapshot:\n${left}`);
	const stat = git(['diff', '--cached', '--stat'], dir);
	if (stat === '') return false;
	console.log(stat);
	git(['commit', '--quiet', '--no-verify', '-m', `Snapshot of the private repository at ${source.slice(0, 7)}`], dir);
	return true;
}

function openPullRequest(dir: string, branch: string, short: string): void {
	git(['push', '--quiet', PUBLIC_REMOTE, `${branch}:${branch}`], dir);
	const body = [
		`A snapshot of the private working repository at \`${short}\`, published by \`scripts/publish-public.ts\`.`,
		'',
		'Merge once `test` is green.'
	].join('\n');
	const url = execFileSync(
		'gh',
		[
			'pr',
			'create',
			'--repo',
			PUBLIC_REPO,
			'--base',
			'main',
			'--head',
			branch,
			'--title',
			`Snapshot ${short}`,
			'--body',
			body
		],
		{ encoding: 'utf8' }
	).trim();
	console.log(`publish-public: opened ${url}`);
}

function main(): void {
	const dryRun = process.argv.includes('--dry-run');
	const root = git(['rev-parse', '--show-toplevel']);
	const excludes = readExcludes(root);
	const source = checkSource();
	git(['fetch', '--quiet', PUBLIC_REMOTE, 'main']);

	const short = source.slice(0, 7);
	const branch = `snapshot/${short}`;
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-public-'));
	git(['worktree', 'add', '--quiet', '-b', branch, dir, `${PUBLIC_REMOTE}/main`]);
	try {
		if (!buildSnapshot(dir, source, excludes)) {
			console.log('publish-public: the public repository already has this tree; nothing to publish');
		} else if (dryRun) {
			console.log(`publish-public: dry run; the snapshot was committed locally and discarded, nothing pushed`);
		} else {
			openPullRequest(dir, branch, short);
		}
	} finally {
		git(['worktree', 'remove', '--force', dir]);
		git(['branch', '-D', '--quiet', branch]);
	}
}

try {
	main();
} catch (error) {
	console.error(`publish-public: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}
