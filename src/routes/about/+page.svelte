<svelte:head>
	<title>About – Fetch valuation multiples</title>
	<meta name="description" content="What this app does and where its valuation multiples come from." />
</svelte:head>

<main>
	<h1>About</h1>

	<p>
		This app helps value a company against its industry peers. It brings together valuation multiples, industry
		classifications, a company list and company financials.
	</p>

	<h2>Pages</h2>
	<dl>
		<dt><a href="/">Multiples</a></dt>
		<dd>Valuation multiples, such as EV/EBITDA and P/E, by industry and region.</dd>
	</dl>
	<h3>Explore</h3>
	<dl>
		<dt><a href="/countries">Countries</a></dt>
		<dd>How large each country is as a share of the global total: number of listed companies, or GDP.</dd>
		<dt><a href="/industries">Industries</a></dt>
		<dd>How large each industry is as a share of all listed companies, grouped by sector.</dd>
		<dt><a href="/companies">Companies</a></dt>
		<dd>The listed companies in each industry, with their SIC code and country.</dd>
		<dt><a href="/classification">Find industry</a></dt>
		<dd>From a Dutch SBI 2025 code to the matching NYU Stern industries, and back.</dd>
	</dl>
	<h3>Financials</h3>
	<dl>
		<dt><a href="/financials">Financials</a></dt>
		<dd>Profile, news, prices and financial statements of one company. Needs a login.</dd>
	</dl>

	<h2>Data sources</h2>
	<ul>
		<li>
			<a href="https://pages.stern.nyu.edu/~adamodar/" rel="noreferrer">NYU Stern School of Business</a> (Aswath Damodaran):
			industry multiples and the company list.
		</li>
		<li>CBS, UN Statistics Division and US Census Bureau: the classification tables.</li>
		<li>World Bank: GDP (current US$), licensed CC BY 4.0.</li>
		<li>Financial Modeling Prep and Yahoo Finance: company financials and prices.</li>
	</ul>
	<p>
		The app only reads this data and does not change it. Check each source for the date, methodology and licence terms
		before relying on a figure.
	</p>
	<img class="logo" src="/nyu_stern.svg" alt="NYU Stern School of Business" />

	<h2>Status</h2>
	<p>
		The app is under development. The code is open source on
		<a href="https://github.com/jan-ru/my-svelte-app" rel="noreferrer">GitHub</a>.
	</p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 0 var(--space-4) var(--space-8);
		line-height: 1.6;
	}
	h2 {
		margin-top: var(--space-8);
		font-size: var(--text-lg);
	}
	h3 {
		margin: var(--space-4) 0 0;
		font-size: var(--text-md);
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2) var(--space-4);
	}
	dt {
		font-weight: var(--weight-semibold);
	}
	dd {
		margin: 0;
	}
	.logo {
		display: block;
		height: 2.5rem;
		width: auto;
		margin-top: var(--space-4);
	}
</style>
