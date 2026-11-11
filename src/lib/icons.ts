/** The icons of the app: stroke paths on a 16px grid, drawn in `currentColor` so they follow the text colour. */
export const ICONS = {
	close: 'M4 4l8 8M12 4l-8 8',
	external: 'M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5',
	up: 'M8 13V3M4 7l4-4 4 4',
	down: 'M8 3v10M4 9l4 4 4-4'
} as const;

export type IconName = keyof typeof ICONS;
