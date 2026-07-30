import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { AuthError } from '../lib/auth/service.js';
import { createDataRouteHandlers } from '../lib/routeHandlers/data.js';
import {
  initializeSchema,
  readDataFromDb,
  writeDataToDb,
} from '../lib/db.js';
import {
  getValidHistoryTimestamp,
  getPhoneAccountHistoryForPhone,
  InvalidPhoneBindingError,
  planPhoneAccountHistoryChanges,
} from '../lib/phoneAccountHistory.js';

async function createTestDb(t) {
  const db = await open({ filename: ':memory:', driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');
  await initializeSchema(db);
  t.after(() => db.close());
  return db;
}

function account(overrides = {}) {
  return { id: 'account-a', site: 'Alpha', username: 'alpha@example.invalid', ...overrides };
}

function phone(overrides = {}) {
  return { id: 'phone-a', number: '+1 202-555-0104', boundAccountId: null, ...overrides };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createAuthorizedRouteHandlers(db, { now = '2026-07-27T09:00:00.000Z' } = {}) {
  return createDataRouteHandlers({
    readData: () => readDataFromDb(db),
    writeData: (data) => writeDataToDb(db, data, { now }),
    authorize: async (roles) => {
      assert.ok(roles.includes('admin'));
      return { user: { role: 'admin' } };
    },
    verifyOrigin: () => {},
  });
}

const sensitiveFixture = {
  accounts: [account({ password: 'account-secret' })],
  phones: [phone({ smsKey: 'sms-secret' })],
  phoneAccountHistory: [],
};

function createHandlersForRole(role) {
  return createDataRouteHandlers({
    readData: async () => sensitiveFixture,
    writeData: async (data) => data,
    authorize: async (roles) => {
      if (!roles.includes(role)) {
        throw new AuthError(403, 'FORBIDDEN', '无权执行此操作');
      }
      return { user: { role } };
    },
    verifyOrigin: () => {},
  });
}

function createDataRequest(data) {
  return new Request('http://localhost/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

test('planner records only new bindings and identifies deleted phones', () => {
  const result = planPhoneAccountHistoryChanges({
    previousPhones: [
      { id: 'unchanged', boundAccountId: 'account-a' },
      { id: 'new-a', boundAccountId: null },
      { id: 'changed', boundAccountId: 'account-a' },
      { id: 'unbound', boundAccountId: 'account-a' },
      { id: 'deleted', boundAccountId: 'account-a' },
    ],
    nextPhones: [
      { id: 'unchanged', boundAccountId: 'account-a' },
      { id: 'new-a', boundAccountId: 'account-a' },
      { id: 'changed', boundAccountId: 'account-b' },
      { id: 'unbound', boundAccountId: null },
    ],
    nextAccounts: [
      { id: 'account-a', site: 'Alpha', username: 'alpha@example.invalid' },
      { id: 'account-b', site: 'Beta', username: 'beta@example.invalid' },
      { id: 'account-c' },
    ],
  });

  assert.deepEqual(result, {
    newBindings: [
      {
        phoneId: 'new-a',
        accountId: 'account-a',
        siteSnapshot: 'Alpha',
        usernameSnapshot: 'alpha@example.invalid',
      },
      {
        phoneId: 'changed',
        accountId: 'account-b',
        siteSnapshot: 'Beta',
        usernameSnapshot: 'beta@example.invalid',
      },
    ],
    accountSnapshots: [
      { accountId: 'account-a', siteSnapshot: 'Alpha', usernameSnapshot: 'alpha@example.invalid' },
      { accountId: 'account-b', siteSnapshot: 'Beta', usernameSnapshot: 'beta@example.invalid' },
      { accountId: 'account-c', siteSnapshot: '', usernameSnapshot: '' },
    ],
    deletedPhoneIds: ['deleted'],
  });
});

test('planner records a newly created phone that is already bound', () => {
  const result = planPhoneAccountHistoryChanges({
    previousPhones: [],
    nextPhones: [{ id: 'new-phone', boundAccountId: 'account-a' }],
    nextAccounts: [{ id: 'account-a', site: 'Alpha', username: 'alpha@example.invalid' }],
  });

  assert.deepEqual(result.newBindings, [{
    phoneId: 'new-phone',
    accountId: 'account-a',
    siteSnapshot: 'Alpha',
    usernameSnapshot: 'alpha@example.invalid',
  }]);
});

test('planner rejects a binding that does not target a next account', () => {
  assert.throws(
    () => planPhoneAccountHistoryChanges({
      previousPhones: [],
      nextPhones: [{ id: 'phone-a', boundAccountId: 'missing-account' }],
      nextAccounts: [],
    }),
    (error) => error instanceof InvalidPhoneBindingError
      && error.phoneId === 'phone-a'
      && error.accountId === 'missing-account',
  );
});

test('resolver returns current and deleted account summaries ordered by recent binding', () => {
  const currentAccount = {
    id: 'account-a',
    site: 'Current Alpha',
    username: 'current-alpha@example.invalid',
  };
  const result = getPhoneAccountHistoryForPhone({
    phoneId: 'phone-a',
    history: [
      {
        phoneId: 'phone-a', accountId: 'account-a', siteSnapshot: 'Old Alpha',
        usernameSnapshot: 'old-alpha@example.invalid', firstBoundAt: '2026-07-27T01:00:00.000Z',
        lastBoundAt: '2026-07-27T02:00:00.000Z',
      },
      {
        phoneId: 'phone-a', accountId: 'account-a', siteSnapshot: 'Newest Alpha',
        usernameSnapshot: 'newest-alpha@example.invalid', firstBoundAt: '2026-07-27T01:00:00.000Z',
        lastBoundAt: '2026-07-27T05:00:00.000Z',
      },
      {
        phoneId: 'phone-a', accountId: 'deleted-account', siteSnapshot: 'Deleted Site',
        usernameSnapshot: 'deleted@example.invalid', firstBoundAt: '2026-07-27T03:00:00.000Z',
        lastBoundAt: '2026-07-27T04:00:00.000Z',
      },
      {
        phoneId: 'phone-b', accountId: 'other-phone-account', siteSnapshot: 'Other Site',
        usernameSnapshot: 'other@example.invalid', firstBoundAt: '2026-07-27T04:00:00.000Z',
        lastBoundAt: '2026-07-27T06:00:00.000Z',
      },
    ],
    accounts: [currentAccount],
  });

  assert.deepEqual(result, [
    {
      phoneId: 'phone-a', accountId: 'account-a', siteSnapshot: 'Newest Alpha',
      usernameSnapshot: 'newest-alpha@example.invalid', firstBoundAt: '2026-07-27T01:00:00.000Z',
      lastBoundAt: '2026-07-27T05:00:00.000Z', account: currentAccount,
      site: 'Current Alpha', username: 'current-alpha@example.invalid', isDeleted: false,
    },
    {
      phoneId: 'phone-a', accountId: 'deleted-account', siteSnapshot: 'Deleted Site',
      usernameSnapshot: 'deleted@example.invalid', firstBoundAt: '2026-07-27T03:00:00.000Z',
      lastBoundAt: '2026-07-27T04:00:00.000Z', account: null,
      site: 'Deleted Site', username: 'deleted@example.invalid', isDeleted: true,
    },
  ]);
});

test('resolver uses empty current account fields instead of stale snapshots', () => {
  const result = getPhoneAccountHistoryForPhone({
    phoneId: 'phone-a',
    history: [{
      phoneId: 'phone-a', accountId: 'account-a', siteSnapshot: 'Former Site',
      usernameSnapshot: 'former@example.invalid', firstBoundAt: '2026-07-27T01:00:00.000Z',
      lastBoundAt: '2026-07-27T02:00:00.000Z',
    }],
    accounts: [{ id: 'account-a', site: '', username: '' }],
  });

  assert.deepEqual(
    { site: result[0].site, username: result[0].username, isDeleted: result[0].isDeleted },
    { site: '', username: '', isDeleted: false },
  );
});

test('history timestamp validator rejects unsafe values and preserves valid ISO timestamps', () => {
  const validIso = '2026-07-27T05:00:00.000Z';

  assert.equal(getValidHistoryTimestamp('not-a-time'), null);
  assert.equal(getValidHistoryTimestamp(undefined), null);
  assert.equal(getValidHistoryTimestamp(true), null);
  assert.equal(getValidHistoryTimestamp(Symbol('timestamp')), null);
  assert.equal(getValidHistoryTimestamp(1n), null);
  assert.equal(getValidHistoryTimestamp(validIso), Date.parse(validIso));
});

test('resolver prefers valid recent bindings and places invalid timestamps last', () => {
  const result = getPhoneAccountHistoryForPhone({
    phoneId: 'phone-a',
    history: [
      {
        phoneId: 'phone-a', accountId: 'account-a', siteSnapshot: 'Invalid Alpha',
        usernameSnapshot: 'invalid-alpha@example.invalid', lastBoundAt: 'not-a-time',
      },
      {
        phoneId: 'phone-a', accountId: 'account-a', siteSnapshot: 'Current Alpha',
        usernameSnapshot: 'current-alpha@example.invalid', lastBoundAt: '2026-07-27T05:00:00.000Z',
      },
      {
        phoneId: 'phone-a', accountId: 'account-b', siteSnapshot: 'Beta',
        usernameSnapshot: 'beta@example.invalid', lastBoundAt: '2026-07-27T04:00:00.000Z',
      },
      {
        phoneId: 'phone-a', accountId: 'account-c', siteSnapshot: 'Gamma',
        usernameSnapshot: 'gamma@example.invalid',
      },
      {
        phoneId: 'phone-a', accountId: 'account-d', siteSnapshot: 'Delta',
        usernameSnapshot: 'delta@example.invalid', lastBoundAt: 'still-not-a-time',
      },
    ],
    accounts: [],
  });

  assert.deepEqual(
    result.map((row) => ({ accountId: row.accountId, lastBoundAt: row.lastBoundAt })),
    [
      { accountId: 'account-a', lastBoundAt: '2026-07-27T05:00:00.000Z' },
      { accountId: 'account-b', lastBoundAt: '2026-07-27T04:00:00.000Z' },
      { accountId: 'account-c', lastBoundAt: undefined },
      { accountId: 'account-d', lastBoundAt: 'still-not-a-time' },
    ],
  );
});

test('persistence records a re-bound relation once and preserves its first binding time', async (t) => {
  const db = await createTestDb(t);
  const initialData = { accounts: [account()], phones: [phone()] };

  await writeDataToDb(db, initialData, { now: '2026-07-27T01:00:00.000Z' });
  await writeDataToDb(db, {
    accounts: [account()],
    phones: [phone({ boundAccountId: 'account-a' })],
  }, { now: '2026-07-27T02:00:00.000Z' });
  await writeDataToDb(db, initialData, { now: '2026-07-27T03:00:00.000Z' });
  await writeDataToDb(db, {
    accounts: [account()],
    phones: [phone({ boundAccountId: 'account-a' })],
  }, { now: '2026-07-27T04:00:00.000Z' });

  assert.deepEqual((await readDataFromDb(db)).phoneAccountHistory, [{
    phoneId: 'phone-a',
    accountId: 'account-a',
    siteSnapshot: 'Alpha',
    usernameSnapshot: 'alpha@example.invalid',
    firstBoundAt: '2026-07-27T02:00:00.000Z',
    lastBoundAt: '2026-07-27T04:00:00.000Z',
  }]);
});

test('persistence does not create history for an unchanged manually seeded binding', async (t) => {
  const db = await createTestDb(t);
  await db.run('INSERT INTO accounts (id, site, username) VALUES (?, ?, ?)', 'account-a', 'Alpha', 'alpha@example.invalid');
  await db.run('INSERT INTO phones (id, number, boundAccountId) VALUES (?, ?, ?)', 'phone-a', '+1 202-555-0104', 'account-a');

  await writeDataToDb(db, {
    accounts: [account()],
    phones: [phone({ boundAccountId: 'account-a' })],
  }, { now: '2026-07-27T02:00:00.000Z' });

  assert.deepEqual((await readDataFromDb(db)).phoneAccountHistory, []);
});

test('persistence rejects missing bindings without changing phones or history', async (t) => {
  const db = await createTestDb(t);
  await writeDataToDb(db, {
    accounts: [account()],
    phones: [phone({ boundAccountId: 'account-a' })],
  }, { now: '2026-07-27T01:00:00.000Z' });
  const before = await readDataFromDb(db);

  await assert.rejects(
    writeDataToDb(db, {
      accounts: [],
      phones: [phone({ smsUrl: 'https://changed.example.invalid', boundAccountId: 'missing-account' })],
    }, { now: '2026-07-27T02:00:00.000Z' }),
    (error) => error instanceof InvalidPhoneBindingError
      && error.phoneId === 'phone-a'
      && error.accountId === 'missing-account',
  );

  assert.deepEqual(await readDataFromDb(db), before);
});

test('persistence refreshes current snapshots, retains deleted accounts, and removes deleted phone history', async (t) => {
  const db = await createTestDb(t);
  await writeDataToDb(db, {
    accounts: [account()],
    phones: [phone({ boundAccountId: 'account-a' })],
  }, { now: '2026-07-27T01:00:00.000Z' });
  await writeDataToDb(db, {
    accounts: [account({ site: 'Renamed Alpha', username: 'renamed@example.invalid' })],
    phones: [phone({ boundAccountId: 'account-a' })],
  }, { now: '2026-07-27T02:00:00.000Z' });

  let history = (await readDataFromDb(db)).phoneAccountHistory;
  assert.deepEqual(history, [{
    phoneId: 'phone-a',
    accountId: 'account-a',
    siteSnapshot: 'Renamed Alpha',
    usernameSnapshot: 'renamed@example.invalid',
    firstBoundAt: '2026-07-27T01:00:00.000Z',
    lastBoundAt: '2026-07-27T01:00:00.000Z',
  }]);

  await writeDataToDb(db, { accounts: [], phones: [phone()] }, { now: '2026-07-27T03:00:00.000Z' });
  history = (await readDataFromDb(db)).phoneAccountHistory;
  assert.equal(history[0].siteSnapshot, 'Renamed Alpha');
  assert.equal(history[0].usernameSnapshot, 'renamed@example.invalid');
  assert.equal(history[0].lastBoundAt, '2026-07-27T01:00:00.000Z');

  await writeDataToDb(db, { accounts: [], phones: [] }, { now: '2026-07-27T04:00:00.000Z' });
  assert.deepEqual((await readDataFromDb(db)).phoneAccountHistory, []);
});

test('concurrent writes on one SQLite connection complete serially', async (t) => {
  const db = await createTestDb(t);
  const firstAccount = account({ id: 'account-first', username: 'first@example.invalid' });
  const secondAccount = account({ id: 'account-second', username: 'second@example.invalid' });

  const firstWrite = writeDataToDb(db, {
    accounts: [firstAccount, secondAccount],
    phones: [phone({ id: 'phone-shared', boundAccountId: firstAccount.id })],
  }, { now: '2026-07-27T05:00:00.000Z' });
  const secondWrite = writeDataToDb(db, {
    accounts: [firstAccount, secondAccount],
    phones: [phone({ id: 'phone-shared', boundAccountId: secondAccount.id })],
  }, { now: '2026-07-27T06:00:00.000Z' });

  const writeResults = await Promise.allSettled([firstWrite, secondWrite]);
  assert.deepEqual(
    writeResults.map(({ status }) => status),
    ['fulfilled', 'fulfilled'],
    writeResults.find(({ status }) => status === 'rejected')?.reason?.message,
  );

  const result = await readDataFromDb(db);
  assert.deepEqual(result.accounts.map(({ id }) => id), ['account-first', 'account-second']);
  assert.deepEqual(result.phones.map(({ id }) => id), ['phone-shared']);
  assert.deepEqual(
    result.phoneAccountHistory.map(({ phoneId, accountId }) => ({ phoneId, accountId })),
    [
      { phoneId: 'phone-shared', accountId: 'account-second' },
      { phoneId: 'phone-shared', accountId: 'account-first' },
    ],
  );
});

test('a read sharing a SQLite connection never crosses a write commit', async (t) => {
  const db = await createTestDb(t);
  const oldAccount = account({ id: 'account-old', site: 'Old Site', username: 'old@example.invalid' });
  const newAccount = account({ id: 'account-new', site: 'New Site', username: 'new@example.invalid' });

  await writeDataToDb(db, {
    accounts: [oldAccount],
    phones: [phone({ id: 'phone-old', boundAccountId: oldAccount.id })],
  }, { now: '2026-07-27T07:00:00.000Z' });
  const oldSnapshot = await readDataFromDb(db);

  const readPaused = createDeferred();
  const allowReadToContinue = createDeferred();
  const writerCommitted = createDeferred();
  const originalAll = db.all.bind(db);
  const originalExec = db.exec.bind(db);
  let pausedAccountsRead = false;

  db.all = async (sql, ...params) => {
    const rows = await originalAll(sql, ...params);
    if (!pausedAccountsRead && /^\s*SELECT \* FROM accounts\b/i.test(String(sql))) {
      pausedAccountsRead = true;
      readPaused.resolve();
      await allowReadToContinue.promise;
    }
    return rows;
  };
  db.exec = async (sql, ...params) => {
    const result = await originalExec(sql, ...params);
    if (/^\s*COMMIT\b/i.test(String(sql))) writerCommitted.resolve();
    return result;
  };

  try {
    const readPromise = readDataFromDb(db);
    await readPaused.promise;

    const writePromise = writeDataToDb(db, {
      accounts: [newAccount],
      phones: [phone({ id: 'phone-new', boundAccountId: newAccount.id })],
    }, { now: '2026-07-27T08:00:00.000Z' });

    await Promise.race([
      writerCommitted.promise,
      new Promise((resolve) => setTimeout(resolve, 250)),
    ]);
    allowReadToContinue.resolve();

    const [observedSnapshot, newSnapshot] = await Promise.all([readPromise, writePromise]);
    assert.ok(
      isDeepStrictEqual(observedSnapshot, oldSnapshot)
        || isDeepStrictEqual(observedSnapshot, newSnapshot),
      `read returned a mixed snapshot: ${JSON.stringify(observedSnapshot)}`,
    );
  } finally {
    allowReadToContinue.resolve();
    db.all = originalAll;
    db.exec = originalExec;
  }
});

test('data route ignores submitted history and returns the committed server state', async (t) => {
  const db = await createTestDb(t);
  const { POST } = createAuthorizedRouteHandlers(db);
  const savedAccount = account({ id: 'route-account', username: 'route@example.invalid' });
  const submittedData = {
    accounts: [savedAccount],
    phones: [phone({ id: 'route-phone', boundAccountId: savedAccount.id })],
    phoneAccountHistory: [{
      phoneId: 'forged-phone',
      accountId: 'forged-account',
      siteSnapshot: 'Forged Site',
      usernameSnapshot: 'forged@example.invalid',
      firstBoundAt: '1900-01-01T00:00:00.000Z',
      lastBoundAt: '2999-01-01T00:00:00.000Z',
    }],
  };

  const response = await POST(createDataRequest(submittedData));
  const body = await response.json();
  const committedData = await readDataFromDb(db);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.success, true);
  assert.deepEqual(body.data, committedData);
  assert.deepEqual(body.data.phoneAccountHistory, [{
    phoneId: 'route-phone',
    accountId: 'route-account',
    siteSnapshot: 'Alpha',
    usernameSnapshot: 'route@example.invalid',
    firstBoundAt: '2026-07-27T09:00:00.000Z',
    lastBoundAt: '2026-07-27T09:00:00.000Z',
  }]);
});

test('data route rejects anonymous reads and viewer writes before touching protected inputs', async () => {
  let read = false;
  const anonymous = createDataRouteHandlers({
    readData: async () => {
      read = true;
      return sensitiveFixture;
    },
    writeData: async () => sensitiveFixture,
    authorize: async () => {
      throw new AuthError(401, 'UNAUTHENTICATED', '请先登录');
    },
    verifyOrigin: () => {},
  });

  const anonymousResponse = await anonymous.GET();
  assert.equal(anonymousResponse.status, 401);
  assert.equal(anonymousResponse.headers.get('cache-control'), 'no-store');
  assert.equal(read, false);

  let parsed = false;
  const viewer = createHandlersForRole('viewer');
  const viewerReadResponse = await viewer.GET();
  const viewerWriteResponse = await viewer.POST({
    json: async () => {
      parsed = true;
      return sensitiveFixture;
    },
  });

  assert.equal(viewerReadResponse.status, 200);
  assert.equal(viewerReadResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await viewerReadResponse.json(), sensitiveFixture);
  assert.equal(viewerWriteResponse.status, 403);
  assert.equal(parsed, false);
});

test('data route returns 400 for a missing binding without changing SQLite state', async (t) => {
  const db = await createTestDb(t);
  await writeDataToDb(db, {
    accounts: [account()],
    phones: [phone()],
  }, { now: '2026-07-27T10:00:00.000Z' });
  const before = await readDataFromDb(db);
  const { POST } = createAuthorizedRouteHandlers(db);

  const response = await POST(createDataRequest({
    accounts: [],
    phones: [phone({ boundAccountId: 'missing-account' })],
    phoneAccountHistory: [],
  }));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /missing-account/);
  assert.deepEqual(await readDataFromDb(db), before);
});

test('data route returns 500 and rolls back all partial writes on transaction failure', async (t) => {
  const db = await createTestDb(t);
  const oldAccount = account({ id: 'route-old-account', username: 'old-route@example.invalid' });
  await writeDataToDb(db, {
    accounts: [oldAccount],
    phones: [phone({ id: 'route-old-phone', number: '+1 202-555-0197', boundAccountId: oldAccount.id })],
  }, { now: '2026-07-27T11:00:00.000Z' });
  const before = await readDataFromDb(db);
  await db.exec(`
    CREATE TRIGGER fail_route_account_delete
    BEFORE DELETE ON accounts
    WHEN OLD.id = 'route-old-account'
    BEGIN
      SELECT RAISE(ABORT, 'forced route transaction failure');
    END;
  `);
  const { POST } = createAuthorizedRouteHandlers(db);
  const newAccount = account({ id: 'route-new-account', username: 'new-route@example.invalid' });

  const response = await POST(createDataRequest({
    accounts: [newAccount],
    phones: [phone({
      id: 'route-new-phone',
      number: '+1 202-555-0198',
      boundAccountId: newAccount.id,
    })],
    phoneAccountHistory: [],
  }));
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.deepEqual(body, { error: 'Failed to write data' });
  assert.deepEqual(await readDataFromDb(db), before);
});
