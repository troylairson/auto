import { fail, redirect } from '@sveltejs/kit';
import { todayLocal } from '$lib/dates';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { readVehicleForm } from '$lib/server/vehicle-form';
import { createVehicle, listTemplates } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	templates: listTemplates(),
	users: db.select({ id: users.id, name: users.name }).from(users).all()
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const { f, value, values } = readVehicleForm(data);
		const mileage = f.int('currentMileage', { required: true, label: 'Current mileage', min: 0 });
		const templateId = f.int('templateId', { required: true, label: 'Schedule' });
		if (!f.ok) return fail(400, { errors: f.errors, values });
		const id = createVehicle(value, templateId!, mileage!, todayLocal(), locals.user!.id);
		redirect(303, `/vehicles/${id}/catch-up?new=1`);
	}
};
