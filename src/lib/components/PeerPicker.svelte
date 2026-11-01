<script lang="ts">
	import type { Peer } from '#lib/source-data';
	import type { PeerRow } from '#lib/valuation-data';

	let { picked, suggestions, max }: { picked: readonly PeerRow[]; suggestions: readonly Peer[]; max: number } =
		$props();
	const full = $derived(picked.length >= max);
</script>

<!-- Part of the page's GET form: every ticked box and the text field become `peer` parameters. -->
<fieldset class="peers">
	<legend>Peers <span class="count">{picked.length} of {max}</span></legend>
	{#if picked.length > 0}
		<div class="chips">
			{#each picked as p (p.symbol)}
				<label class="chip picked">
					<input type="checkbox" name="peer" value={p.symbol} checked />
					{p.symbol}{#if p.name !== p.symbol}
						<span class="name">{p.name}</span>{/if}
				</label>
			{/each}
		</div>
	{:else}
		<p class="hint">No peers picked yet. Tick FMP's suggestions or type tickers.</p>
	{/if}
	{#if suggestions.length > 0}
		<p class="hint">Suggested by FMP:</p>
		<div class="chips">
			{#each suggestions as s (s.symbol)}
				<label class="chip suggestion">
					<input type="checkbox" name="peer" value={s.symbol} disabled={full} />
					{s.symbol}{#if s.name}
						<span class="name">{s.name}</span>{/if}
				</label>
			{/each}
		</div>
	{/if}
	<label class="add">
		Add tickers
		<input name="peer" placeholder="ASML, BESI.AS" maxlength="120" autocomplete="off" disabled={full} />
	</label>
</fieldset>

<style>
	.peers {
		margin: var(--space-3) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	.count,
	.hint,
	.name {
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: var(--space-2) 0;
	}
	.chip {
		display: inline-flex;
		gap: var(--space-1);
		align-items: center;
		padding: 2px var(--space-3);
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		font-size: var(--text-sm);
	}
	.picked {
		font-weight: var(--weight-semibold);
		border-color: var(--color-primary);
	}
	.suggestion {
		color: var(--text-secondary);
	}
	.add {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-top: var(--space-2);
	}
</style>
