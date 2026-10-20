<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { parseMinderCode } from '$lib/due';
	import { money } from '$lib/format';
	import { untrack } from 'svelte';

	let { data, form } = $props();
	const ex = $derived(data.existing);
	const v = (k: string) => form?.values?.[k];

	// Form state is seeded once from the loaded record / failed submission.
	const init = untrack(() => ({ form, data, ex: data.existing }));
	let checked = $state<Set<number>>(new Set(init.form?.itemIds ?? init.data.preselected));
	let minderCode = $state(init.form?.values?.minderCode ?? init.ex?.record.minderCode ?? '');
	let other = $state<{ description: string; cost: string }[]>(
		init.form?.other?.map((o) => ({ description: o.description, cost: o.costCents ? String(o.costCents / 100) : '' })) ??
			init.ex?.lines
				.filter((l) => !l.maintenanceItemId)
				.map((l) => ({ description: l.description ?? '', cost: l.costCents ? String(l.costCents / 100) : '' })) ??
			[]
	);

	function toggle(id: number) {
		const next = new Set(checked);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		checked = next;
	}

	function applyMinder() {
		const codes = parseMinderCode(minderCode);
		if (!codes) return;
		const next = new Set(checked);
		for (const { item } of [...data.items, ...data.moreItems])
			if (item.minderCode && codes.includes(item.minderCode)) next.add(item.id);
		checked = next;
	}

	const moreChecked = $derived(data.moreItems.filter((i) => checked.has(i.item.id)).length);
	// Open "More items" when something inside is pre-checked; never close it on the user.
	let moreOpen = $state(untrack(() => moreChecked > 0));
	$effect(() => {
		if (moreChecked > 0) moreOpen = true;
	});
</script>

{#snippet itemCheck({ item, due }: (typeof data.items)[number])}
	<li>
		<label class="flex cursor-pointer items-center gap-3 py-2.5 font-normal">
			<input type="checkbox" name="items" value={item.id} checked={checked.has(item.id)} onchange={() => toggle(item.id)} />
			<span class="flex-1 text-base text-slate-900 dark:text-slate-100">
				{item.name}{#if item.minderCode}<span class="muted ml-1 text-xs">({item.minderCode})</span>{/if}
			</span>
			{#if due.status !== 'ok'}<StatusBadge status={due.status} />{/if}
		</label>
	</li>
{/snippet}

<svelte:head><title>Log service · {data.vehicle.nickname} · Auto</title></svelte:head>

<a href="/vehicles/{data.vehicle.id}" class="link text-sm">← {data.vehicle.nickname}</a>
<h1 class="mt-1 mb-4 text-2xl font-bold">{ex ? 'Edit service' : 'Log service'}</h1>

<form method="POST" class="space-y-4">
	{#if ex}<input type="hidden" name="recordId" value={ex.record.id} />{/if}
	<div class="card grid grid-cols-2 gap-3">
		<div>
			<label for="serviceDate">Date</label>
			<input id="serviceDate" name="serviceDate" type="date" value={v('serviceDate') ?? ex?.record.serviceDate ?? data.today} max={data.today} required />
			{#if form?.errors?.serviceDate}<p class="field-error">{form.errors.serviceDate}</p>{/if}
		</div>
		<div>
			<label for="mileage">Odometer</label>
			<input id="mileage" name="mileage" inputmode="numeric" placeholder="~{data.estimate.mileage.toLocaleString()}" value={v('mileage') ?? ex?.record.mileage ?? ''} required />
			{#if form?.errors?.mileage}<p class="field-error">{form.errors.mileage}</p>{/if}
		</div>
		<div class="col-span-2 sm:col-span-1">
			<label for="vendor">Where</label>
			<input id="vendor" name="vendor" list="vendors" placeholder="DIY, dealer, shop name…" value={v('vendor') ?? ex?.record.vendor ?? ''} />
			<datalist id="vendors">{#each data.vendors as name (name)}<option value={name}></option>{/each}</datalist>
		</div>
		{#if data.vehicle.maintenanceMinder}
			<div class="col-span-2 sm:col-span-1">
				<label for="minderCode">Minder code shown</label>
				<input id="minderCode" name="minderCode" placeholder="e.g. B13" autocapitalize="characters" bind:value={minderCode} oninput={applyMinder} />
			</div>
		{/if}
	</div>

	<div class="card">
		<h2 class="mb-2 font-semibold">What was done</h2>
		{#if form?.errors?.items}<p class="field-error mb-2">{form.errors.items}</p>{/if}
		<ul class="divide-y divide-slate-200 dark:divide-slate-800">
			{#each data.items as row (row.item.id)}{@render itemCheck(row)}{/each}
		</ul>
		{#if data.moreItems.length}
			<details class="mt-2" bind:open={moreOpen}>
				<summary class="link cursor-pointer text-sm">
					More items ({data.moreItems.length}){moreChecked ? ` · ${moreChecked} checked` : ''}
				</summary>
				<ul class="divide-y divide-slate-200 dark:divide-slate-800">
					{#each data.moreItems as row (row.item.id)}{@render itemCheck(row)}{/each}
				</ul>
			</details>
		{/if}

		<h3 class="mt-4 mb-2 text-sm font-semibold">Other work (repairs, parts, not on the schedule)</h3>
		{#each other as line, i (i)}
			<div class="mb-2 flex gap-2">
				<input name="otherDescription" placeholder="e.g. Replaced wiper motor" bind:value={line.description} />
				<input name="otherCost" class="max-w-28" inputmode="decimal" placeholder="$" bind:value={line.cost} />
				<button type="button" class="btn-secondary px-3" aria-label="Remove" onclick={() => other.splice(i, 1)}>✕</button>
			</div>
		{/each}
		{#if form?.errors?.other}<p class="field-error">{form.errors.other}</p>{/if}
		<button type="button" class="link text-sm" onclick={() => other.push({ description: '', cost: '' })}>+ Add other work</button>
	</div>

	<div class="card grid gap-3 sm:grid-cols-3">
		<div>
			<label for="totalCost">Total cost</label>
			<input id="totalCost" name="totalCost" inputmode="decimal" placeholder="$0.00" value={v('totalCost') ?? (ex?.record.totalCostCents != null ? (ex.record.totalCostCents / 100).toFixed(2) : '')} />
			{#if form?.errors?.totalCost}<p class="field-error">{form.errors.totalCost}</p>{/if}
		</div>
		<div class="sm:col-span-2">
			<label for="notes">Notes</label>
			<textarea id="notes" name="notes" rows="2" placeholder="Oil brand/weight, part numbers, anything worth remembering">{v('notes') ?? ex?.record.notes ?? ''}</textarea>
		</div>
	</div>

	<button class="btn-primary w-full sm:w-auto">{ex ? 'Save changes' : 'Save service'}</button>
	{#if ex && ex.record.totalCostCents}<span class="muted ml-2 text-sm">was {money(ex.record.totalCostCents)}</span>{/if}
</form>
