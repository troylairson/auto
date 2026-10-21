<script lang="ts">
	import { enhance } from '$app/forms';
	import { interval } from '$lib/format';

	let { data, form } = $props();
	let open = $state<number | 'new' | null>(null);
	const errorsFor = (id: number | 'new') => (form && 'itemId' in form && form.itemId === id ? form.errors : null);
</script>

<svelte:head><title>Schedule · {data.vehicle.nickname} · Auto</title></svelte:head>

<a href="/vehicles/{data.vehicle.id}" class="link text-sm">← {data.vehicle.nickname}</a>
<h1 class="mt-1 text-[26px] font-bold tracking-tight">Edit schedule</h1>
<p class="text-muted mb-4 text-sm">
	Check each item against the owner's manual and tick <strong>Verified</strong>. <strong>Usual</strong> items are
	always shown; the rest stay under "More items" until they come due. "First due" overrides the interval
	for the first service only (e.g. coolant first at 100k, then every 50k).
	{#if data.vehicle.maintenanceMinder}The Minder code links an item to the code shown on the dash (A, B, 1–7).{/if}
</p>

{#snippet fields(item: Partial<(typeof data.items)[number]>, id: number | 'new')}
	{@const errors = errorsFor(id)}
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="col-span-2">
			<label for="name-{id}">Name</label>
			<input id="name-{id}" name="name" value={item.name ?? ''} required />
		</div>
		<div>
			<label for="category-{id}">Category</label>
			<input id="category-{id}" name="category" value={item.category ?? ''} />
		</div>
		<div>
			<label for="minder-{id}">Minder code</label>
			<input id="minder-{id}" name="minderCode" value={item.minderCode ?? ''} maxlength="1" />
		</div>
		<div>
			<label for="miles-{id}">Every (miles)</label>
			<input id="miles-{id}" name="intervalMiles" inputmode="numeric" value={item.intervalMiles ?? ''} />
		</div>
		<div>
			<label for="months-{id}">Every (months)</label>
			<input id="months-{id}" name="intervalMonths" inputmode="numeric" value={item.intervalMonths ?? ''} />
		</div>
		<div>
			<label for="fmiles-{id}">First due (miles)</label>
			<input id="fmiles-{id}" name="firstDueMiles" inputmode="numeric" value={item.firstDueMiles ?? ''} />
		</div>
		<div>
			<label for="fmonths-{id}">First due (months)</label>
			<input id="fmonths-{id}" name="firstDueMonths" inputmode="numeric" value={item.firstDueMonths ?? ''} />
		</div>
		<div class="col-span-2 sm:col-span-4">
			<label for="notes-{id}">Notes</label>
			<textarea id="notes-{id}" name="notes" rows="2">{item.notes ?? ''}</textarea>
		</div>
	</div>
	{#if errors}
		{#each Object.values(errors) as e, i (i)}<p class="field-error">{e}</p>{/each}
	{/if}
{/snippet}

<ul class="space-y-2">
	{#each data.items as item (item.id)}
		<li class="card {item.enabled ? '' : 'opacity-60'}">
			<button type="button" class="flex w-full items-center justify-between gap-3 text-left" onclick={() => (open = open === item.id ? null : item.id)}>
				<div>
					<div class="font-medium">{item.name}{item.minderCode ? ` (${item.minderCode})` : ''}</div>
					<div class="text-muted text-sm">
						{interval(item.intervalMiles, item.intervalMonths)}{item.enabled ? '' : ' · disabled'}{item.core ? '' : ' · more'}{item.verified ? ' · ✓ verified' : ''}
					</div>
				</div>
				<span class="text-muted text-sm">{open === item.id ? 'Close' : 'Edit'}</span>
			</button>
			{#if form && 'savedId' in form && form.savedId === item.id && open !== item.id}
				<p class="mt-1 text-sm text-ok-text">Saved.</p>
			{/if}
			{#if open === item.id || errorsFor(item.id)}
				<form method="POST" action="?/save" class="mt-4 space-y-3" use:enhance={() => async ({ update, result }) => { await update({ reset: false }); if (result.type === 'success') open = null; }}>
					<input type="hidden" name="itemId" value={item.id} />
					{@render fields(item, item.id)}
					<div class="flex flex-wrap items-center gap-4">
						<span class="flex items-center gap-2"><input type="checkbox" id="enabled-{item.id}" name="enabled" checked={item.enabled} /><label for="enabled-{item.id}">Enabled</label></span>
						<span class="flex items-center gap-2"><input type="checkbox" id="verified-{item.id}" name="verified" checked={item.verified} /><label for="verified-{item.id}">Verified</label></span>
						<span class="flex items-center gap-2"><input type="checkbox" id="core-{item.id}" name="core" checked={item.core} /><label for="core-{item.id}">Usual (always shown)</label></span>
					</div>
					<div class="flex flex-wrap gap-2">
						<button class="btn-primary">Save</button>
						{#if item.templateItemId}
							<button class="btn-secondary" formaction="?/reset">Reset to template</button>
						{:else}
							<button class="btn-danger" formaction="?/remove" onclick={(e) => { if (!confirm(`Delete "${item.name}"? Its service history entries stay, unlinked.`)) e.preventDefault(); }}>Delete</button>
						{/if}
					</div>
				</form>
			{/if}
		</li>
	{/each}
</ul>

<div class="card mt-4">
	{#if open === 'new' || errorsFor('new')}
		<h2 class="mb-3 font-semibold">Add custom item</h2>
		<form method="POST" action="?/add" class="space-y-3" use:enhance={() => async ({ update, result }) => { await update(); if (result.type === 'success') open = null; }}>
			{@render fields({}, 'new')}
			<div class="flex gap-2">
				<button class="btn-primary">Add</button>
				<button type="button" class="btn-secondary" onclick={() => (open = null)}>Cancel</button>
			</div>
		</form>
	{:else}
		<button class="link" onclick={() => (open = 'new')}>+ Add custom item</button>
	{/if}
</div>
