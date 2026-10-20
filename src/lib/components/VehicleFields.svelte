<script lang="ts">
	let {
		values = {},
		errors = {},
		users
	}: {
		values?: Record<string, string | number | null>;
		errors?: Record<string, string>;
		users: { id: number; name: string }[];
	} = $props();

	const v = (k: string) => (values[k] ?? '') as string;
</script>

<div class="grid gap-4 sm:grid-cols-2">
	<div class="sm:col-span-2">
		<label for="nickname">Nickname</label>
		<input id="nickname" name="nickname" placeholder="e.g. Pilot, Tacoma" value={v('nickname')} required />
		{#if errors.nickname}<p class="field-error">{errors.nickname}</p>{/if}
	</div>
	<div>
		<label for="year">Year</label>
		<input id="year" name="year" inputmode="numeric" value={v('year')} required />
		{#if errors.year}<p class="field-error">{errors.year}</p>{/if}
	</div>
	<div>
		<label for="make">Make</label>
		<input id="make" name="make" value={v('make')} required />
		{#if errors.make}<p class="field-error">{errors.make}</p>{/if}
	</div>
	<div>
		<label for="model">Model</label>
		<input id="model" name="model" value={v('model')} required />
		{#if errors.model}<p class="field-error">{errors.model}</p>{/if}
	</div>
	<div>
		<label for="trim">Trim</label>
		<input id="trim" name="trim" value={v('trim')} />
	</div>
	<div>
		<label for="fuelType">Fuel</label>
		<select id="fuelType" name="fuelType" value={v('fuelType') || 'gas'}>
			<option value="gas">Gasoline</option>
			<option value="diesel">Diesel</option>
			<option value="hybrid">Hybrid</option>
			<option value="ev">Electric</option>
		</select>
	</div>
	<div>
		<label for="drivetrain">Drivetrain</label>
		<select id="drivetrain" name="drivetrain" value={v('drivetrain')}>
			<option value="">—</option>
			<option value="2wd">2WD</option>
			<option value="4wd">4WD / 4x4</option>
			<option value="awd">AWD</option>
		</select>
	</div>
	<div>
		<label for="transmission">Transmission</label>
		<input id="transmission" name="transmission" placeholder="e.g. 9-speed automatic" value={v('transmission')} />
	</div>
	<div>
		<label for="usageProfile">Usage</label>
		<select id="usageProfile" name="usageProfile" value={v('usageProfile') || 'normal'}>
			<option value="normal">Normal</option>
			<option value="severe">Severe (towing, off-road, short trips)</option>
		</select>
	</div>
	<div>
		<label for="inServiceDate">In-service / purchase date</label>
		<input id="inServiceDate" name="inServiceDate" type="date" value={v('inServiceDate')} />
		{#if errors.inServiceDate}<p class="field-error">{errors.inServiceDate}</p>{/if}
	</div>
	<div>
		<label for="milesPerYear">Typical miles per year</label>
		<input id="milesPerYear" name="milesPerYear" inputmode="numeric" value={v('milesPerYear') || '12000'} />
		{#if errors.milesPerYear}<p class="field-error">{errors.milesPerYear}</p>{/if}
	</div>
	<div>
		<label for="primaryDriverId">Primary driver (gets reminders)</label>
		<select id="primaryDriverId" name="primaryDriverId" value={String(values.primaryDriverId ?? '')}>
			<option value="">Everyone</option>
			{#each users as u (u.id)}<option value={String(u.id)}>{u.name}</option>{/each}
		</select>
	</div>
	<div>
		<label for="vin">VIN</label>
		<input id="vin" name="vin" autocapitalize="characters" value={v('vin')} />
	</div>
	<div>
		<label for="licensePlate">License plate</label>
		<input id="licensePlate" name="licensePlate" autocapitalize="characters" value={v('licensePlate')} />
	</div>
	<div class="sm:col-span-2">
		<label for="notes">Notes</label>
		<textarea id="notes" name="notes" rows="2">{v('notes')}</textarea>
	</div>
</div>
