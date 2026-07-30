import assert from 'node:assert/strict';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createLoginRateLimiter } from '../lib/auth/rateLimit.js';
import { initializeAuthStore } from '../lib/auth/repository.js';
import { verifyPassword } from '../lib/auth/password.js';
import { createAuthService } from '../lib/auth/service.js';

const START_TIME = Date.parse('2026-07-27T10:00:00.000Z');

async function createTestService(t) {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');
  await initializeAuthStore(db, {
    initialAdminUsername: 'owner',
    initialAdminPassword: 'owner-pass-123',
    now: new Date(START_TIME).toISOString(),
  });
  t.after(() => db.close());

  let currentTime = START_TIME;
  const service = createAuthService({
    getDb: async () => db,
    rateLimiter: createLoginRateLimiter({ now: () => currentTime }),
    now: () => new Date(currentTime),
  });

  return {
    db,
    service,
    advance(milliseconds) {
      currentTime += milliseconds;
    },
    disableUser(username) {
      return db.run("UPDATE app_users SET status = 'disabled' WHERE username = ?", username);
    },
    requirePasswordChange(username) {
      return db.run('UPDATE app_users SET mustChangePassword = 1 WHERE username = ?', username);
    },
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function isAuthError(status, code, message) {
  return (error) => (
    error.status === status
    && error.code === code
    && (message === undefined || error.message === message)
  );
}

test('login returns a revocable database session without role data in the token', async (t) => {
  const { service } = await createTestService(t);
  const result = await service.login({ username: 'owner', password: 'owner-pass-123' });

  assert.equal(result.user.role, 'admin');
  assert.equal(result.expiresAt, '2026-07-27T22:00:00.000Z');
  assert.equal(result.token.includes('admin'), false);
  const session = await service.getSession(result.token);
  assert.equal(session.user.username, 'owner');
  assert.equal(session.expiresAt, '2026-07-27T22:00:00.000Z');
  assert.equal('passwordHash' in result.user, false);
  assert.equal('passwordHash' in session, false);
});

test('disabled and unknown users share the same public login error', async (t) => {
  const { service, disableUser } = await createTestService(t);
  await disableUser('owner');

  await assert.rejects(
    () => service.login({ username: 'owner', password: 'owner-pass-123' }),
    isAuthError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确'),
  );
  await assert.rejects(
    () => service.login({ username: 'missing', password: 'owner-pass-123' }),
    isAuthError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确'),
  );
});

test('the fifth failed login for one username is rate limited', async (t) => {
  const { service } = await createTestService(t);

  for (let attempt = 1; attempt < 5; attempt += 1) {
    await assert.rejects(
      () => service.login({ username: 'owner', password: 'wrong-password' }),
      isAuthError(401, 'INVALID_CREDENTIALS'),
    );
  }
  await assert.rejects(
    () => service.login({ username: 'owner', password: 'wrong-password' }),
    (error) => (
      error.status === 429
      && error.code === 'RATE_LIMITED'
      && error.headers?.['Retry-After'] === '900'
    ),
  );
});

test('the thirtieth failed login globally is rate limited', async (t) => {
  const { service } = await createTestService(t);

  for (let attempt = 1; attempt < 30; attempt += 1) {
    await assert.rejects(
      () => service.login({ username: `missing-${attempt}`, password: 'wrong-password' }),
      isAuthError(401, 'INVALID_CREDENTIALS'),
    );
  }
  await assert.rejects(
    () => service.login({ username: 'missing-30', password: 'wrong-password' }),
    isAuthError(429, 'RATE_LIMITED'),
  );
});

test('logout revokes the database session', async (t) => {
  const { service } = await createTestService(t);
  const { token } = await service.login({ username: 'owner', password: 'owner-pass-123' });

  await service.logout(token);

  await assert.rejects(() => service.getSession(token), isAuthError(401, 'UNAUTHENTICATED'));
});

test('sessions expire after twelve hours', async (t) => {
  const { service, advance } = await createTestService(t);
  const { token } = await service.login({ username: 'owner', password: 'owner-pass-123' });

  advance(12 * 60 * 60 * 1000);

  await assert.rejects(() => service.getSession(token), isAuthError(401, 'UNAUTHENTICATED'));
});

test('temporary-password sessions can only read the session, change password, or logout', async (t) => {
  const { service, requirePasswordChange } = await createTestService(t);
  await requirePasswordChange('owner');
  const first = await service.login({ username: 'owner', password: 'owner-pass-123' });

  assert.equal((await service.getSession(first.token)).user.mustChangePassword, true);
  await assert.rejects(
    () => service.requireSession(first.token),
    isAuthError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改临时密码'),
  );
  assert.equal(
    (await service.requireSession(first.token, { allowPasswordChangeRequired: true })).user.username,
    'owner',
  );

  const second = await service.login({ username: 'owner', password: 'owner-pass-123' });
  await service.logout(second.token);
  await assert.rejects(() => service.getSession(second.token), isAuthError(401, 'UNAUTHENTICATED'));
});

test('role authorization is based on the current database user record', async (t) => {
  const { db, service } = await createTestService(t);
  const { token } = await service.login({ username: 'owner', password: 'owner-pass-123' });
  await db.run("UPDATE app_users SET role = 'viewer' WHERE username = 'owner'");

  await assert.rejects(
    () => service.requireSession(token, { roles: ['admin'] }),
    isAuthError(403, 'FORBIDDEN'),
  );
  assert.equal((await service.requireSession(token, { roles: ['viewer'] })).user.role, 'viewer');
});

test('changing a password revokes the old token and returns a valid replacement token', async (t) => {
  const { service, requirePasswordChange } = await createTestService(t);
  await requirePasswordChange('owner');
  const { token: oldToken } = await service.login({
    username: 'owner',
    password: 'owner-pass-123',
  });

  const changed = await service.changePassword({
    token: oldToken,
    currentPassword: 'owner-pass-123',
    newPassword: 'replacement-pass-123',
  });

  assert.equal(changed.expiresAt, '2026-07-27T22:00:00.000Z');
  await assert.rejects(() => service.getSession(oldToken), isAuthError(401, 'UNAUTHENTICATED'));
  assert.equal((await service.getSession(changed.token)).user.mustChangePassword, false);
  await assert.rejects(
    () => service.login({ username: 'owner', password: 'owner-pass-123' }),
    isAuthError(401, 'INVALID_CREDENTIALS'),
  );
  assert.equal(
    (await service.login({ username: 'owner', password: 'replacement-pass-123' })).user.username,
    'owner',
  );
});

test('changing a password rejects a missing or incorrect current password', async (t) => {
  const { service } = await createTestService(t);
  const { token } = await service.login({ username: 'owner', password: 'owner-pass-123' });

  await assert.rejects(
    () => service.changePassword({ token, newPassword: 'replacement-pass-123' }),
    isAuthError(400, 'INVALID_CURRENT_PASSWORD'),
  );
  await assert.rejects(
    () => service.changePassword({
      token,
      currentPassword: 'wrong-password',
      newPassword: 'replacement-pass-123',
    }),
    isAuthError(401, 'INVALID_CURRENT_PASSWORD'),
  );
  assert.equal(
    (await service.login({ username: 'owner', password: 'owner-pass-123' })).user.username,
    'owner',
  );
});

test('an in-flight password change cannot overwrite an administrator reset', async (t) => {
  const { db, service } = await createTestService(t);
  const adminLogin = await service.login({ username: 'owner', password: 'owner-pass-123' });
  const created = await service.createViewer(adminLogin.token, { username: 'reader' });
  const viewerLogin = await service.login({
    username: 'reader',
    password: created.temporaryPassword,
  });
  const currentPasswordVerified = createDeferred();
  const continuePasswordChange = createDeferred();
  const delayedService = createAuthService({
    getDb: async () => db,
    rateLimiter: createLoginRateLimiter({ now: () => START_TIME }),
    now: () => new Date(START_TIME),
    verifyPassword: async (password, passwordHash) => {
      const matches = await verifyPassword(password, passwordHash);
      currentPasswordVerified.resolve();
      await continuePasswordChange.promise;
      return matches;
    },
  });

  const passwordChange = delayedService.changePassword({
    token: viewerLogin.token,
    currentPassword: created.temporaryPassword,
    newPassword: 'stale-change-pass-123',
  });
  await currentPasswordVerified.promise;
  const reset = await service.resetViewerPassword(adminLogin.token, { id: created.member.id });
  continuePasswordChange.resolve();

  await assert.rejects(
    passwordChange,
    isAuthError(401, 'UNAUTHENTICATED'),
  );
  await assert.rejects(
    () => service.login({ username: 'reader', password: 'stale-change-pass-123' }),
    isAuthError(401, 'INVALID_CREDENTIALS'),
  );
  assert.equal(
    (await service.login({ username: 'reader', password: reset.temporaryPassword }))
      .user.mustChangePassword,
    true,
  );
});
