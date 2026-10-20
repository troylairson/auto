import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, setSessionCookie } from '$lib/server/auth';
import { createUser, readUserForm } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

const hasUsers = () => !!db.select({ id: users.id }).from(users).get();

export const load: PageServerLoad = () => {
	if (hasUsers()) redirect(303, '/login');
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (hasUsers()) redirect(303, '/login');
		const parsed = readUserForm(await request.formData());
		if (!parsed.ok) return fail(400, parsed);
		const user = await createUser(parsed.value);
		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, url, token, expiresAt);
		redirect(303, '/settings?welcome=1');
	}
};
