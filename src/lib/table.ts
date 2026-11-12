/** A formatted table cell that shows a negative number: a leading minus sign (hyphen or the real minus) or a bracket. */
export const isNegative = (cell: string): boolean => /^[-\u2212(]\s*\d/.test(cell.trim());

export interface Column {
	readonly label: string;
	/** A second line under the label, such as a date. */
	readonly sub?: string;
	/** Right-aligned, in the number font. */
	readonly numeric?: boolean;
	/** A forecast: the header and every cell of the column are shaded and in italics. */
	readonly forecast?: boolean;
}

export interface Row {
	readonly key: string;
	readonly label: string;
	/** Smaller text after the label, such as a company name beside its ticker. */
	readonly sub?: string;
	/** Makes the label a link: an internal path, or a URL that passed `safeUrl`. */
	readonly href?: string;
	/** One formatted cell per column. */
	readonly cells: readonly string[];
	/** Shown instead of the cells, in one cell across every column: a row with nothing to report. */
	readonly note?: string;
	/** A totals or statistics row: bold, with a heavier line above it. */
	readonly summary?: boolean;
}
