/** What the error page says for a status; pure, so the page and its test share it. */
export interface ErrorView {
	readonly title: string;
	readonly detail: string;
	/** Quoted to the visitor so a log line can be found again; only unexpected errors have one. */
	readonly reference: string | null;
}

const TITLES: Readonly<Record<number, string>> = {
	400: 'Bad request',
	401: 'Log in needed',
	403: 'Not allowed',
	404: 'Page not found',
	413: 'Too large',
	429: 'Too many requests',
	503: 'Not available'
};

export function errorView(status: number, message: string, errorId?: string): ErrorView {
	const server = status >= 500;
	return {
		title: TITLES[status] ?? (server ? 'Something went wrong' : 'Request not handled'),
		detail: status === 404 ? 'There is no page at this address.' : message || 'The request could not be completed.',
		reference: errorId ?? null
	};
}
