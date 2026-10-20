import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { maintenanceItems } from '$lib/server/db/schema';
import { FormReader } from '$lib/server/forms';
import { getItems, getVehicle, lastDoneByItem } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const vehicle = getVehicle(Number(params.id));
	const done = lastDoneByItem(vehicle.id);
	return {
		vehicle,
		items: getItems(vehicle.id)
			.filter((i) => i.enabled)
			.map((i) => ({ ...i, hasRecord: done.has(i.id) }))
	};
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const vehicle = getVehicle(Number(params.id));
		const f = new FormReader(await request.formData());
		const items = getItems(vehicle.id).filter((i) => i.enabled);
		const updates = items.map((item) => {
			const mode = f.oneOf(`mode_${item.id}`, ['unknown', 'never', 'done'] as const, 'unknown');
			const date = f.date(`date_${item.id}`, { label: `${item.name} date` });
			const mileage = f.int(`miles_${item.id}`, { label: `${item.name} mileage`, min: 0 });
			return { item, mode, date, mileage };
		});
		if (!f.ok) return { errors: f.errors };
		db.transaction((tx) => {
			for (const { item, mode, date, mileage } of updates) {
				const done = mode === 'done' && (date !== null || mileage !== null);
				tx.update(maintenanceItems)
					.set({
						neverDone: mode === 'never',
						baselineDate: done ? date : null,
						baselineMileage: done ? mileage : null
					})
					.where(eq(maintenanceItems.id, item.id))
					.run();
			}
		});
		redirect(303, `/vehicles/${vehicle.id}`);
	}
};
