<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A message set apart from the text: `negative` for an error (announced to screen readers), `critical` for a
	 * caveat the reader must not miss, `info` for a notice. `role` overrides the default, which is `alert` for
	 * `negative` and none otherwise.
	 */
	let {
		variant = 'info',
		role,
		children
	}: { variant?: 'info' | 'negative' | 'critical'; role?: 'alert' | 'note' | 'status'; children: Snippet } = $props();
	const aria = $derived(role ?? (variant === 'negative' ? 'alert' : undefined));
</script>

<div class="callout {variant}" role={aria}>{@render children()}</div>

<style>
	.callout {
		margin: 1em 0;
		padding: var(--space-2) var(--space-3);
		border-left: 4px solid;
		border-radius: var(--radius-sm);
	}
	.info {
		background: var(--information-bg);
		border-color: var(--information-border);
		border-left-color: var(--information);
	}
	.negative {
		color: var(--negative);
		background: var(--negative-bg);
		border-left-color: var(--negative);
	}
	.critical {
		background: var(--critical-bg);
		border-left-color: var(--critical);
	}
</style>
