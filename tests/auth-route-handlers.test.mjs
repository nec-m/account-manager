import assert from 'node:assert/strict';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createLoginRateLimiter } from '../lib/auth/rateLimit.js';
import { readJsonObject } from '../lib/auth/http.js';
import { initializeAuthStore } from '../lib/auth/repository.js';
import { createAuthService } from '../lib/auth/service.js';
import { createAuthRouteHandlers } from '../lib/routeHandlers/auth.js';

const REQUEST_ORIGIN = 'http://localhost';

function createCookieStore() {
  const values = new Map();
  return {
    lastSet: undefined,
    lastDeleted: undefined,
    get(name) {
      const value = values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name, value, options) {
      values.set(name, value);
      this.lastSet = { name, value, options };
    },
    delete(name) {
      values.delete(name);
      this.lastDeleted = name;
    },
  };
}

function jsonRequest(path, body, options = {}) {
  const origin = Object.hasOwn(options, 'origin') ? options.origin : REQUEST_ORIGIN;
  const headers = { 'Content-Type': 'application/json' };
  if (origin !== undefined) headers.Origin = origin;
  return new Request(`${REQUEST_ORIGIN}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function observableJsonRequest(path) {
  let bodyRead = false;
  return {
    request: {
      url: `${REQUEST_ORIGIN}${path}`,
      headers: new Headers({ Origin: REQUEST_ORIGIN }),
      async json() {
        bodyRead = true;
        throw new Error('unauthorized body must not be read');
      },
    },
    wasBodyRead: () => bodyRead,
  };
}

async function createTestHandlers(t) {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');
  await initializeAuthStore(db, {
    initialAdminUsername: 'owner',
    initialAdminPassword: 'owner-pass-123',
    now: '2026-07-27T10:00:00.000Z',
  });
  t.after(() => db.close());

  const cookieStore = createCookieStore();
  const service = createAuthService({
    getDb: async () => db,
    rateLimiter: createLoginRateLimiter({ now: () => Date.parse('2026-07-27T10:00:00.000Z') }),
    now: () => new Date('2026-07-27T10:00:00.000Z'),
  });
  const handlers = createAuthRouteHandlers({
    service,
    getCookieStore: async () => cookieStore,
  });
  return { db, cookieStore, handlers };
}

test('shared JSON object reader rejects malformed and non-object request bodies', async () => {
  const invalidBodies = ['{', 'null', '[]'];

  for (const body of invalidBodies) {
    const request = new Request(`${REQUEST_ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    await assert.rejects(
      readJsonObject(request),
      (error) => error.status === 400
        && error.code === 'INVALID_REQUEST'
        && error.message === '请求内容无效',
    );
  }
});

