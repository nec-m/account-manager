import assert from 'node:assert/strict';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import {
  initializeSchema,
  readDataFromDb,
  writeDataToDb,
} from '../lib/db.js';

async function createMemoryDb(t, { initialize = true } = {}) {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  t.after(() => db.close());
  if (initialize) await initializeSchema(db);
  return db;
}

test('initializeSchema adds note columns to existing account and phone tables', async (t) => {
  const db = await createMemoryDb(t, { initialize: false });
  await db.exec(`
    CREATE TABLE accounts (id TEXT PRIMARY KEY, archivedPhoneSnapshot TEXT DEFAULT '');
    CREATE TABLE phones (id TEXT PRIMARY KEY);
    INSERT INTO accounts (id) VALUES ('legacy-account');
    INSERT INTO phones (id) VALUES ('legacy-phone');
  `);

  await initializeSchema(db);

  assert.ok((await db.all('PRAGMA table_info(accounts)')).some(({ name }) => name === 'note'));
  assert.ok((await db.all('PRAGMA table_info(phones)')).some(({ name }) => name === 'note'));
  assert.equal((await db.get("SELECT note FROM accounts WHERE id = 'legacy-account'")).note, '');
  assert.equal((await db.get("SELECT note FROM phones WHERE id = 'legacy-phone'")).note, '');
});

test('writeDataToDb preserves account and phone notes', async (t) => {
  const db = await createMemoryDb(t);
  const result = await writeDataToDb(db, {
    accounts: [{ id: 'account-note', note: 'account memo' }],
    phones: [{ id: 'phone-note', note: 'phone memo', boundAccountId: null }],
  });

  assert.equal(result.accounts[0].note, 'account memo');
  assert.equal(result.phones[0].note, 'phone memo');

  const persisted = await readDataFromDb(db);
  assert.equal(persisted.accounts[0].note, 'account memo');
  assert.equal(persisted.phones[0].note, 'phone memo');
});
