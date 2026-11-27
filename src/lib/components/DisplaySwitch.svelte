<script lang="ts">
	// Chart or table, as SAP's segmented button. Links, not buttons, so it works without JavaScript and each choice is a
	// URL that can be bookmarked; the rest of the query is kept.
	import { displayHref, type Display } from '#lib/params';

	let { display, search }: { display: Display; search: string } = $props();

	const options: readonly { readonly id: Display; readonly label: string }[] = [
		{ id: 'chart', label: 'Chart' },
		{ id: 'table', label: 'Table' }
	];
</script>

<nav class="switch" aria-label="Show as">
	{#each options as option (option.id)}
		<a
			href={displayHref(search, option.id)}
			aria-current={display === option.id ? 'true' : undefined}
			data-sveltekit-replacestate
			data-sveltekit-noscroll>{option.label}</a
		>
	{/each}
</nav>

<style>
	.switch {
		display: inline-flex;
		margin: var(--space-2) 0;
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0 var(--space-4);
		font-size: var(--text-sm);
		color: var(--color-primary);
		text-decoration: none;
	}
	a + a {
		border-left: 1px solid var(--color-primary);
	}
	a:hover {
		background: var(--surface-group);
	}
	a[aria-current='true'] {
		color: var(--surface-card);
		background: var(--color-primary);
	}
</style>
