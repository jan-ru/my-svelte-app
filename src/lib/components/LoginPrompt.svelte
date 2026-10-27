<script lang="ts">
	import type { Snippet } from 'svelte';

	let { from, children }: { from: string; children: Snippet } = $props();
</script>

<p class="login-prompt" role="note"><a href={`/financials?from=${encodeURIComponent(from)}`}>Log in</a> {@render children()}</p>

<style>
	.login-prompt { margin: var(--space-4) 0; padding: var(--space-3) var(--space-4); color: var(--text-secondary); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }
</style>
