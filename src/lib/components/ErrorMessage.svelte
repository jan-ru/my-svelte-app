<script lang="ts">
	import type { ErrorView } from '../error-view';

	let { status, view }: { status: number; view: ErrorView } = $props();
</script>

<main>
	<p class="status">Error {status}</p>
	<h1>{view.title}</h1>
	<p>{view.detail}</p>
	{#if view.reference}
		<p class="reference">Reference: <code>{view.reference}</code></p>
	{/if}
	<p><a href="/">Back to the multiples</a></p>
</main>

<style>
	.status {
		margin-bottom: 0;
		color: var(--text-secondary);
	}
	.reference {
		color: var(--text-secondary);
	}
</style>
