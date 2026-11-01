<script lang="ts">
	import { page } from '$app/state';

	// Static text only, so it never varies the cached pages.
	const sources = [
		{ href: 'https://pages.stern.nyu.edu/~adamodar/', label: 'NYU Stern (Damodaran)' },
		{ href: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD', label: 'World Bank (CC BY 4.0)' },
		{ href: 'https://site.financialmodelingprep.com/', label: 'Financial Modeling Prep' },
		{ href: 'https://finance.yahoo.com/', label: 'Yahoo Finance' }
	];
</script>

<footer>
	<p class="sources">
		Data:
		{#each sources as s, i (s.href)}<a href={s.href} rel="noreferrer">{s.label}</a>{i < sources.length - 1
				? ' · '
				: ''}{/each}
	</p>
	<p class="links">
		<a href="/about">About</a> · <a href="https://github.com/jan-ru/my-svelte-app" rel="noreferrer">GitHub</a>
	</p>
	<p class="notice">
		For information only, not investment advice.
		{#if page.url.pathname === '/financials'}Yahoo Finance data is unofficial and may be delayed.{/if}
	</p>
</footer>

<style>
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2) var(--space-6);
		max-width: 84rem;
		margin: var(--space-12) auto 0;
		padding: var(--space-4);
		color: var(--text-secondary);
		font-size: var(--text-sm);
		border-top: 1px solid var(--border-subtle);
	}
	p {
		margin: 0;
	}
	footer a {
		color: inherit;
		text-decoration: underline;
	}
	footer a:hover {
		color: var(--color-primary);
	}
</style>
