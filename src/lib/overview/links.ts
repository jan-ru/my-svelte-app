// src/lib/overview/links.ts
// Relative Markdown links point nowhere in a PDF. Before the curated Markdown is rendered, each one is resolved
// against the file it was written in and pointed at that file's version on GitHub, at the release being described.

/** Scheme (`https:`, `mailto:`), anchor or root-relative targets are left as written. */
const ABSOLUTE = /^(?:[a-z][a-z\d+.-]*:|#|\/)/i;

/** `](target)` and `](target "title")` of inline links and images. */
const LINK = /\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;

/**
 * Rewrites the relative links in `markdown`, written in repository file `file`, to absolute URLs under `base`
 * (for example `https://github.com/owner/repo/blob/2026.11.29/`, ending in a slash).
 */
export function absoluteLinks(markdown: string, file: string, base: string): string {
	const from = new URL(file, base);
	return markdown.replace(LINK, (whole, target: string, title: string) =>
		ABSOLUTE.test(target) ? whole : `](${new URL(target, from).href}${title})`
	);
}

/** The base URL of a repository's files at a ref: `<repo url>/blob/<ref>/`. */
export function blobBase(repoUrl: string, ref: string): string {
	return `${repoUrl.replace(/\/+$/, '')}/blob/${encodeURIComponent(ref)}/`;
}
