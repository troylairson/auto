<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>Auto</title>
</svelte:head>

{#if data.user}
	<header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
		<nav class="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
			<a href="/" class="flex items-center gap-2 font-bold">
				<img src="/icon.svg" alt="" class="size-7" /> Auto
			</a>
			<div class="ml-auto flex items-center gap-4 text-sm">
				<a href="/" class:font-semibold={page.url.pathname === '/'}>Home</a>
				<a href="/settings" class:font-semibold={page.url.pathname.startsWith('/settings')}>Settings</a>
				<form method="POST" action="/logout">
					<button class="muted hover:underline">Sign out</button>
				</form>
			</div>
		</nav>
	</header>
{/if}

<main class="mx-auto max-w-3xl px-4 py-5 pb-16">
	{@render children()}
</main>
