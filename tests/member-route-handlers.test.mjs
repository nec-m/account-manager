import assert from 'node:assert/strict';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { verifyPassword } from '../lib/auth/password.js';
import { createLoginRateLimiter } from '../lib/auth/rateLimit.js';
import {
  createLoginSession,
  createViewerRecord,
  findUserById,
  initializeAuthStore,
  resetViewerPasswordAndRevokeSessions,
  setViewerStatusAndRevokeSessions,
} from '../lib/auth/repository.js';
import { createAuthService } from '../lib/auth/service.js';
import { SESSION_COOKIE_NAME } from '../lib/auth/session.js';
import { createMemberRouteHandlers } from '../lib/routeHandlers/members.js';

const ORIGIN = 'http://localhost';
const NOW = '2026-07-27T12:00:00.000Z';

function createCookieStore() {
  const values = new Map();
  return {
    get(name) {
      const value = values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    setToken(token) {
      values.set(SESSION_COOKIE_NAME, token);
    },
  };
}

function request(path, options = {}) {
  const { method = 'GET', body } = options;
  const origin = Object.hasOwn(options, 'origin') ? options.origin : ORIGIN;
  const headers = new Headers();
  if (origin !== undefined) headers.set('Origin', origin);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function observableJsonRequest(path) {
  let bodyRead = false;
  return {
    request: {
      url: `${ORIGIN}${path}`,
      headers: new Headers({ Origin: ORIGIN }),
      async json() {
        bodyRead = true;
        throw new Error('forbidden body must not be read');
      },
    },
    wasBodyRead: () => bodyRead,
  };
}

async function createFixture(t) {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');
  await initializeAuthStore(db, {
    initialAdminUsername: 'owner',
    initialAdminPassword: 'owner-pass-123',
    now: NOW,
  });
  t.after(() => db.close());

  const service = createAuthService({
    getDb: async () => db,
    rateLimiter: createLoginRateLimiter({ now: () => Date.parse(NOW) }),
    now: () => new Date(NOW),
  });
  const cookieStore = createCookieStore();
  const handlers = createMemberRouteHandlers({
    service,
    getCookieStore: async () => cookieStore,
  });
  const adminLogin = await service.login({ username: 'owner', password: 'owner-pass-123' });
  cookieStore.setToken(adminLogin.token);

  async function createViewer(username, extra = {}) {
    const response = await handlers.createViewer(request('/api/members', {
      method: 'POST',
      body: { username, ...extra },
    }));
    return { response, body: await response.json() };
  }

  return { db, service, cookieStore, handlers, createViewer };
}

function assertNoPasswordHash(value) {
  assert.equal(JSON.stringify(value).includes('passwordHash'), false);
}

test('viewer receives 403 from every member endpoint', async (t) => {
  const { db, service, cookieStore, handlers, createViewer } = await createFixture(t);
  const created = await createViewer('reader');
  await db.run('UPDATE app_users SET mustChangePassword = 0 WHERE id = ?', created.body.member.id);
  const viewerLogin = await service.login({
    username: 'reader',
    password: created.body.temporaryPassword,
  });
  cookieStore.setToken(viewerLogin.token);

  const calls = [
    () => handlers.listMembers(request('/api/members')),
    () => handlers.createViewer(request('/api/members', {
      method: 'POST',
      body: { username: 'forbidden' },
    })),
    () => handlers.setViewerStatus(request(`/api/members/${created.body.member.id}`, {
      method: 'PATCH',
      body: { status: 'disabled' },
    }), { params: Promise.resolve({ id: created.body.member.id }) }),
    () => handlers.resetViewerPassword(
      request(`/api/members/${created.body.member.id}/reset-password`, {
        method: 'POST',
        body: {},
      }),
      { params: Promise.resolve({ id: created.body.member.id }) },
    ),
  ];

  for (const call of calls) {
    const response = await call();
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('viewer member POST and PATCH are rejected before their request bodies are read', async (t) => {
  const { db, service, cookieStore, handlers, createViewer } = await createFixture(t);
  const created = await createViewer('reader');
  await db.run('UPDATE app_users SET mustChangePassword = 0 WHERE id = ?', created.body.member.id);
  const viewerLogin = await service.login({
    username: 'reader',
    password: created.body.temporaryPassword,
  });
  cookieStore.setToken(viewerLogin.token);
  const createRequest = observableJsonRequest('/api/members');
  const patchRequest = observableJsonRequest(`/api/members/${created.body.member.id}`);

  const createResponse = await handlers.createViewer(createRequest.request);
  const patchResponse = await handlers.setViewerStatus(
    patchRequest.request,
    { params: Promise.resolve({ id: created.body.member.id }) },
  );

  assert.equal(createResponse.status, 403);
  assert.equal(patchResponse.status, 403);
  assert.equal(createRequest.wasBodyRead(), false);
  assert.equal(patchRequest.wasBodyRead(), false);
});

test('admin creates only a viewer and receives its temporary password once', async (t) => {
  const { service, handlers, createViewer } = await createFixture(t);
  const { response, body } = await createViewer('  Reader  ', { role: 'admin' });

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(body.member, {
    id: body.member.id,
    username: 'Reader',
    role: 'viewer',
    status: 'active',
    mustChangePassword: true,
    createdAt: NOW,
    lastLoginAt: null,
  });
  assert.equal(typeof body.temporaryPassword, 'string');
  assert.ok(body.temporaryPassword.length >= 10);
  assertNoPasswordHash(body);

  const login = await service.login({ username: 'reader', password: body.temporaryPassword });
  assert.equal(login.user.role, 'viewer');
  assert.equal(login.user.mustChangePassword, true);

  const listResponse = await handlers.listMembers(request('/api/members'));
  const listed = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.headers.get('cache-control'), 'no-store');
  assert.equal('temporaryPassword' in listed, false);
  assert.equal(listed.members.length, 2);
  assertNoPasswordHash(listed);
});

test('case-insensitive duplicate usernames and a sixth total user return 409', async (t) => {
  const { createViewer } = await createFixture(t);
  const first = await createViewer('Reader');
  assert.equal(first.response.status, 201);

  const duplicate = await createViewer('reader');
  assert.equal(duplicate.response.status, 409);

  for (const username of ['viewer-2', 'viewer-3', 'viewer-4']) {
    const result = await createViewer(username);
    assert.equal(result.response.status, 201);
  }
  const sixth = await createViewer('viewer-5');
  assert.equal(sixth.response.status, 409);
});

test('admin records cannot be disabled or reset and PATCH accepts only a status body', async (t) => {
  const { db, handlers, createViewer } = await createFixture(t);
  const admin = await db.get("SELECT id FROM app_users WHERE role = 'admin'");

  const disableAdmin = await handlers.setViewerStatus(request(`/api/members/${admin.id}`, {
    method: 'PATCH',
    body: { status: 'disabled' },
  }), { params: Promise.resolve({ id: admin.id }) });
  const resetAdmin = await handlers.resetViewerPassword(
    request(`/api/members/${admin.id}/reset-password`, { method: 'POST', body: {} }),
    { params: Promise.resolve({ id: admin.id }) },
  );
  assert.equal(disableAdmin.status, 409);
  assert.equal(resetAdmin.status, 409);
  assert.equal((await db.get('SELECT status FROM app_users WHERE id = ?', admin.id)).status, 'active');

  const created = await createViewer('reader');
  const invalidBodies = [
    { status: 'pending' },
    { status: 'disabled', role: 'admin' },
    {},
  ];
  for (const body of invalidBodies) {
    const response = await handlers.setViewerStatus(request(
      `/api/members/${created.body.member.id}`,
      { method: 'PATCH', body },
    ), { params: Promise.resolve({ id: created.body.member.id }) });
    assert.equal(response.status, 400);
  }
});

test('POST and PATCH reject missing or cross-origin Origin before mutating state', async (t) => {
  const { db, handlers } = await createFixture(t);

  for (const origin of [undefined, 'https://attacker.example.invalid']) {
    const createResponse = await handlers.createViewer(request('/api/members', {
      method: 'POST',
      body: { username: 'reader' },
      origin,
    }));
    assert.equal(createResponse.status, 403);
  }
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM app_users')).count, 1);
});

test('disabling revokes all viewer sessions and enabling does not restore them', async (t) => {
  const { db, service, handlers, createViewer } = await createFixture(t);
  const created = await createViewer('reader');
  await db.run('UPDATE app_users SET mustChangePassword = 0 WHERE id = ?', created.body.member.id);
  const first = await service.login({ username: 'reader', password: created.body.temporaryPassword });
  const second = await service.login({ username: 'reader', password: created.body.temporaryPassword });

  const PATCH = handlers.setViewerStatus;
  const disabled = await PATCH(request(`/api/members/${created.body.member.id}`, {
    method: 'PATCH',
    body: { status: 'disabled' },
  }), { params: Promise.resolve({ id: created.body.member.id }) });
  assert.equal(disabled.status, 200);
  assertNoPasswordHash(await disabled.json());
  await assert.rejects(() => service.getSession(first.token), { status: 401 });
  await assert.rejects(() => service.getSession(second.token), { status: 401 });

  const enabled = await PATCH(request(`/api/members/${created.body.member.id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  }), { params: Promise.resolve({ id: created.body.member.id }) });
  assert.equal(enabled.status, 200);
  await assert.rejects(() => service.getSession(first.token), { status: 401 });
  await assert.rejects(() => service.getSession(second.token), { status: 401 });
});

test('resetting a viewer password revokes every session and returns only the new temporary password', async (t) => {
  const { db, service, handlers, createViewer } = await createFixture(t);
  const created = await createViewer('reader');
  await db.run('UPDATE app_users SET mustChangePassword = 0 WHERE id = ?', created.body.member.id);
  const first = await service.login({ username: 'reader', password: created.body.temporaryPassword });
  const second = await service.login({ username: 'reader', password: created.body.temporaryPassword });

  const response = await handlers.resetViewerPassword(
    request(`/api/members/${created.body.member.id}/reset-password`, {
      method: 'POST',
      body: {},
    }),
    { params: Promise.resolve({ id: created.body.member.id }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.member.mustChangePassword, true);
  assert.notEqual(body.temporaryPassword, created.body.temporaryPassword);
  assertNoPasswordHash(body);
  await assert.rejects(() => service.getSession(first.token), { status: 401 });
  await assert.rejects(() => service.getSession(second.token), { status: 401 });
  await assert.rejects(
    () => service.login({ username: 'reader', password: created.body.temporaryPassword }),
    { status: 401 },
  );
  assert.equal(
    (await service.login({ username: 'reader', password: body.temporaryPassword }))
      .user.mustChangePassword,
    true,
  );
});

test('member repository transactions roll back partial user and session changes', async (t) => {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');
  await initializeAuthStore(db, {
    initialAdminUsername: 'owner',
    initialAdminPassword: 'owner-pass-123',
    now: NOW,
  });
  t.after(() => db.close());

  await db.exec(`
    CREATE TRIGGER fail_viewer_insert
    BEFORE INSERT ON app_users WHEN NEW.role = 'viewer'
    BEGIN SELECT RAISE(ABORT, 'forced viewer insert failure'); END;
  `);
  await assert.rejects(
    createViewerRecord(db, { username: 'reader', password: 'temporary-pass-123', now: NOW }),
    /forced viewer insert failure/,
  );
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM app_users')).count, 1);
  await db.exec('DROP TRIGGER fail_viewer_insert;');

  const viewer = await createViewerRecord(db, {
    username: 'reader',
    password: 'temporary-pass-123',
    now: NOW,
  });
  await createLoginSession(db, {
    userId: viewer.id,
    token: 'viewer-session',
    now: NOW,
    expiresAt: '2026-07-28T00:00:00.000Z',
  });
  await db.exec(`
    CREATE TRIGGER fail_session_delete
    BEFORE DELETE ON auth_sessions
    BEGIN SELECT RAISE(ABORT, 'forced session delete failure'); END;
  `);

  await assert.rejects(
    setViewerStatusAndRevokeSessions(db, { id: viewer.id, status: 'disabled', now: NOW }),
    /forced session delete failure/,
  );
  assert.equal((await findUserById(db, viewer.id)).status, 'active');
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_sessions')).count, 1);

  const beforeReset = await findUserById(db, viewer.id);
  await assert.rejects(
    resetViewerPasswordAndRevokeSessions(db, {
      id: viewer.id,
      password: 'another-temp-pass-123',
      now: NOW,
    }),
    /forced session delete failure/,
  );
  const afterReset = await findUserById(db, viewer.id);
  assert.equal(afterReset.passwordHash, beforeReset.passwordHash);
  assert.equal(afterReset.mustChangePassword, beforeReset.mustChangePassword);
  assert.equal(await verifyPassword('another-temp-pass-123', afterReset.passwordHash), false);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_sessions')).count, 1);
});
