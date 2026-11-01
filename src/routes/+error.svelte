<script lang="ts">
	import { page } from '$app/state';
	import { errorView } from '#lib/error-view';
	import ErrorMessage from '#lib/components/ErrorMessage.svelte';

	const view = $derived(errorView(page.status, page.error?.message ?? '', page.error?.errorId));
</script>

<svelte:head>
	<title>{view.title} – Fetch valuation multiples</title>
</svelte:head>

<ErrorMessage status={page.status} {view} />
