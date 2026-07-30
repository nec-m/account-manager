import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'account_manager_session';
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.AUTH_COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
