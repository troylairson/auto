import { todayLocal } from '$lib/dates';
import { compareDue } from '$lib/due';
import { getOverview, listVehicles } from '$lib/server/vehicles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const today = todayLocal();
	const overviews = listVehicles().map((v) => getOverview(v, today));
	const upNext = overviews
		.flatMap((o) =>
			o.items
				.filter((i) => i.due.status !== 'ok' && i.due.status !== 'snoozed')
				.map((i) => ({ vehicle: { id: o.vehicle.id, nickname: o.vehicle.nickname }, ...i }))
		)
		.sort((a, b) => compareDue(a.due, b.due));
	return {
		today,
		vehicles: overviews.map((o) => ({
			vehicle: o.vehicle,
			estimate: o.estimate,
			counts: {
				overdue: o.items.filter((i) => i.due.status === 'overdue').length,
				due: o.items.filter((i) => i.due.status === 'due').length,
				soon: o.items.filter((i) => i.due.status === 'soon').length,
				unknown: o.items.filter((i) => i.due.status === 'unknown').length
			},
			next: o.items.find((i) => i.due.status !== 'unknown' && i.due.status !== 'snoozed') ?? null
		})),
		upNext
	};
};
