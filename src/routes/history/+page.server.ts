import { todayLocal } from '$lib/dates';
import { listRecords, listVehicles } from '$lib/server/vehicles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const all = listVehicles(true);
	const selected = Number(url.searchParams.get('v')) || null;
	const records = all
		.filter((v) => !selected || v.id === selected)
		.flatMap((v) => listRecords(v.id).map((r) => ({ ...r, vehicle: { id: v.id, nickname: v.nickname } })))
		.sort((a, b) =>
			a.serviceDate === b.serviceDate ? b.mileage - a.mileage : a.serviceDate < b.serviceDate ? 1 : -1
		);
	const year = todayLocal().slice(0, 4);
	return {
		vehicles: all.filter((v) => !v.archivedAt).map((v) => ({ id: v.id, nickname: v.nickname })),
		selected,
		records,
		year,
		yearTotal: records
			.filter((r) => r.serviceDate.startsWith(year))
			.reduce((sum, r) => sum + (r.totalCostCents ?? 0), 0)
	};
};
