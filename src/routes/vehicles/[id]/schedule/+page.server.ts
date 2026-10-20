import { fail } from '@sveltejs/kit';
import { eq, max } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { maintenanceItems } from '$lib/server/db/schema';
import { FormReader } from '$lib/server/forms';
import { getItem, getItems, getVehicle, resetItemToTemplate } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const vehicle = getVehicle(Number(params.id));
	return { vehicle, items: getItems(vehicle.id) };
};

function readItem(f: FormReader) {
	const value = {
		name: f.str('name', { required: true, label: 'Name' }) ?? '',
		category: f.str('category') ?? 'Other',
		intervalMiles: f.int('intervalMiles', { label: 'Miles', min: 1 }),
		intervalMonths: f.int('intervalMonths', { label: 'Months', min: 1 }),
		firstDueMiles: f.int('firstDueMiles', { label: 'First due miles', min: 1 }),
		firstDueMonths: f.int('firstDueMonths', { label: 'First due months', min: 1 }),
		minderCode: f.str('minderCode')?.toUpperCase() ?? null,
		notes: f.str('notes')
	};
	if (!value.intervalMiles && !value.intervalMonths)
		f.errors.intervalMiles = 'Give a mileage interval, a time interval, or both.';
	return value;
}

export const actions: Actions = {
	save: async ({ params, request }) => {
		const data = await request.formData();
		const item = getItem(Number(params.id), Number(data.get('itemId')));
		const f = new FormReader(data);
		const value = readItem(f);
		if (!f.ok) return fail(400, { itemId: item.id, errors: f.errors });
		db.update(maintenanceItems)
			.set({ ...value, enabled: f.bool('enabled'), verified: f.bool('verified'), core: f.bool('core') })
			.where(eq(maintenanceItems.id, item.id))
			.run();
		return { savedId: item.id };
	},
	reset: async ({ params, request }) => {
		const vehicle = getVehicle(Number(params.id));
		const item = getItem(vehicle.id, Number((await request.formData()).get('itemId')));
		resetItemToTemplate(item, vehicle);
		return { savedId: item.id };
	},
	remove: async ({ params, request }) => {
		const item = getItem(Number(params.id), Number((await request.formData()).get('itemId')));
		db.delete(maintenanceItems).where(eq(maintenanceItems.id, item.id)).run();
	},
	add: async ({ params, request }) => {
		const vehicle = getVehicle(Number(params.id));
		const f = new FormReader(await request.formData());
		const value = readItem(f);
		if (!f.ok) return fail(400, { itemId: 'new', errors: f.errors });
		const order = db
			.select({ m: max(maintenanceItems.sortOrder) })
			.from(maintenanceItems)
			.where(eq(maintenanceItems.vehicleId, vehicle.id))
			.get();
		db.insert(maintenanceItems)
			.values({ ...value, vehicleId: vehicle.id, sortOrder: (order?.m ?? 0) + 1, verified: true })
			.run();
		return { added: true };
	}
};
