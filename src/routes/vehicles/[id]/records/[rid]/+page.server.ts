import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { deleteRecord, getRecord } from '$lib/server/records';
import { getVehicle } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const vehicle = getVehicle(Number(params.id));
	const { record, lines } = getRecord(vehicle.id, Number(params.rid));
	const by = record.createdBy
		? db.select({ name: users.name }).from(users).where(eq(users.id, record.createdBy)).get()
		: null;
	return { vehicle, record, lines, createdBy: by?.name ?? null };
};

export const actions: Actions = {
	delete: ({ params }) => {
		const vehicle = getVehicle(Number(params.id));
		const { record } = getRecord(vehicle.id, Number(params.rid));
		deleteRecord(record.id);
		redirect(303, `/vehicles/${vehicle.id}?tab=history`);
	}
};
