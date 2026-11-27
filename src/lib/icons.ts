/** The icons of the app: stroke paths on a 16px grid, drawn in `currentColor` so they follow the text colour. */
export const ICONS = {
	close: 'M4 4l8 8M12 4l-8 8',
	external: 'M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5',
	up: 'M8 13V3M4 7l4-4 4 4',
	down: 'M8 3v10M4 9l4 4 4-4',
	locked: 'M3.5 7.5h9v6h-9zM5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5',
	settings:
		'M8 3.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM8 6.25a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 1 0 0-3.5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.42 1.42M11.18 11.18l1.42 1.42M3.4 12.6l1.42-1.42M11.18 4.82l1.42-1.42'
} as const;

export type IconName = keyof typeof ICONS;
