<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Trend } from '#lib/prices';
	import Icon from './Icon.svelte';

	/** A change in a value: green with an up arrow, red with a down arrow, or plain. The arrow is decoration; the text carries the sign. */
	let { trend, children }: { trend: Trend; children: Snippet } = $props();
</script>

<span class="status {trend}">
	{#if trend !== 'flat'}<Icon name={trend} />{/if}{@render children()}
</span>

<style>
	.up {
		color: var(--positive);
	}
	.down {
		color: var(--negative);
	}
</style>
