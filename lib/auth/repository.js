import { randomUUID } from 'node:crypto';
import { serializeDbOperation } from '../db/operationQueue.js';
import { assertValidPassword, hashPassword } from './password.js';
import {
  createSessionToken,
  hashSessionToken,
  SESSION_MAX_AGE_SECONDS,
} from './session.js';

function getNow(value) {
  return value || new Date().toISOString();
}

function getExpiry(now, value) {
  return value || new Date(Date.parse(now) + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
}

async function rollback(db, transactionStarted) {
  if (transactionStarted) await db.exec('ROLLBACK;').catch(() => {});
}

export class MemberRepositoryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MemberRepositoryError';
    this.code = code;
  }
}

export class PasswordReplacementError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PasswordReplacementError';
    this.code = code;
  }
}

function selectMemberById(db, id) {
  return db.get(
    `SELECT id, username, role, status, mustChangePassword, createdAt, lastLoginAt
     FROM app_users WHERE id = ?`,
    id,
  );
}

export async function initializeAuthStore(db, config = {}) {
  return serializeDbOperation(db, async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        mustChangePassword INTEGER NOT NULL DEFAULT 0 CHECK (mustChangePassword IN (0, 1)),
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastLoginAt TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_single_admin
        ON app_users(role) WHERE role = 'admin';
      CREATE TABLE IF NOT EXISTS auth_sessions (
        tokenHash TEXT PRIMARY KEY,
        userId TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(userId);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expiresAt);
    `);

    const { count } = await db.get('SELECT COUNT(*) AS count FROM app_users');
    if (count > 0) return;

    const username = config.initialAdminUsername;
    const password = config.initialAdminPassword;
    if (typeof username !== 'string' || username.trim() === '') {
      throw new Error('INITIAL_ADMIN_USERNAME is required when the auth store is empty');
    }
    if (typeof password !== 'string' || password === '') {
      throw new Error('INITIAL_ADMIN_PASSWORD is required when the auth store is empty');
    }

    assertValidPassword(password);
    const passwordHash = await hashPassword(password);
    const now = getNow(config.now);
    await db.run(
      `INSERT INTO app_users (
        id, username, passwordHash, role, status, mustChangePassword, createdAt, updatedAt
      ) VALUES (?, ?, ?, 'admin', 'active', 0, ?, ?)`,
      randomUUID(), username.trim(), passwordHash, now, now,
    );
  });
}

export function findUserByUsername(db, username) {
  return serializeDbOperation(db, () => db.get(
    'SELECT * FROM app_users WHERE username = ? COLLATE NOCASE',
    username,
  ));
}

export function findUserById(db, userId) {
  return serializeDbOperation(db, () => db.get(
    'SELECT * FROM app_users WHERE id = ?',
    userId,
  ));
}

export function createLoginSession(db, {
  userId,
  token = createSessionToken(),
  now: nowValue,
  expiresAt: expiresAtValue,
}) {
  const now = getNow(nowValue);
  const expiresAt = getExpiry(now, expiresAtValue);
  const tokenHash = hashSessionToken(token);

  return serializeDbOperation(db, async () => {
    let transactionStarted = false;
    try {
      await db.exec('BEGIN IMMEDIATE;');
      transactionStarted = true;
      await db.run('DELETE FROM auth_sessions WHERE expiresAt <= ?', now);
      await db.run(
        `INSERT INTO auth_sessions (tokenHash, userId, createdAt, expiresAt)
         VALUES (?, ?, ?, ?)`,
        tokenHash, userId, now, expiresAt,
      );
      await db.run('UPDATE app_users SET lastLoginAt = ? WHERE id = ?', now, userId);
      await db.exec('COMMIT;');
      transactionStarted = false;
      return { token, expiresAt };
    } catch (error) {
      await rollback(db, transactionStarted);
      throw error;
    }
  });
}

export function findSessionUser(db, token, { now: nowValue } = {}) {
  const tokenHash = hashSessionToken(token);
  const now = getNow(nowValue);
  return serializeDbOperation(db, () => db.get(
    `SELECT app_users.*, auth_sessions.expiresAt AS sessionExpiresAt
     FROM auth_sessions
     JOIN app_users ON app_users.id = auth_sessions.userId
     WHERE auth_sessions.tokenHash = ?
       AND auth_sessions.expiresAt > ?
       AND app_users.status = 'active'`,
    tokenHash, now,
  ));
}

export function deleteSession(db, token) {
  const tokenHash = hashSessionToken(token);
  return serializeDbOperation(db, () => db.run(
    'DELETE FROM auth_sessions WHERE tokenHash = ?',
    tokenHash,
  ));
}

export function listMemberRecords(db) {
  return serializeDbOperation(db, () => db.all(
    `SELECT id, username, role, status, mustChangePassword, createdAt, lastLoginAt
     FROM app_users
     ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, createdAt, username COLLATE NOCASE`,
  ));
}

export async function createViewerRecord(db, {
  username,
  password,
  id = randomUUID(),
  now: nowValue,
}) {
  assertValidPassword(password);
  const passwordHash = await hashPassword(password);
  const now = getNow(nowValue);

  return serializeDbOperation(db, async () => {
    let transactionStarted = false;
    try {
      await db.exec('BEGIN IMMEDIATE;');
      transactionStarted = true;

      const { count } = await db.get('SELECT COUNT(*) AS count FROM app_users');
      if (count >= 5) throw new MemberRepositoryError('USER_LIMIT_REACHED');

      const duplicate = await db.get(
        'SELECT id FROM app_users WHERE username = ? COLLATE NOCASE',
        username,
      );
      if (duplicate) throw new MemberRepositoryError('USERNAME_EXISTS');

      await db.run(
        `INSERT INTO app_users (
          id, username, passwordHash, role, status, mustChangePassword, createdAt, updatedAt
        ) VALUES (?, ?, ?, 'viewer', 'active', 1, ?, ?)`,
        id, username, passwordHash, now, now,
      );
      const member = await selectMemberById(db, id);
      await db.exec('COMMIT;');
      transactionStarted = false;
      return member;
    } catch (error) {
      await rollback(db, transactionStarted);
      throw error;
    }
  });
}

export function setViewerStatusAndRevokeSessions(db, { id, status, now: nowValue }) {
  const now = getNow(nowValue);
  return serializeDbOperation(db, async () => {
    let transactionStarted = false;
    try {
      await db.exec('BEGIN IMMEDIATE;');
      transactionStarted = true;
      const target = await db.get('SELECT role FROM app_users WHERE id = ?', id);
      if (!target || target.role !== 'viewer') {
        throw new MemberRepositoryError('VIEWER_OPERATION_FORBIDDEN');
      }

      await db.run(
        'UPDATE app_users SET status = ?, updatedAt = ? WHERE id = ?',
        status, now, id,
      );
      await db.run('DELETE FROM auth_sessions WHERE userId = ?', id);
      const member = await selectMemberById(db, id);
      await db.exec('COMMIT;');
      transactionStarted = false;
      return member;
    } catch (error) {
      await rollback(db, transactionStarted);
      throw error;
    }
  });
}

export async function resetViewerPasswordAndRevokeSessions(db, {
  id,
  password,
  now: nowValue,
}) {
  assertValidPassword(password);
  const passwordHash = await hashPassword(password);
  const now = getNow(nowValue);

  return serializeDbOperation(db, async () => {
    let transactionStarted = false;
    try {
      await db.exec('BEGIN IMMEDIATE;');
      transactionStarted = true;
      const target = await db.get('SELECT role FROM app_users WHERE id = ?', id);
      if (!target || target.role !== 'viewer') {
        throw new MemberRepositoryError('VIEWER_OPERATION_FORBIDDEN');
      }

      await db.run(
        `UPDATE app_users
         SET passwordHash = ?, mustChangePassword = 1, updatedAt = ?
         WHERE id = ?`,
        passwordHash, now, id,
      );
      await db.run('DELETE FROM auth_sessions WHERE userId = ?', id);
      const member = await selectMemberById(db, id);
      await db.exec('COMMIT;');
      transactionStarted = false;
      return member;
    } catch (error) {
      await rollback(db, transactionStarted);
      throw error;
    }
  });
}

export async function replacePasswordAndSession(db, {
  userId,
  sessionToken,
  expectedPasswordHash,
  password,
  token = createSessionToken(),
  now: nowValue,
  expiresAt: expiresAtValue,
}) {
  assertValidPassword(password);
  const passwordHash = await hashPassword(password);
  const now = getNow(nowValue);
  const expiresAt = getExpiry(now, expiresAtValue);
  const tokenHash = hashSessionToken(token);
  const sessionTokenHash = hashSessionToken(sessionToken);

  return serializeDbOperation(db, async () => {
    let transactionStarted = false;
    try {
      await db.exec('BEGIN IMMEDIATE;');
      transactionStarted = true;
      const currentSession = await db.get(
        `SELECT auth_sessions.userId
         FROM auth_sessions
         JOIN app_users ON app_users.id = auth_sessions.userId
         WHERE auth_sessions.tokenHash = ?
           AND auth_sessions.userId = ?
           AND auth_sessions.expiresAt > ?
           AND app_users.status = 'active'
           AND app_users.passwordHash = ?`,
        sessionTokenHash, userId, now, expectedPasswordHash,
      );
      if (!currentSession) throw new PasswordReplacementError('STALE_SESSION');

      const updateResult = await db.run(
        `UPDATE app_users
         SET passwordHash = ?, mustChangePassword = 0, updatedAt = ?
         WHERE id = ? AND passwordHash = ?`,
        passwordHash, now, userId, expectedPasswordHash,
      );
      if (updateResult.changes !== 1) throw new PasswordReplacementError('STALE_SESSION');
      await db.run('DELETE FROM auth_sessions WHERE userId = ?', userId);
      await db.run(
        `INSERT INTO auth_sessions (tokenHash, userId, createdAt, expiresAt)
         VALUES (?, ?, ?, ?)`,
        tokenHash, userId, now, expiresAt,
      );
      await db.exec('COMMIT;');
      transactionStarted = false;
      return { token, expiresAt };
    } catch (error) {
      await rollback(db, transactionStarted);
      throw error;
    }
  });
}
