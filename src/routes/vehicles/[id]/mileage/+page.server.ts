import { fail, redirect } from '@sveltejs/kit';
import { todayLocal } from '$lib/dates';
import { parseMinderCode } from '$lib/due';
import { db } from '$lib/server/db';
import { odometerReadings } from '$lib/server/db/schema';
import { FormReader, formValues } from '$lib/server/forms';
import { getOverview, getVehicle } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const vehicle = getVehicle(Number(params.id));
	return { vehicle, today: todayLocal(), estimate: getOverview(vehicle, todayLocal()).estimate };
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const vehicle = getVehicle(Number(params.id));
		const data = await request.formData();
		const f = new FormReader(data);
		const readingDate = f.date('readingDate', { required: true, label: 'Date' }) ?? todayLocal();
		const mileage = f.int('mileage', { required: true, label: 'Mileage', min: 0 });
		const oilLifePct = vehicle.maintenanceMinder ? f.int('oilLifePct', { label: 'Oil life', min: 0, max: 100 }) : null;
		const minderCode = vehicle.maintenanceMinder ? (f.str('minderCode')?.toUpperCase() ?? null) : null;
		if (minderCode && !parseMinderCode(minderCode))
			f.errors.minderCode = 'Codes look like A, B, A1, B13…';
		if (!f.ok) return fail(400, { errors: f.errors, values: formValues(data) });
		db.insert(odometerReadings)
			.values({
				vehicleId: vehicle.id,
				readingDate,
				mileage: mileage!,
				oilLifePct,
				minderCode,
				source: 'manual',
				createdBy: locals.user!.id
			})
			.run();
		redirect(303, minderCode ? `/vehicles/${vehicle.id}` : '/');
	}
};
