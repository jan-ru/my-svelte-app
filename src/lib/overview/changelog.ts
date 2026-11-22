// src/lib/overview/changelog.ts
// The release sections of CHANGELOG.md: the GitHub release notes and the overview's release history. Pure.
import { at } from '../at.ts';

/** One `## [YYYY.0M.0D] — YYYY-MM-DD` section. */
export interface ReleaseSection {
	readonly version: string;
	readonly date: string;
	/** The opening paragraph: the PR count and the through-line. */
	readonly lead: string;
	/** Everything under the heading, trimmed. */
	readonly body: string;
}

const HEADING = /^## \[(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)\] — (\d{4}-\d{2}-\d{2})$/;

/** The release sections, in file order (newest first). `## [Unreleased]` is left out. */
export function parseChangelog(text: string): readonly ReleaseSection[] {
	return text.split(/^(?=## )/m).flatMap((chunk) => {
		const [first = '', ...rest] = chunk.split('\n');
		if (!first.startsWith('## [') || first.startsWith('## [Unreleased]')) return [];
		const match = HEADING.exec(first);
		if (!match) throw new Error(`CHANGELOG.md: a release heading reads "## [YYYY.0M.0D] — YYYY-MM-DD", not "${first}"`);
		const body = rest.join('\n').trim();
		return [{ version: at(match, 1), date: at(match, 2), lead: body.split(/\n\s*\n/)[0] ?? '', body }];
	});
}

/** The notes of one release: its section body, word for word. */
export function releaseNotes(text: string, version: string): string {
	const section = parseChangelog(text).find((s) => s.version === version);
	if (!section) throw new Error(`CHANGELOG.md has no section for ${version}`);
	return `${section.body}\n`;
}

/** The PR numbers of squash-merge subjects (`feat: x (#154)`), each once, in order. */
export function prNumbers(subjects: readonly string[]): readonly number[] {
	const numbers = subjects.flatMap((subject) => {
		const match = /\(#(\d+)\)$/.exec(subject.trim());
		return match ? [Number(at(match, 1))] : [];
	});
	return [...new Set(numbers)];
}

/** One row of the release history. */
export interface HistoryRow {
	readonly version: string;
	readonly date: string;
	readonly lead: string;
}

/** The release history, oldest first. */
export function historyRows(sections: readonly ReleaseSection[]): readonly HistoryRow[] {
	return [...sections].reverse().map((s) => ({ version: s.version, date: s.date, lead: s.lead }));
}
