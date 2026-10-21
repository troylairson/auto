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
				.filter((i) => ['overdue', 'due', 'soon'].includes(i.due.status))
				.map((i) => ({ vehicle: { id: o.vehicle.id, nickname: o.vehicle.nickname }, ...i }))
		)
		.sort((a, b) => compareDue(a.due, b.due));
	return {
		today,
		vehicles: overviews.map((o) => {
			const attention = o.items.filter((i) => i.due.status === 'overdue' || i.due.status === 'due');
			return {
				vehicle: o.vehicle,
				estimate: o.estimate,
				hero: o.hero,
				minderCode: o.minderCode,
				attention: attention.map((i) => i.item.name),
				overdue: attention.some((i) => i.due.status === 'overdue'),
				unknown: o.items.filter((i) => i.due.status === 'unknown').length,
				next: o.items.find((i) => i.due.status === 'soon' || i.due.status === 'ok') ?? null
			};
		}),
		upNext: upNext.slice(0, 6),
		unknownCount: overviews.reduce((n, o) => n + o.items.filter((i) => i.due.status === 'unknown').length, 0)
	};
};
