import { redirect } from '@sveltejs/kit';
import { listVehicles } from '$lib/server/vehicles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const vehicles = listVehicles();
	if (vehicles.length === 1) redirect(303, `/vehicles/${vehicles[0].id}/log`);
	return { vehicles: vehicles.map((v) => ({ id: v.id, nickname: v.nickname, label: `${v.year} ${v.make} ${v.model}` })) };
};
