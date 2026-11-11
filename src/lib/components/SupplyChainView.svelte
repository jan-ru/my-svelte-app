<script lang="ts">
	import { describeSupplyChain, formatCorrelation, relationship } from '#lib/supply-chain';
	import type { SupplyChain } from '#lib/source-data';

	let {
		chain,
		message,
		hrefFor
	}: { chain: SupplyChain | null; message: string | null; hrefFor: (symbol: string) => string | null } = $props();
</script>

<p class="test" role="note">
	<strong>Test.</strong> This tab is an experiment to see whether Eulerpool's supply chain data is useful. It may change or
	be removed.
</p>
{#if chain}
	<p class="summary">{describeSupplyChain(chain)}</p>
	<p class="meta">
		Treat this as a list of leads, not a verified supply chain. It holds genuine suppliers and customers next to
		unrelated companies, leaves some real ones out, and gives no size for any relationship. It is listed by name. The
		correlations show how closely the share prices have moved together, from −1 to 1; they say nothing about how large
		or real a relationship is. Companies outside the US are covered thinly.
	</p>
	<div class="scroll">
		<table>
			<caption class="sr-only">Companies linked to the one shown, as supplier, customer or both</caption>
			<thead>
				<tr>
					<th scope="col">Company</th>
					<th scope="col">Relationship</th>
					<th scope="col">Country</th>
					<th scope="col">Industry</th>
					<th scope="col" class="num">Correlation, 1 year</th>
					<th scope="col" class="num">Correlation, 3 months</th>
				</tr>
			</thead>
			<tbody>
				{#each chain.links as link (link.symbol)}
					{@const href = hrefFor(link.symbol)}
					<tr>
						<th scope="row">
							{#if href}<a {href}>{link.name}</a>{:else}{link.name}{/if}
							<small>{link.symbol}</small>
						</th>
						<td>{relationship(link)}</td>
						<td>{link.country ?? 'n/a'}</td>
						<td>{link.industry ?? 'n/a'}</td>
						<td class="num">{formatCorrelation(link.correlation1y)}</td>
						<td class="num">{formatCorrelation(link.correlation3m)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p>{message}</p>
{/if}

<style>
	.test {
		margin: 0 0 var(--space-3);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-subtle);
		border-left-width: 4px;
		border-radius: var(--radius-md);
		background: var(--surface-card);
		font-size: var(--text-sm);
	}
	.summary {
		margin: 0 0 var(--space-1);
	}
	.meta {
		margin: 0 0 var(--space-3);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.scroll {
		overflow-x: auto;
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	table {
		width: 100%;
		font-size: var(--text-sm);
	}
	th[scope='row'] {
		text-align: left;
		font-weight: var(--weight-regular);
	}
	small {
		margin-left: var(--space-1);
		color: var(--text-secondary);
	}
	.num {
		text-align: right;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
