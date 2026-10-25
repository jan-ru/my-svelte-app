<svelte:head>
	<title>About – Fetch valuation multiples</title>
	<meta name="description" content="What this app does and where its valuation multiples come from." />
</svelte:head>

<main>
	<h1>About</h1>

	<p>
		This app fetches valuation multiples, such as EV/EBITDA and P/E, from the NYU Stern
		database, so they can be used when valuing a company against its industry peers.
	</p>

	<h2>Data source</h2>
	<p>
		The multiples are published by the
		<a href="https://pages.stern.nyu.edu/~adamodar/" rel="noreferrer">NYU Stern School of Business</a>.
		The app only reads this data and does not change it. Check the source for the date and
		methodology of each dataset before relying on a figure.
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
		padding: 0 1rem 2rem;
		line-height: 1.6;
	}

	h1 {
		color: #ff3e00;
		font-weight: 300;
	}

	h2 {
		margin-top: 2rem;
		font-size: 1.2rem;
	}

	.logo {
		display: block;
		height: 2.5rem;
		width: auto;
		margin-top: 1rem;
	}
</style>
