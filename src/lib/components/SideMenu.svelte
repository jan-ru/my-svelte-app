<script lang="ts">
	let { label, items }: { label: string; items: { href: string; label: string; current: boolean }[] } = $props();
</script>

<nav class="side" aria-label={label}>
	<ul>
		{#each items as item (item.href)}
			<li><a href={item.href} aria-current={item.current ? 'page' : undefined}>{item.label}</a></li>
		{/each}
	</ul>
</nav>

<style>
	.side {
		padding: var(--space-2) 0;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	a {
		display: block;
		padding: 6px 14px;
		color: inherit;
		text-decoration: none;
		border-left: 3px solid transparent;
	}
	a:hover {
		background: var(--surface-hover);
	}
	a[aria-current='page'] {
		font-weight: var(--weight-semibold);
		color: var(--blue-80);
		background: var(--blue-05);
		border-left-color: var(--color-primary);
	}
</style>
