import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { initializeSchema, writeDataToDb } from '../lib/db.js';
import {
  createLoginSession,
  deleteSession,
  findSessionUser,
  findUserById,
  findUserByUsername,
  initializeAuthStore,
  replacePasswordAndSession,
} from '../lib/auth/repository.js';
import {
  createSessionToken,
  getSessionCookieOptions,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '../lib/auth/session.js';
import { verifyPassword } from '../lib/auth/password.js';

const execFileAsync = promisify(execFile);

async function createAuthTestDb(t) {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');
  t.after(() => db.close());
  return db;
}

async function initializeTestAdmin(db, overrides = {}) {
  return initializeAuthStore(db, {
    initialAdminUsername: 'owner',
    initialAdminPassword: 'owner-pass-123',
    now: '2026-07-27T10:00:00.000Z',
    ...overrides,
  });
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test('concurrent cold getDb calls share one initialized connection', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'account-manager-auth-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const dbModuleUrl = new URL('../lib/db.js', import.meta.url).href;
  const script = `
    const { getDb } = await import(process.env.DB_MODULE_URL);
    const [first, second] = await Promise.all([getDb(), getDb()]);
    if (first !== second) throw new Error('getDb returned different connections');
    await first.close();
    process.stdout.write('same-connection');
  `;

  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: temporaryDirectory,
      env: {
        ...process.env,
        DB_MODULE_URL: dbModuleUrl,
        INITIAL_ADMIN_USERNAME: 'owner',
        INITIAL_ADMIN_PASSWORD: 'owner-pass-123',
      },
    },
  );

  assert.equal(stdout, 'same-connection');
});

test('failed getDb initialization clears in-flight state and allows retry', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'account-manager-auth-retry-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const dbModuleUrl = new URL('../lib/db.js', import.meta.url).href;
  const script = `
    const { getDb } = await import(process.env.DB_MODULE_URL);
    delete process.env.INITIAL_ADMIN_USERNAME;
    delete process.env.INITIAL_ADMIN_PASSWORD;
    let initializationFailed = false;
    try {
      await getDb();
    } catch {
      initializationFailed = true;
    }
    if (!initializationFailed) throw new Error('initialization unexpectedly succeeded');
    process.env.INITIAL_ADMIN_USERNAME = 'owner';
    process.env.INITIAL_ADMIN_PASSWORD = 'owner-pass-123';
    const db = await getDb();
    const user = await db.get('SELECT username FROM app_users');
    if (user?.username !== 'owner') throw new Error('retry did not initialize admin');
    await db.close();
    process.stdout.write('retry-succeeded');
  `;

  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: temporaryDirectory,
      env: { ...process.env, DB_MODULE_URL: dbModuleUrl },
    },
  );

  assert.equal(stdout, 'retry-succeeded');
});

test('startup config validation initializes an empty auth store without exposing credentials', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'account-manager-auth-validation-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const validationScript = path.resolve('scripts/validate-auth-config.mjs');
  const username = 'validation-owner';
  const password = 'validation-password-123';

  const failedValidation = await execFileAsync(process.execPath, [validationScript], {
    cwd: temporaryDirectory,
    env: {
      ...process.env,
      INITIAL_ADMIN_USERNAME: '',
      INITIAL_ADMIN_PASSWORD: '',
    },
  }).catch((error) => error);
  assert.equal(failedValidation.code, 1);
  assert.match(failedValidation.stderr, /认证初始化配置/);

  const { stdout, stderr } = await execFileAsync(process.execPath, [validationScript], {
    cwd: temporaryDirectory,
    env: {
      ...process.env,
      INITIAL_ADMIN_USERNAME: username,
      INITIAL_ADMIN_PASSWORD: password,
    },
  });
  assert.match(stdout, /认证配置校验完成/);
  assert.doesNotMatch(stderr, /认证初始化配置/);
  assert.equal(`${stdout}${stderr}`.includes(username), false);
  assert.equal(`${stdout}${stderr}`.includes(password), false);
});

test('auth initialization creates one admin and never overwrites it', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  await initializeAuthStore(db, {
    initialAdminUsername: 'other',
    initialAdminPassword: 'other-pass-123',
    now: '2026-07-27T11:00:00.000Z',
  });

  const users = await db.all('SELECT username, role FROM app_users');
  assert.deepEqual(users, [{ username: 'owner', role: 'admin' }]);
});

