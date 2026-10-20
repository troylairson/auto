<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import DueSummary from '$lib/components/DueSummary.svelte';
	import { miles } from '$lib/format';

	let { data } = $props();
	const unknownCount = $derived(data.upNext.filter((i) => i.due.status === 'unknown').length);
	const actionable = $derived(data.upNext.filter((i) => i.due.status !== 'unknown'));
</script>

<svelte:head><title>Auto</title></svelte:head>

{#if data.vehicles.length === 0}
	<div class="card mt-6 text-center">
		<h1 class="mb-2 text-xl font-bold">No vehicles yet</h1>
		<p class="muted mb-4">Add a vehicle to get its maintenance schedule.</p>
		<a href="/vehicles/new" class="btn-primary">Add a vehicle</a>
	</div>
{:else}
	<section class="grid gap-3 sm:grid-cols-2">
		{#each data.vehicles as v (v.vehicle.id)}
			<div class="card flex flex-col gap-3">
				<a href="/vehicles/{v.vehicle.id}" class="block">
					<div class="flex items-start justify-between gap-2">
						<div>
							<h2 class="text-lg font-bold">{v.vehicle.nickname}</h2>
							<p class="muted text-sm">{v.vehicle.year} {v.vehicle.make} {v.vehicle.model}</p>
						</div>
						<div class="text-right">
							<div class="font-semibold tabular-nums">~{miles(v.estimate.mileage)}</div>
							{#if v.estimate.stale}<div class="text-xs text-orange-600 dark:text-orange-400">mileage is stale</div>{/if}
						</div>
					</div>
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#if v.counts.overdue}<span class="text-sm"><StatusBadge status="overdue" /> {v.counts.overdue}</span>{/if}
						{#if v.counts.due}<span class="text-sm"><StatusBadge status="due" /> {v.counts.due}</span>{/if}
						{#if v.counts.soon}<span class="text-sm"><StatusBadge status="soon" /> {v.counts.soon}</span>{/if}
						{#if v.counts.unknown}<span class="text-sm"><StatusBadge status="unknown" /> {v.counts.unknown}</span>{/if}
						{#if !v.counts.overdue && !v.counts.due && !v.counts.soon && !v.counts.unknown}
							<span class="text-sm"><StatusBadge status="ok" /> All caught up</span>
						{/if}
					</div>
				</a>
				<div class="mt-auto flex gap-2">
					<a href="/vehicles/{v.vehicle.id}/log" class="btn-primary flex-1">Log service</a>
					<a href="/vehicles/{v.vehicle.id}/mileage" class="btn-secondary flex-1">Update mileage</a>
				</div>
			</div>
		{/each}
	</section>

	<section class="mt-6">
		<h2 class="mb-2 text-lg font-bold">Up next</h2>
		{#if actionable.length === 0}
			<p class="card muted">Nothing due in the next 30 days.</p>
		{:else}
			<ul class="card divide-y divide-slate-200 p-0 dark:divide-slate-800">
				{#each actionable as row (row.item.id)}
					<li>
						<a href="/vehicles/{row.vehicle.id}/log?items={row.item.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
							<div class="min-w-0 flex-1">
								<div class="font-medium">{row.item.name}</div>
								<div class="text-sm"><span class="font-medium">{row.vehicle.nickname}</span> · <DueSummary due={row.due} /></div>
							</div>
							<StatusBadge status={row.due.status} />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		{#if unknownCount}
			<p class="muted mt-3 text-sm">
				{unknownCount} item{unknownCount === 1 ? ' has' : 's have'} no history yet. Open a vehicle and use
				<span class="font-medium">Catch up</span> to fill in when they were last done.
			</p>
		{/if}
	</section>

	<div class="mt-6 text-center">
		<a href="/vehicles/new" class="link text-sm">+ Add a vehicle</a>
	</div>
{/if}
