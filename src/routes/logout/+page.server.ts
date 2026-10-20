import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: ({ cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) invalidateSession(token);
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/login');
	}
};
