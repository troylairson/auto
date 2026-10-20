import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { addDays, todayLocal } from '$lib/dates';
import { db } from '$lib/server/db';
import { maintenanceItems, users } from '$lib/server/db/schema';
import { clearNotifications } from '$lib/server/reminders';
import { getItem, getOverview, getReadings, getVehicle, listRecords } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const vehicle = getVehicle(Number(params.id));
	const overview = getOverview(vehicle, todayLocal());
	const records = listRecords(vehicle.id);
	const byYear = new Map<string, number>();
	for (const r of records) {
		const y = r.serviceDate.slice(0, 4);
		byYear.set(y, (byYear.get(y) ?? 0) + (r.totalCostCents ?? 0));
	}
	const driver = vehicle.primaryDriverId
		? db.select({ name: users.name }).from(users).where(eq(users.id, vehicle.primaryDriverId)).get()
		: null;
	return {
		...overview,
		records,
		readings: getReadings(vehicle.id).slice(0, 10),
		spendByYear: [...byYear.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)),
		totalSpend: records.reduce((s, r) => s + (r.totalCostCents ?? 0), 0),
		driver: driver?.name ?? null
	};
};

export const actions: Actions = {
	snooze: async ({ params, request }) => {
		const data = await request.formData();
		const item = getItem(Number(params.id), Number(data.get('itemId')));
		const days = Number(data.get('days'));
		if (![7, 14, 30].includes(days)) return fail(400);
		db.update(maintenanceItems)
			.set({ snoozedUntil: addDays(todayLocal(), days) })
			.where(eq(maintenanceItems.id, item.id))
			.run();
		clearNotifications([item.id]);
	},
	unsnooze: async ({ params, request }) => {
		const data = await request.formData();
		const item = getItem(Number(params.id), Number(data.get('itemId')));
		db.update(maintenanceItems).set({ snoozedUntil: null }).where(eq(maintenanceItems.id, item.id)).run();
	}
};
