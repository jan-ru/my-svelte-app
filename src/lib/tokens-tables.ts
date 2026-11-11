// The data tables behind the Horizon build: which themes and groups are written, which existing names read a Horizon
// token (`ALIASES`, `ADOPTED`) and the layout grid. Data only, no logic, so a change here is a one-line review.

export interface Theme {
	readonly slug: string;
	readonly name: string;
	readonly selector: string;
}

/** The four Horizon themes. Morning is the default; the others wait for the theme switcher. */
export const THEMES: readonly Theme[] = [
	{ slug: 'morning', name: 'Morning Horizon', selector: ':root' },
	{ slug: 'evening', name: 'Evening Horizon', selector: ":root[data-theme='evening']" },
	{ slug: 'high-contrast-white', name: 'High Contrast White', selector: ":root[data-theme='high-contrast-white']" },
	{ slug: 'high-contrast-black', name: 'High Contrast Black', selector: ":root[data-theme='high-contrast-black']" }
];

/** The top-level groups of the export that are written out. Adding a group is one line here. */
export const GROUPS: readonly string[] = [
	'Main',
	'Interaction',
	'Application',
	'Text',
	'Button',
	'Input',
	'List',
	'Shell',
	'Tile',
	'Link',
	'Semantic',
	'Focus',
	'Chart',
	'Font',
	'Shadow',
	'Container'
];

export interface Alias {
	/** The existing custom property that components use. */
	readonly name: string;
	/** The Horizon token (its key) that now supplies the value. */
	readonly token: string;
	/** The value the name had before, in lowercase hex. The build fails when Horizon Morning no longer equals it. */
	readonly was: string;
}

/**
 * The existing names whose value is exactly a Horizon Morning token. Names with no exact match (`--positive`,
 * `--negative`, `--grey-01`, `--blue-05`, ...) stay in tokens.css, so no page changes colour.
 */
export const ALIASES: readonly Alias[] = [
	{ name: '--color-primary', token: 'sapHighlightColor', was: '#0064d9' },
	{ name: '--text-secondary', token: 'sapContent_LabelColor', was: '#556b82' },
	{ name: '--surface-group', token: 'sapBackgroundColor', was: '#f5f6f7' },
	{ name: '--surface-card', token: 'sapGroup_ContentBackground', was: '#ffffff' },
	{ name: '--surface-hover', token: 'sapHoverColor', was: '#eaecee' },
	{ name: '--surface-shell', token: 'sapShellColor', was: '#ffffff' },
	{ name: '--border-subtle', token: 'sapGroup_ContentBorderColor', was: '#d9d9d9' },
	{ name: '--critical', token: 'sapCriticalColor', was: '#e76500' },
	{ name: '--information', token: 'sapInformativeColor', was: '#0070f2' },
	// Spacing: the four steps of our 4px scale that equal Horizon's (8, 16, 32 and 48px) exactly. 4px, 12px and 24px
	// have no Horizon step and stay in tokens.css.
	{ name: '--space-2', token: 'sapContent_Space_Tiny', was: '0.5rem' },
	{ name: '--space-4', token: 'sapContent_Space_Small', was: '1rem' },
	{ name: '--space-8', token: 'sapContent_Space_Medium', was: '2rem' },
	{ name: '--space-12', token: 'sapContent_Space_Large', was: '3rem' }
];

export interface Adoption {
	/** The existing custom property that components use. */
	readonly name: string;
	/** The Horizon token (its key) that now supplies the value. */
	readonly token: string;
}

/** Names that take Horizon's value on purpose, so they look different. Nothing checks an old value. */
export const ADOPTED: readonly Adoption[] = [
	{ name: '--shadow-1', token: 'sapContent_Shadow0' },
	{ name: '--shadow-2', token: 'sapContent_Shadow1' },
	{ name: '--shadow-3', token: 'sapContent_Shadow2' },
	{ name: '--shadow-4', token: 'sapContent_Shadow3' },
	// Focus: Horizon's focus colour (a darker blue than our #0070f2) and 2px width.
	{ name: '--border-focus', token: 'sapContent_FocusColor' },
	{ name: '--focus-ring', token: 'sapContent_FocusWidth' }
];

export interface GridSize {
	readonly size: 'S' | 'M' | 'L' | 'XL';
	readonly columns: number;
	/** px */
	readonly margin: number;
	/** px */
	readonly gutter: number;
}

/**
 * The Horizon layout guides ("Grid: S (Application)", M, L, XL on the Grid page of SAP Fiori for Web UI Kit
 * (Community)). Figma does not export layout guides, so these were read by hand: re-read them when the kit changes.
 * "Grid: S (Home)" is not used (it differs only in an 8px margin). The sizes switch at the `--sapBreakpoint_*_Min`
 * tokens.
 */
export const GRID = [
	{ size: 'S', columns: 4, margin: 16, gutter: 8 },
	{ size: 'M', columns: 8, margin: 32, gutter: 16 },
	{ size: 'L', columns: 12, margin: 32, gutter: 16 },
	{ size: 'XL', columns: 16, margin: 48, gutter: 16 }
] as const satisfies readonly GridSize[];
