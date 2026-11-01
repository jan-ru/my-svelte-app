<script lang="ts">
	// The forward chain from one SBI 2025 code to the Damodaran industries, on the /classification page.
	import { formatShare, type Item, type Trace } from '#lib/crosswalk';

	let { trace }: { trace: Trace } = $props();

	const steps: readonly {
		readonly key: 'nace21' | 'nace2' | 'isic4' | 'isic31' | 'naics' | 'sic';
		readonly label: string;
		readonly note: string;
	}[] = [
		{ key: 'nace21', label: 'NACE Rev. 2.1', note: 'The first four digits of SBI 2025 are NACE Rev. 2.1.' },
		{ key: 'nace2', label: 'NACE Rev. 2 (= SBI 2008)', note: 'Via the CBS conversion table SBI 2025 to SBI 2008.' },
		{
			key: 'isic4',
			label: 'ISIC Rev. 4',
			note: 'A NACE Rev. 2 class is an ISIC Rev. 4 class or a subdivision of one.'
		},
		{ key: 'isic31', label: 'ISIC Rev. 3.1', note: 'Via the UN correspondence table ISIC Rev. 4 to Rev. 3.1.' },
		{ key: 'naics', label: 'NAICS 2002 (US)', note: 'Via the UN correspondence table ISIC Rev. 3.1 to NAICS 2002.' },
		{ key: 'sic', label: 'SIC 1987 (US)', note: 'Via the US Census table NAICS 2002 to SIC 1987.' }
	];
</script>

<section aria-labelledby="start">
	<h2 id="start">SBI 2025 <code>{trace.start.code}</code>: {trace.start.title}</h2>

	{#each steps as step (step.key)}
		{@const items: readonly Item[] = trace[step.key]}
		<details open={step.key === 'sic' ? false : items.length <= 12}>
			<summary>{step.label} <span class="count">({items.length})</span></summary>
			<p class="note">{step.note}</p>
			{#if items.length === 0}
				<p>No match in the correspondence table.</p>
			{:else}
				<ul>
					{#each items as item (item.code)}
						<li>
							{#if step.key === 'sic'}<a href={`/companies?sic=${item.code}`}><code>{item.code}</code></a>{:else}<code
									>{item.code}</code
								>{/if}{item.title ? ` ${item.title}` : ''}
						</li>
					{/each}
				</ul>
			{/if}
		</details>
	{/each}

	<h3>Damodaran industries</h3>
	{#if trace.damodaran.length === 0}
		<p>No companies in the NYU list share these SIC codes.</p>
	{:else}
		<table>
			<thead
				><tr
					><th scope="col">Industry</th><th scope="col" class="num">Companies</th><th scope="col" class="num">Share</th
					></tr
				></thead
			>
			<tbody>
				{#each trace.damodaran as m (m.industry)}
					<tr>
						<th scope="row"><a href={`/?i=${encodeURIComponent(m.industry)}`}>{m.industry}</a></th>
						<td class="num">{Math.round(m.companies).toLocaleString('en')}</td>
						<td class="num">{formatShare(m.share)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	details {
		margin: var(--space-2) 0;
	}
	summary {
		font-weight: var(--weight-semibold);
		color: var(--text-primary);
	}
	.count,
	.note {
		color: var(--text-secondary);
		font-weight: var(--weight-regular);
	}
	table {
		width: 100%;
		font-size: var(--text-sm);
		background: var(--surface-card);
	}
	.num {
		text-align: right;
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
</style>
