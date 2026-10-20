import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { todayLocal } from '$lib/dates';
import { db } from '$lib/server/db';
import { users, vehicles } from '$lib/server/db/schema';
import { readVehicleForm } from '$lib/server/vehicle-form';
import { getVehicle } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => ({
	vehicle: getVehicle(Number(params.id)),
	users: db.select({ id: users.id, name: users.name }).from(users).all()
});

export const actions: Actions = {
	save: async ({ params, request }) => {
		const v = getVehicle(Number(params.id));
		const { f, value, values } = readVehicleForm(await request.formData());
		if (!f.ok) return fail(400, { errors: f.errors, values });
		db.update(vehicles).set(value).where(eq(vehicles.id, v.id)).run();
		redirect(303, `/vehicles/${v.id}?tab=info`);
	},
	archive: ({ params }) => {
		const v = getVehicle(Number(params.id));
		db.update(vehicles)
			.set({ archivedAt: v.archivedAt ? null : todayLocal() })
			.where(eq(vehicles.id, v.id))
			.run();
		redirect(303, v.archivedAt ? `/vehicles/${v.id}` : '/');
	},
	delete: async ({ params, request }) => {
		const v = getVehicle(Number(params.id));
		const confirm = String((await request.formData()).get('confirm') ?? '');
		if (confirm.trim().toLowerCase() !== v.nickname.toLowerCase())
			return fail(400, { deleteError: `Type "${v.nickname}" to confirm.` });
		db.delete(vehicles).where(eq(vehicles.id, v.id)).run();
		redirect(303, '/');
	}
};
