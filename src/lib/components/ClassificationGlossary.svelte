<script lang="ts">
	// What the classification abbreviations stand for, on the /classification page. Static text, no props.
</script>

<details class="glossary">
	<summary>What the abbreviations mean</summary>
	<dl>
		<dt>SBI</dt>
		<dd>
			Standaard Bedrijfsindeling (Dutch Standard Industrial Classification). SBI 2025 is the current version; SBI 2008
			is the previous one.
		</dd>
		<dt>CBS</dt>
		<dd>Centraal Bureau voor de Statistiek (Statistics Netherlands), which maintains the SBI.</dd>
		<dt>NACE</dt>
		<dd>
			Nomenclature statistique des activités économiques dans la Communauté européenne (the EU statistical
			classification of economic activities). Rev. 2.1 is the newest revision; the first four digits of SBI 2025 follow
			it. Rev. 2 matches SBI 2008.
		</dd>
		<dt>ISIC</dt>
		<dd>
			International Standard Industrial Classification of All Economic Activities, published by the United Nations. Rev.
			4 is the version NACE Rev. 2 is built on.
		</dd>
		<dt>NAICS</dt>
		<dd>
			North American Industry Classification System, the US, Canadian and Mexican classification. The 2002 edition is
			the one with a published link to SIC.
		</dd>
		<dt>SIC</dt>
		<dd>
			Standard Industrial Classification, the older US system (1987 edition) that the NYU Stern company list uses.
		</dd>
		<dt>NYU Stern</dt>
		<dd>
			The business school of New York University, where Aswath Damodaran publishes the industry data this app uses.
			“Damodaran industries” are his 94 industry groups.
		</dd>
		<dt>UN</dt>
		<dd>United Nations (Statistics Division), which publishes the ISIC and the ISIC–NAICS correspondence tables.</dd>
		<dt>Rev.</dt>
		<dd>Revision, the numbered edition of a classification.</dd>
	</dl>
</details>

<style>
	.glossary {
		margin: var(--space-4) 0;
		padding: var(--space-3) var(--space-4);
		background: var(--surface-card);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
	}
	summary {
		font-weight: var(--weight-semibold);
		color: var(--text-primary);
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
	}
	dt {
		font-weight: var(--weight-semibold);
	}
	dd {
		margin: 0;
	}
</style>
