<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Log service · Auto</title></svelte:head>

<h1 class="mb-1 text-[28px] font-bold tracking-tight">Log service</h1>
<p class="mb-4 text-muted">Which vehicle?</p>

{#if data.vehicles.length === 0}
	<p class="card text-muted">Add a vehicle first. <a href="/vehicles/new" class="link">Add a vehicle</a></p>
{:else}
	<div class="flex flex-col gap-3">
		{#each data.vehicles as v (v.id)}
			<a href="/vehicles/{v.id}/log" class="card flex min-h-16 items-center justify-between hover:border-warn-line">
				<span class="flex flex-col">
					<span class="text-lg font-bold">{v.nickname}</span>
					<span class="text-sm text-muted">{v.label}</span>
				</span>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
			</a>
		{/each}
	</div>
{/if}
