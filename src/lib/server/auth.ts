import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { eq, lt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { db } from './db';
import { sessions, users, type User } from './db/schema';

export const SESSION_COOKIE = 'auto_session';
const SESSION_DAYS = 90;
const DAY_MS = 86_400_000;

export const hashPassword = (password: string) => hash(password);
export const verifyPassword = (passwordHash: string, password: string) =>
	verify(passwordHash, password);

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
const sessionId = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(userId: number): { token: string; expiresAt: number } {
	const token = randomToken(32);
	const expiresAt = Date.now() + SESSION_DAYS * DAY_MS;
	db.insert(sessions).values({ id: sessionId(token), userId, expiresAt }).run();
	db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
	return { token, expiresAt };
}

/** Returns the session's user, sliding the expiry forward when it's past halfway. */
export function validateSession(token: string): { user: User; expiresAt: number } | null {
	const id = sessionId(token);
	const row = db
		.select({ user: users, expiresAt: sessions.expiresAt })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;
	if (row.expiresAt < Date.now()) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	let expiresAt = row.expiresAt;
	if (expiresAt - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
		expiresAt = Date.now() + SESSION_DAYS * DAY_MS;
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
	}
	return { user: row.user, expiresAt };
}

export function invalidateSession(token: string) {
	db.delete(sessions).where(eq(sessions.id, sessionId(token))).run();
}

export function setSessionCookie(cookies: Cookies, url: URL, token: string, expiresAt: number) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		expires: new Date(expiresAt)
	});
}

export function newNtfyTopic(username: string) {
	return `auto-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${crypto
		.randomBytes(9)
		.toString('base64url')
		.replace(/[^a-zA-Z0-9]/g, 'x')}`;
}

export function validatePassword(password: string): string | null {
	return password.length >= 8 ? null : 'Password must be at least 8 characters.';
}
