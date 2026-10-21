<script lang="ts">
	let { data, form } = $props();
	const v = (k: string) => form?.values?.[k];
</script>

<svelte:head><title>Mileage · {data.vehicle.nickname} · Auto</title></svelte:head>

<a href="/vehicles/{data.vehicle.id}" class="link text-sm">← {data.vehicle.nickname}</a>
<h1 class="mt-1 mb-4 text-[26px] font-bold tracking-tight">Update mileage</h1>

<form method="POST" class="card mx-auto max-w-md space-y-4">
	<div>
		<label for="mileage">Odometer</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input id="mileage" name="mileage" inputmode="numeric" autofocus placeholder="~{data.estimate.mileage.toLocaleString()}" value={v('mileage') ?? ''} required class="num !py-3 !text-4xl font-semibold" />
		{#if form?.errors?.mileage}<p class="field-error">{form.errors.mileage}</p>{/if}
	</div>
	{#if data.vehicle.maintenanceMinder}
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="oilLifePct">Oil life %</label>
				<input id="oilLifePct" name="oilLifePct" inputmode="numeric" placeholder="optional" value={v('oilLifePct') ?? ''} />
				{#if form?.errors?.oilLifePct}<p class="field-error">{form.errors.oilLifePct}</p>{/if}
			</div>
			<div>
				<label for="minderCode">Minder code</label>
				<input id="minderCode" name="minderCode" placeholder="if shown, e.g. B13" autocapitalize="characters" value={v('minderCode') ?? ''} />
				{#if form?.errors?.minderCode}<p class="field-error">{form.errors.minderCode}</p>{/if}
			</div>
		</div>
		<p class="text-muted text-sm">Oil life % and codes come from the dash. Entering them lets the app follow the car's own schedule.</p>
	{/if}
	<div>
		<label for="readingDate">Date</label>
		<input id="readingDate" name="readingDate" type="date" value={v('readingDate') ?? data.today} max={data.today} />
	</div>
	<button class="btn-primary min-h-12 w-full text-base">Save</button>
</form>
