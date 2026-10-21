import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword, randomToken, validatePassword, verifyPassword } from '$lib/server/auth';
import { FormReader } from '$lib/server/forms';
import { appUrl, sendPush } from '$lib/server/ntfy';
import { runReminders } from '$lib/server/reminders';
import { backupDatabase } from '$lib/server/backup';
import { createUser, readUserForm } from '$lib/server/users';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url, cookies }) => {
	const me = locals.user!;
	return {
		me: { name: me.name, username: me.username, ntfyTopic: me.ntfyTopic, notifyPush: me.notifyPush },
		household: db.select({ id: users.id, name: users.name, username: users.username }).from(users).all(),
		ntfyServer: process.env.NTFY_URL ?? 'https://ntfy.sh',
		calendarUrl: appUrl(`/calendar/${me.calendarToken}.ics`) ?? `${url.origin}/calendar/${me.calendarToken}.ics`,
		originConfigured: !!(process.env.ORIGIN ?? process.env.PUBLIC_URL),
		theme: cookies.get('theme') ?? 'auto'
	};
};

export const actions: Actions = {
	theme: async ({ request, cookies, url }) => {
		const theme = String((await request.formData()).get('theme'));
		if (theme === 'light' || theme === 'dark') {
			cookies.set('theme', theme, {
				path: '/',
				httpOnly: false,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 365 * 5
			});
		} else {
			cookies.delete('theme', { path: '/' });
		}
		return { section: 'theme' };
	},
	profile: async ({ request, locals }) => {
		const f = new FormReader(await request.formData());
		const name = f.str('name', { required: true, label: 'Name' });
		const ntfyTopic = f.str('ntfyTopic');
		if (ntfyTopic && !/^[A-Za-z0-9_-]{1,64}$/.test(ntfyTopic))
			f.errors.ntfyTopic = 'Topics use letters, numbers, dashes and underscores.';
		if (!f.ok) return fail(400, { section: 'profile', errors: f.errors });
		db.update(users)
			.set({ name: name!, ntfyTopic, notifyPush: f.bool('notifyPush') })
			.where(eq(users.id, locals.user!.id))
			.run();
		return { section: 'profile', message: 'Saved.' };
	},
	password: async ({ request, locals }) => {
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const next = String(data.get('next') ?? '');
		if (!(await verifyPassword(locals.user!.passwordHash, current)))
			return fail(400, { section: 'password', errors: { current: 'Current password is wrong.' } });
		const err = validatePassword(next);
		if (err) return fail(400, { section: 'password', errors: { next: err } });
		db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, locals.user!.id)).run();
		return { section: 'password', message: 'Password changed.' };
	},
	addUser: async ({ request }) => {
		const parsed = readUserForm(await request.formData());
		if (!parsed.ok) return fail(400, { section: 'household', errors: parsed.errors, values: parsed.values });
		const user = await createUser(parsed.value);
		return { section: 'household', message: `Added ${user.name}. They can sign in and subscribe to their own topic.` };
	},
	testPush: async ({ locals }) => {
		const me = locals.user!;
		if (!me.ntfyTopic) return fail(400, { section: 'profile', errors: { ntfyTopic: 'Set a topic first.' } });
		try {
			await sendPush(me.ntfyTopic, {
				title: 'Auto test notification',
				message: `Hi ${me.name}, reminders will arrive here.`,
				click: appUrl('/'),
				tags: ['white_check_mark']
			});
			return { section: 'profile', message: 'Test notification sent.' };
		} catch (e) {
			return fail(502, { section: 'profile', errors: { ntfyTopic: (e as Error).message } });
		}
	},
	runReminders: async () => {
		const r = await runReminders(undefined, { digest: true });
		return {
			section: 'reminders',
			message: `Sent ${r.sent} notification(s).${r.errors.length ? ` Errors: ${r.errors.join('; ')}` : ''}`
		};
	},
	backup: async () => {
		const file = await backupDatabase();
		return { section: 'backup', message: `Backup written to ${file}` };
	},
	newCalendarToken: ({ locals }) => {
		db.update(users).set({ calendarToken: randomToken() }).where(eq(users.id, locals.user!.id)).run();
		return { section: 'calendar', message: 'New calendar link created; the old one no longer works.' };
	}
};
