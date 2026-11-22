// src/lib/overview/curated.ts
// The hand-written parts of the release overview: docs/overview.md (and the health table of docs/quality/README.md).
// Found by heading and by table header, and refused when missing, so an edit that breaks the PDF fails npm test. Pure.

/** The text under `## <heading>`, up to the next `## `, trimmed; throws when the heading is missing. */
export function sectionBody(markdown: string, heading: string, file: string): string {
	const chunk = markdown.split(/^(?=## )/m).find((c) => c.split('\n')[0]?.trim() === `## ${heading}`);
	if (chunk === undefined) throw new Error(`${file} has no "## ${heading}"`);
	return chunk.split('\n').slice(1).join('\n').trim();
}

const firstParagraph = (body: string): string =>
	body
		.split(/\n\s*\n/)
		.find((block) => !/^(\||```|#|>)/.test(block.trim()))
		?.trim() ?? '';

const cells = (line: string): readonly string[] =>
	line
		.trim()
		.replace(/^\||\|$/g, '')
		.split('|')
		.map((cell) => cell.trim());

/** The rows of the table whose header row is `header`, without the header and separator. */
function table(body: string, header: readonly string[], file: string): readonly (readonly string[])[] {
	const lines = body.split('\n');
	const start = lines.findIndex((line) => line.trim().startsWith('|') && cells(line).join('|') === header.join('|'));
	if (start < 0) throw new Error(`${file} has no table "| ${header.join(' | ')} |"`);
	const rest = lines.slice(start + 2);
	const end = rest.findIndex((line) => !line.trim().startsWith('|'));
	return (end < 0 ? rest : rest.slice(0, end)).map(cells);
}

/** A release-history row from before the first release. */
export interface EarlyRelease {
	readonly when: string;
	readonly theme: string;
}

/** The curated parts of docs/overview.md. Markdown strings are rendered as they are. */
export interface Curated {
	/** §1, whole: the sentence, the mermaid diagrams, the layers and the principles. */
	readonly design: string;
	readonly intros: {
		readonly decisions: string;
		readonly history: string;
		readonly quality: string;
		readonly roadmap: string;
	};
	readonly earlyHistory: readonly EarlyRelease[];
	/** The roadmap's Later column, by lane name. */
	readonly later: Readonly<Record<string, string>>;
}

const FILE = 'docs/overview.md';

/** Reads the curated parts; throws naming the first that is missing. */
export function parseOverview(markdown: string): Curated {
	const section = (heading: string): string => sectionBody(markdown, heading, FILE);
	const history = section('3. Release history');
	const roadmap = section('5. Roadmap');
	return {
		design: section('1. The design at a glance'),
		intros: {
			decisions: firstParagraph(section('2. Design decisions')),
			history: firstParagraph(history),
			quality: firstParagraph(section('4. Quality review')),
			roadmap: firstParagraph(roadmap)
		},
		earlyHistory: table(history, ['When', 'Theme'], FILE).map(([when = '', theme = '']) => ({ when, theme })),
		later: Object.fromEntries(table(roadmap, ['Lane', 'Later'], FILE).map(([lane = '', later = '']) => [lane, later]))
	};
}