test('login sets the Task 2 session cookie without exposing the token', async (t) => {
  const { cookieStore, handlers } = await createTestHandlers(t);
  const response = await handlers.login(jsonRequest('/api/auth/login', {
    username: 'owner',
    password: 'owner-pass-123',
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(cookieStore.lastSet.options.secure, false);
  assert.equal(cookieStore.lastSet.options.httpOnly, true);
  assert.equal(cookieStore.lastSet.options.sameSite, 'strict');
  assert.equal(cookieStore.lastSet.options.maxAge, 12 * 60 * 60);
  assert.equal(body.user.username, 'owner');
  assert.equal(body.expiresAt, '2026-07-27T22:00:00.000Z');
  assert.equal('token' in body, false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('state-changing requests without an exact same-origin header are rejected', async (t) => {
  const { handlers } = await createTestHandlers(t);

  for (const origin of [undefined, 'https://attacker.example.invalid']) {
    const response = await handlers.login(jsonRequest('/api/auth/login', {
      username: 'owner',
      password: 'owner-pass-123',
    }, { origin }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('session reads the cookie without requiring Origin and never exposes passwordHash', async (t) => {
  const { cookieStore, handlers } = await createTestHandlers(t);
  await handlers.login(jsonRequest('/api/auth/login', {
    username: 'owner',
    password: 'owner-pass-123',
  }));

  const response = await handlers.session(new Request(`${REQUEST_ORIGIN}/api/auth/session`));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user.username, 'owner');
  assert.equal(body.expiresAt, '2026-07-27T22:00:00.000Z');
  assert.equal('passwordHash' in body.user, false);
  assert.equal(cookieStore.lastSet.name, 'account_manager_session');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('logout revokes the session and deletes its cookie', async (t) => {
  const { cookieStore, handlers } = await createTestHandlers(t);
  await handlers.login(jsonRequest('/api/auth/login', {
    username: 'owner',
    password: 'owner-pass-123',
  }));

  const response = await handlers.logout(jsonRequest('/api/auth/logout', {}));
  assert.equal(response.status, 200);
  assert.equal(cookieStore.lastDeleted, 'account_manager_session');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');

  const sessionResponse = await handlers.session(
    new Request(`${REQUEST_ORIGIN}/api/auth/session`),
  );
  assert.equal(sessionResponse.status, 401);
});

test('rate-limited login responses include Retry-After', async (t) => {
  const { handlers } = await createTestHandlers(t);

  for (let attempt = 1; attempt < 5; attempt += 1) {
    const response = await handlers.login(jsonRequest('/api/auth/login', {
      username: 'owner',
      password: 'wrong-password',
    }));
    assert.equal(response.status, 401);
  }
  const response = await handlers.login(jsonRequest('/api/auth/login', {
    username: 'owner',
    password: 'wrong-password',
  }));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '900');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('change-password replaces the cookie with the new usable session', async (t) => {
  const { db, cookieStore, handlers } = await createTestHandlers(t);
  await db.run("UPDATE app_users SET mustChangePassword = 1 WHERE username = 'owner'");
  await handlers.login(jsonRequest('/api/auth/login', {
    username: 'owner',
    password: 'owner-pass-123',
  }));
  const oldToken = cookieStore.lastSet.value;

  const response = await handlers.changePassword(jsonRequest('/api/auth/change-password', {
    currentPassword: 'owner-pass-123',
    newPassword: 'replacement-pass-123',
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.notEqual(cookieStore.lastSet.value, oldToken);
  assert.equal(body.user.mustChangePassword, false);
  assert.equal(body.expiresAt, '2026-07-27T22:00:00.000Z');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(
    (await handlers.session(new Request(`${REQUEST_ORIGIN}/api/auth/session`))).status,
    200,
  );
});

test('change-password rejects the legacy DTO and an incorrect current password', async (t) => {
  const { cookieStore, handlers } = await createTestHandlers(t);
  await handlers.login(jsonRequest('/api/auth/login', {
    username: 'owner',
    password: 'owner-pass-123',
  }));
  const originalToken = cookieStore.lastSet.value;

  const missingCurrent = await handlers.changePassword(jsonRequest(
    '/api/auth/change-password',
    { password: 'replacement-pass-123' },
  ));
  assert.equal(missingCurrent.status, 400);
  assert.equal((await missingCurrent.json()).code, 'INVALID_CURRENT_PASSWORD');

  const incorrectCurrent = await handlers.changePassword(jsonRequest(
    '/api/auth/change-password',
    { currentPassword: 'wrong-password', newPassword: 'replacement-pass-123' },
  ));
  assert.equal(incorrectCurrent.status, 401);
  assert.equal((await incorrectCurrent.json()).code, 'INVALID_CURRENT_PASSWORD');
  assert.equal(cookieStore.lastSet.value, originalToken);
});

test('anonymous change-password is rejected before its request body is read', async (t) => {
  const { handlers } = await createTestHandlers(t);
  const observed = observableJsonRequest('/api/auth/change-password');

  const response = await handlers.changePassword(observed.request);

  assert.equal(response.status, 401);
  assert.equal(observed.wasBodyRead(), false);
});

test('unexpected errors return a generic no-store response without internal details', async () => {
  const handlers = createAuthRouteHandlers({
    service: {
      async getSession() {
        throw new Error('database path and stack must stay private');
      },
    },
    getCookieStore: async () => createCookieStore(),
  });

  const response = await handlers.session(new Request(`${REQUEST_ORIGIN}/api/auth/session`));
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { error: '服务器内部错误', code: 'INTERNAL_ERROR' });
  assert.equal(JSON.stringify(body).includes('database path'), false);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
