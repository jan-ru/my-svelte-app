<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import LoginForm from '#lib/components/LoginForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Log in – Fetch valuation multiples</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>Log in</h1>
	<LoginForm configured={data.configured} from={data.from} message={form?.message} />
</main>

<style>
	main {
		max-width: 32rem;
	}
</style>
