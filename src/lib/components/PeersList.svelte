<script lang="ts">
	import { formatPrice } from '#lib/prices';
	import type { Peer } from '#lib/source-data';

	let { peers, message, hrefFor }: { peers: Peer[]; message: string | null; hrefFor: (symbol: string) => string } = $props();
</script>

{#if peers.length > 0}
	<p class="meta">Comparable companies according to FMP. Open one to see its ratios.</p>
	<ul class="peers">
		{#each peers as peer (peer.symbol)}
			<li>
				<a href={hrefFor(peer.symbol)}>{peer.symbol}</a>
				{#if peer.name}<span>{peer.name}</span>{/if}
				{#if peer.price !== null}<span class="meta">{formatPrice(peer.price)}</span>{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p>{message}</p>
{/if}

<style>
	.meta { margin: 0 0 var(--space-1); color: var(--text-secondary); font-size: var(--text-sm); }
	.peers { padding: 0; list-style: none; }
	.peers li { display: flex; gap: var(--space-3); align-items: baseline; padding: var(--space-2) 0; border-bottom: 1px solid var(--border-subtle); }
</style>
