import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, setSessionCookie, verifyPassword } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

function safeNext(url: URL) {
	const next = url.searchParams.get('next') ?? '/';
	return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url));
	if (!db.select({ id: users.id }).from(users).get()) redirect(303, '/setup');
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim().toLowerCase();
		const password = String(data.get('password') ?? '');
		const user = db.select().from(users).where(eq(users.username, username)).get();
		if (!user || !(await verifyPassword(user.passwordHash, password))) {
			return fail(400, { username, error: 'Wrong username or password.' });
		}
		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, url, token, expiresAt);
		redirect(303, safeNext(url));
	}
};
