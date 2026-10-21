<script lang="ts">
	import { formatDate } from '$lib/dates';
	import { miles, money } from '$lib/format';

	let { data } = $props();
	const r = $derived(data.record);
</script>

<svelte:head><title>Service {r.serviceDate} · {data.vehicle.nickname} · Auto</title></svelte:head>

<a href="/vehicles/{data.vehicle.id}?tab=history" class="link text-sm">← {data.vehicle.nickname} history</a>
<h1 class="mt-1 text-[26px] font-bold tracking-tight">{formatDate(r.serviceDate)}</h1>
<p class="text-muted mb-4">
	{miles(r.mileage)}{r.vendor ? ` · ${r.vendor}` : ''}{r.minderCode ? ` · Minder ${r.minderCode}` : ''}
	{data.createdBy ? ` · logged by ${data.createdBy}` : ''}
</p>

<div class="card space-y-3">
	<ul class="space-y-1">
		{#each data.lines as line (line.id)}
			<li class="flex justify-between gap-3">
				<span>{line.itemName ?? line.description ?? 'Removed item'}{line.maintenanceItemId ? '' : ' (other)'}</span>
				<span>{money(line.costCents)}</span>
			</li>
		{/each}
	</ul>
	{#if r.totalCostCents !== null}
		<div class="flex justify-between border-t border-line pt-2 font-semibold">
			<span>Total</span><span>{money(r.totalCostCents)}</span>
		</div>
	{/if}
	{#if r.notes}<p class="whitespace-pre-line">{r.notes}</p>{/if}
</div>

<div class="mt-4 flex gap-2">
	<a href="/vehicles/{data.vehicle.id}/log?record={r.id}" class="btn-secondary">Edit</a>
	<form method="POST" action="?/delete">
		<button class="btn-danger" onclick={(e) => { if (!confirm('Delete this service record?')) e.preventDefault(); }}>Delete</button>
	</form>
</div>