test('empty auth store rejects missing bootstrap credentials', async (t) => {
  const db = await createAuthTestDb(t);

  await assert.rejects(() => initializeAuthStore(db, {}), /INITIAL_ADMIN_USERNAME/);
  await assert.rejects(
    () => initializeAuthStore(db, { initialAdminUsername: 'owner' }),
    /INITIAL_ADMIN_PASSWORD/,
  );
});

test('auth schema enforces user fields, case-insensitive usernames, and one admin', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'OWNER');

  assert.equal(owner.username, 'owner');
  assert.equal((await findUserById(db, owner.id)).username, 'owner');
  await assert.rejects(
    db.run(
      `INSERT INTO app_users
        (id, username, passwordHash, role, status, mustChangePassword, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      'duplicate', 'Owner', owner.passwordHash, 'viewer', 'active', 0,
      '2026-07-27T10:00:00.000Z', '2026-07-27T10:00:00.000Z',
    ),
    /SQLITE_CONSTRAINT/,
  );
  await assert.rejects(
    db.run(
      `INSERT INTO app_users
        (id, username, passwordHash, role, status, mustChangePassword, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      'second-admin', 'second-admin', owner.passwordHash, 'admin', 'active', 0,
      '2026-07-27T10:00:00.000Z', '2026-07-27T10:00:00.000Z',
    ),
    /SQLITE_CONSTRAINT/,
  );

  for (const [column, value] of [
    ['role', 'editor'],
    ['status', 'pending'],
    ['mustChangePassword', 2],
  ]) {
    await assert.rejects(
      db.run(
        `INSERT INTO app_users
          (id, username, passwordHash, role, status, mustChangePassword, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        `invalid-${column}`, `invalid-${column}`, owner.passwordHash,
        column === 'role' ? value : 'viewer',
        column === 'status' ? value : 'active',
        column === 'mustChangePassword' ? value : 0,
        '2026-07-27T10:00:00.000Z', '2026-07-27T10:00:00.000Z',
      ),
      /SQLITE_CONSTRAINT/,
    );
  }
});

test('auth initialization preserves existing business records', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeSchema(db);
  await db.run(
    'INSERT INTO accounts (id, site, username) VALUES (?, ?, ?)',
    'account-a', 'Alpha', 'alpha@example.invalid',
  );
  await db.run(
    'INSERT INTO phones (id, number, boundAccountId) VALUES (?, ?, ?)',
    'phone-a', '+1 202-555-0104', 'account-a',
  );

  await initializeTestAdmin(db);

  assert.deepEqual(await db.get('SELECT id, site, username FROM accounts'), {
    id: 'account-a', site: 'Alpha', username: 'alpha@example.invalid',
  });
  assert.deepEqual(await db.get('SELECT id, number, boundAccountId FROM phones'), {
    id: 'phone-a', number: '+1 202-555-0104', boundAccountId: 'account-a',
  });
});

test('session helpers create random tokens and strict cookie options', () => {
  const previousSecure = process.env.AUTH_COOKIE_SECURE;
  process.env.AUTH_COOKIE_SECURE = 'false';
  try {
    const firstToken = createSessionToken();
    const secondToken = createSessionToken();
    assert.notEqual(firstToken, secondToken);
    assert.equal(Buffer.from(firstToken, 'base64url').length, 32);
    assert.match(hashSessionToken(firstToken), /^[0-9a-f]{64}$/);
    assert.equal(SESSION_COOKIE_NAME, 'account_manager_session');
    assert.equal(SESSION_MAX_AGE_SECONDS, 43200);
    assert.deepEqual(getSessionCookieOptions(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 43200,
    });
  } finally {
    if (previousSecure === undefined) delete process.env.AUTH_COOKIE_SECURE;
    else process.env.AUTH_COOKIE_SECURE = previousSecure;
  }
});

test('login sessions store only token hashes and resolve active unexpired users', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'owner');
  const token = 'raw-login-token';

  await createLoginSession(db, {
    userId: owner.id,
    token,
    now: '2026-07-27T10:00:00.000Z',
    expiresAt: '2026-07-27T22:00:00.000Z',
  });

  const stored = await db.get('SELECT tokenHash FROM auth_sessions');
  assert.match(stored.tokenHash, /^[0-9a-f]{64}$/);
  assert.equal(stored.tokenHash, hashSessionToken(token));
  assert.equal(JSON.stringify(stored).includes(token), false);
  assert.equal(
    (await findSessionUser(db, token, { now: '2026-07-27T10:01:00.000Z' })).id,
    owner.id,
  );
  assert.equal(
    await findSessionUser(db, token, { now: '2026-07-27T22:00:00.000Z' }),
    undefined,
  );

  await db.run('UPDATE app_users SET status = ? WHERE id = ?', 'disabled', owner.id);
  assert.equal(
    await findSessionUser(db, token, { now: '2026-07-27T10:02:00.000Z' }),
    undefined,
  );
});

test('deleted sessions and cascade-deleted user sessions cannot be resolved', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'owner');

  await createLoginSession(db, {
    userId: owner.id,
    token: 'delete-me',
    now: '2026-07-27T10:00:00.000Z',
    expiresAt: '2026-07-27T22:00:00.000Z',
  });
  await deleteSession(db, 'delete-me');
  assert.equal(await findSessionUser(db, 'delete-me'), undefined);

  await createLoginSession(db, {
    userId: owner.id,
    token: 'cascade-me',
    now: '2026-07-27T10:00:00.000Z',
    expiresAt: '2026-07-27T22:00:00.000Z',
  });
  await db.run('DELETE FROM app_users WHERE id = ?', owner.id);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_sessions')).count, 0);
});

test('password replacement revokes old sessions and creates only the new session atomically', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'owner');
  await db.run('UPDATE app_users SET mustChangePassword = 1 WHERE id = ?', owner.id);
  await createLoginSession(db, {
    userId: owner.id,
    token: 'old-token',
    now: '2026-07-27T10:00:00.000Z',
    expiresAt: '2026-07-27T22:00:00.000Z',
  });

  await replacePasswordAndSession(db, {
    userId: owner.id,
    sessionToken: 'old-token',
    expectedPasswordHash: owner.passwordHash,
    password: 'replacement-pass-123',
    token: 'new-token',
    now: '2026-07-27T11:00:00.000Z',
    expiresAt: '2026-07-27T23:00:00.000Z',
  });

  const updated = await findUserById(db, owner.id);
  assert.equal(updated.mustChangePassword, 0);
  assert.equal(await verifyPassword('replacement-pass-123', updated.passwordHash), true);
  assert.equal(await findSessionUser(db, 'old-token'), undefined);
  assert.equal((await findSessionUser(
    db,
    'new-token',
    { now: '2026-07-27T11:01:00.000Z' },
  )).id, owner.id);
  assert.deepEqual(await db.all('SELECT tokenHash FROM auth_sessions'), [
    { tokenHash: hashSessionToken('new-token') },
  ]);
});

test('session transactions roll back partial writes on errors', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'owner');
  await db.run(
    `INSERT INTO auth_sessions (tokenHash, userId, createdAt, expiresAt)
     VALUES (?, ?, ?, ?)`,
    hashSessionToken('expired-token'), owner.id,
    '2026-07-26T10:00:00.000Z', '2026-07-27T09:00:00.000Z',
  );
  await db.exec(`
    CREATE TRIGGER fail_last_login
    BEFORE UPDATE OF lastLoginAt ON app_users
    BEGIN
      SELECT RAISE(ABORT, 'forced last login failure');
    END;
  `);

  await assert.rejects(
    createLoginSession(db, {
      userId: owner.id,
      token: 'rolled-back-token',
      now: '2026-07-27T10:00:00.000Z',
      expiresAt: '2026-07-27T22:00:00.000Z',
    }),
    /forced last login failure/,
  );
  assert.deepEqual(await db.all('SELECT tokenHash FROM auth_sessions'), [
    { tokenHash: hashSessionToken('expired-token') },
  ]);
});

test('password replacement restores the user and old sessions when new session insertion fails', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'owner');
  await db.run('UPDATE app_users SET mustChangePassword = 1 WHERE id = ?', owner.id);
  await createLoginSession(db, {
    userId: owner.id,
    token: 'existing-token',
    now: '2026-07-27T10:00:00.000Z',
    expiresAt: '2026-07-27T22:00:00.000Z',
  });
  const beforeUser = await findUserById(db, owner.id);
  const beforeSessions = await db.all('SELECT * FROM auth_sessions');
  await db.exec(`
    CREATE TRIGGER fail_replacement_session
    BEFORE INSERT ON auth_sessions
    WHEN NEW.tokenHash = '${hashSessionToken('failed-new-token')}'
    BEGIN
      SELECT RAISE(ABORT, 'forced replacement session failure');
    END;
  `);

  await assert.rejects(
    replacePasswordAndSession(db, {
      userId: owner.id,
      sessionToken: 'existing-token',
      expectedPasswordHash: owner.passwordHash,
      password: 'replacement-pass-123',
      token: 'failed-new-token',
      now: '2026-07-27T11:00:00.000Z',
      expiresAt: '2026-07-27T23:00:00.000Z',
    }),
    /forced replacement session failure/,
  );

  assert.deepEqual(await findUserById(db, owner.id), beforeUser);
  assert.deepEqual(await db.all('SELECT * FROM auth_sessions'), beforeSessions);
});

test('password replacement rejects a revoked token or changed expected password hash', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'owner');
  await createLoginSession(db, {
    userId: owner.id,
    token: 'stale-token',
    now: '2026-07-27T10:00:00.000Z',
    expiresAt: '2026-07-27T22:00:00.000Z',
  });
  const replacementHash = owner.passwordHash.replace(/.$/, (last) => (last === 'A' ? 'B' : 'A'));
  await db.run(
    'UPDATE app_users SET passwordHash = ?, mustChangePassword = 1 WHERE id = ?',
    replacementHash,
    owner.id,
  );
  await db.run('DELETE FROM auth_sessions WHERE userId = ?', owner.id);

  await assert.rejects(
    replacePasswordAndSession(db, {
      userId: owner.id,
      sessionToken: 'stale-token',
      expectedPasswordHash: owner.passwordHash,
      password: 'stale-change-pass-123',
      token: 'must-not-exist',
      now: '2026-07-27T11:00:00.000Z',
      expiresAt: '2026-07-27T23:00:00.000Z',
    }),
    (error) => error.code === 'STALE_SESSION',
  );
  const after = await findUserById(db, owner.id);
  assert.equal(after.passwordHash, replacementHash);
  assert.equal(after.mustChangePassword, 1);
  assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_sessions')).count, 0);
});

test('business and auth transactions share one operation queue on the same connection', async (t) => {
  const db = await createAuthTestDb(t);
  await initializeSchema(db);
  await initializeTestAdmin(db);
  const owner = await findUserByUsername(db, 'owner');
  const businessTransactionPaused = createDeferred();
  const releaseBusinessTransaction = createDeferred();
  const secondBeginAttempted = createDeferred();
  const originalAll = db.all.bind(db);
  const originalExec = db.exec.bind(db);
  let pausedBusinessRead = false;
  let beginCount = 0;

  db.all = async (sql, ...params) => {
    const rows = await originalAll(sql, ...params);
    if (!pausedBusinessRead && /^\s*SELECT id, boundAccountId FROM phones\b/i.test(String(sql))) {
      pausedBusinessRead = true;
      businessTransactionPaused.resolve();
      await releaseBusinessTransaction.promise;
    }
    return rows;
  };
  db.exec = async (sql, ...params) => {
    if (/^\s*BEGIN IMMEDIATE\b/i.test(String(sql))) {
      beginCount += 1;
      if (beginCount === 2) secondBeginAttempted.resolve(true);
    }
    return originalExec(sql, ...params);
  };

  try {
    const businessWrite = writeDataToDb(db, {
      accounts: [{ id: 'account-a', site: 'Alpha', username: 'alpha@example.invalid' }],
      phones: [],
    }, { now: '2026-07-27T12:00:00.000Z' });
    await businessTransactionPaused.promise;

    const authWrite = createLoginSession(db, {
      userId: owner.id,
      token: 'queued-auth-token',
      now: '2026-07-27T12:00:00.000Z',
      expiresAt: '2026-07-28T00:00:00.000Z',
    });
    void authWrite.catch(() => {});
    const attemptedBeforeRelease = await Promise.race([
      secondBeginAttempted.promise,
      new Promise((resolve) => setTimeout(() => resolve(false), 50)),
    ]);
    assert.equal(attemptedBeforeRelease, false);

    releaseBusinessTransaction.resolve();
    const results = await Promise.allSettled([businessWrite, authWrite]);
    assert.deepEqual(
      results.map(({ status }) => status),
      ['fulfilled', 'fulfilled'],
      results.find(({ status }) => status === 'rejected')?.reason?.message,
    );
  } finally {
    releaseBusinessTransaction.resolve();
    db.all = originalAll;
    db.exec = originalExec;
  }
});
