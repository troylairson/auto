<script lang="ts">
	import '../app.css';
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>Auto</title>
</svelte:head>

<main class="mx-auto max-w-xl px-4 pt-5 {data.user ? 'pb-32' : 'pb-10'}">
	{@render children()}
</main>

{#if data.user}
	<BottomNav />
{/if}
