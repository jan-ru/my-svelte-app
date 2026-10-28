<script lang="ts">
	import { page } from '$app/state';
	import SideLayout from '#lib/components/SideLayout.svelte';
	import SideMenu from '#lib/components/SideMenu.svelte';
	import { EXPLORE_LINKS } from '#lib/nav';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<SideLayout>
	{#snippet menu()}
		<SideMenu label="Explore" items={EXPLORE_LINKS.map((l) => ({ ...l, current: page.url.pathname === l.href }))} />
	{/snippet}
	{@render children()}
</SideLayout>
