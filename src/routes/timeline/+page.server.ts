import { addDays, todayLocal } from '$lib/dates';
import { compareDue } from '$lib/due';
import { getOverview, listVehicles } from '$lib/server/vehicles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const today = todayLocal();
	const horizon = addDays(today, 365);
	const all = listVehicles();
	const selected = Number(url.searchParams.get('v')) || null;
	const rows = all
		.filter((v) => !selected || v.id === selected)
		.flatMap((v) =>
			getOverview(v, today).items.map((i) => ({ vehicle: { id: v.id, nickname: v.nickname }, ...i }))
		)
		.sort((a, b) => compareDue(a.due, b.due));
	return {
		vehicles: all.map((v) => ({ id: v.id, nickname: v.nickname })),
		selected,
		now: rows.filter((r) => r.due.status === 'overdue' || r.due.status === 'due'),
		soon: rows.filter((r) => r.due.status === 'soon' || r.due.status === 'snoozed'),
		later: rows
			.filter((r) => r.due.status === 'ok' && r.due.effectiveDueDate && r.due.effectiveDueDate <= horizon)
			.sort((a, b) => (a.due.effectiveDueDate! < b.due.effectiveDueDate! ? -1 : 1)),
		unknown: rows.filter((r) => r.due.status === 'unknown').length
	};
};
