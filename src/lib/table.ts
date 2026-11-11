/** A formatted table cell that shows a negative number: a leading minus sign (hyphen or the real minus) or a bracket. */
export const isNegative = (cell: string): boolean => /^[-\u2212(]\s*\d/.test(cell.trim());

export interface Column {
	readonly label: string;
	/** A second line under the label, such as a date. */
	readonly sub?: string;
	/** Right-aligned, in the number font. */
	readonly numeric?: boolean;
}

export interface Row {
	readonly key: string;
	readonly label: string;
	/** One formatted cell per column. */
	readonly cells: readonly string[];
}
