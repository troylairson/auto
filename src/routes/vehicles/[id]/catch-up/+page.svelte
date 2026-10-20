<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';

	let { data, form } = $props();

	type Mode = 'unknown' | 'never' | 'done';
	const initial = (i: (typeof data.items)[number]): Mode =>
		i.neverDone ? 'never' : i.baselineDate || i.baselineMileage !== null ? 'done' : 'unknown';
	let modes = $state<Record<number, Mode>>(
		untrack(() => Object.fromEntries(data.items.map((i) => [i.id, initial(i)])))
	);
</script>

<svelte:head><title>Catch up · {data.vehicle.nickname} · Auto</title></svelte:head>

<a href="/vehicles/{data.vehicle.id}" class="link text-sm">← {data.vehicle.nickname}</a>
<h1 class="mt-1 text-2xl font-bold">When was each item last done?</h1>
<p class="muted mb-4">
	{#if page.url.searchParams.has('new')}Vehicle added. {/if}Fill in what you know from receipts or memory; rough dates are fine.
	<strong>Never</strong> means not since the vehicle was new. Leave anything unsure as <strong>Don't know</strong>: it will
	show up as "do now" so you can set a fresh starting point. Items with logged service use that instead.
</p>

{#if form?.errors}
	<div class="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
		{#each Object.values(form.errors) as e, i (i)}<div>{e}</div>{/each}
	</div>
{/if}

<form method="POST" class="space-y-3">
	{#each data.items as item (item.id)}
		<fieldset class="card">
			<legend class="sr-only">{item.name}</legend>
			<div class="mb-2 flex items-center justify-between gap-2">
				<span class="font-medium">{item.name}</span>
				{#if item.hasRecord}<span class="muted text-xs">has service records</span>{/if}
			</div>
			<div class="flex flex-wrap gap-4 text-sm">
				{#each [['done', 'Last done'], ['never', 'Never'], ['unknown', "Don't know"]] as [value, label] (value)}
					<span class="flex items-center gap-1.5">
						<input
							type="radio"
							id="mode_{item.id}_{value}"
							name="mode_{item.id}"
							{value}
							checked={modes[item.id] === value}
							onchange={() => (modes[item.id] = value as Mode)}
						/>
						<label for="mode_{item.id}_{value}" class="font-normal">{label}</label>
					</span>
				{/each}
			</div>
			{#if modes[item.id] === 'done'}
				<div class="mt-3 grid grid-cols-2 gap-3">
					<div>
						<label for="date_{item.id}">Date</label>
						<input id="date_{item.id}" name="date_{item.id}" type="date" value={item.baselineDate ?? ''} />
					</div>
					<div>
						<label for="miles_{item.id}">Mileage</label>
						<input id="miles_{item.id}" name="miles_{item.id}" inputmode="numeric" value={item.baselineMileage ?? ''} />
					</div>
				</div>
			{/if}
		</fieldset>
	{/each}
	<button class="btn-primary w-full sm:w-auto">Save</button>
</form>
