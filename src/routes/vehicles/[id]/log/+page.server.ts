import { fail, redirect } from '@sveltejs/kit';
import { todayLocal } from '$lib/dates';
import { FormReader, formValues } from '$lib/server/forms';
import { getRecord, saveRecord } from '$lib/server/records';
import { getOverview, getVehicle, pastVendors } from '$lib/server/vehicles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const vehicle = getVehicle(Number(params.id));
	const today = todayLocal();
	const overview = getOverview(vehicle, today);
	const recordId = Number(url.searchParams.get('record')) || null;
	const existing = recordId ? getRecord(vehicle.id, recordId) : null;
	const preselected = existing
		? existing.lines.filter((l) => l.maintenanceItemId).map((l) => l.maintenanceItemId!)
		: (url.searchParams.get('items') ?? '').split(',').map(Number).filter(Boolean);
	return {
		vehicle,
		today,
		estimate: overview.estimate,
		items: overview.items,
		vendors: pastVendors(),
		preselected,
		existing
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const vehicle = getVehicle(Number(params.id));
		const data = await request.formData();
		const f = new FormReader(data);
		const recordId = f.int('recordId');
		const serviceDate = f.date('serviceDate', { required: true, label: 'Date' });
		const mileage = f.int('mileage', { required: true, label: 'Mileage', min: 0 });
		const itemIds = f.ints('items');
		const descriptions = data.getAll('otherDescription').map((v) => String(v).trim());
		const costs = data.getAll('otherCost').map((v) => String(v).replace(/[$,\s]/g, ''));
		const other = descriptions
			.map((description, i) => ({
				description,
				costCents: costs[i] ? Math.round(Number(costs[i]) * 100) : null
			}))
			.filter((o) => o.description);
		if (other.some((o) => o.costCents !== null && !Number.isFinite(o.costCents)))
			f.errors.other = 'Other work costs must be amounts like 49.99.';
		if (itemIds.length === 0 && other.length === 0)
			f.errors.items = 'Check at least one item or describe the work done.';
		const totalCostCents = f.cents('totalCost', 'Total cost');
		if (!f.ok) return fail(400, { errors: f.errors, values: formValues(data), itemIds, other });

		if (recordId) getRecord(vehicle.id, recordId); // 404s if it belongs elsewhere
		saveRecord(
			{
				vehicleId: vehicle.id,
				serviceDate: serviceDate!,
				mileage: mileage!,
				vendor: f.str('vendor'),
				totalCostCents,
				minderCode: f.str('minderCode')?.toUpperCase() ?? null,
				notes: f.str('notes'),
				itemIds,
				other,
				userId: locals.user!.id
			},
			recordId ?? undefined
		);
		redirect(303, `/vehicles/${vehicle.id}${recordId ? '?tab=history' : ''}`);
	}
};
