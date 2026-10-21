import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { initDatabase } from '$lib/server/db';
import { SESSION_COOKIE, setSessionCookie, validateSession } from '$lib/server/auth';
import { startScheduler } from '$lib/server/reminders';
import { scheduleBackups } from '$lib/server/backup';

export const init: ServerInit = () => {
	if (building) return;
	initDatabase();
	startScheduler();
	scheduleBackups();
};

const PUBLIC_PATHS = ['/login', '/setup', '/calendar/', '/health'];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = null;
	if (token) {
		const session = validateSession(token);
		if (session) {
			event.locals.user = session.user;
			setSessionCookie(event.cookies, event.url, token, session.expiresAt);
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	}

	const path = event.url.pathname;
	const isPublic = PUBLIC_PATHS.some((p) => path === p || (p.endsWith('/') && path.startsWith(p)));
	if (!event.locals.user && !isPublic) {
		const next = path === '/' ? '' : `?next=${encodeURIComponent(path + event.url.search)}`;
		redirect(303, `/login${next}`);
	}
	const theme = event.cookies.get('theme');
	const safeTheme = theme === 'light' || theme === 'dark' ? theme : 'auto';
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%auto.theme%', safeTheme)
	});
};
