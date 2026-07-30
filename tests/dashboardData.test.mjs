import assert from 'node:assert/strict';
import test from 'node:test';
import { getDashboardCounts, normalizeDataPayload } from '../app/_features/dashboard/dashboardData.js';

test('normalizeDataPayload keeps only supported array fields', () => {
  const accounts = [{ id: 'account-1' }];
  const phones = [{ id: 'phone-1' }];
  const phoneAccountHistory = [{ phoneId: 'phone-1', accountId: 'account-1' }];

  assert.deepEqual(normalizeDataPayload({
    accounts,
    phones,
    phoneAccountHistory,
    extra: ['must-not-be-returned'],
  }), {
    accounts,
    phones,
    phoneAccountHistory,
  });
});

test('normalizeDataPayload falls back to empty arrays for malformed or missing fields', () => {
  assert.deepEqual(normalizeDataPayload({
    accounts: { id: 'not-an-array' },
    phones: null,
    phoneAccountHistory: 'not-an-array',
  }), {
    accounts: [],
    phones: [],
    phoneAccountHistory: [],
  });
  assert.deepEqual(normalizeDataPayload(), {
    accounts: [],
    phones: [],
    phoneAccountHistory: [],
  });
});

test('getDashboardCounts separates valid, idle, and invalid records', () => {
  const counts = getDashboardCounts({
    accounts: [
      { id: 'account-active', status: 'active' },
      { id: 'account-archived', status: 'archived' },
    ],
    phones: [
      { id: 'phone-idle', status: 'active' },
      { id: 'phone-bound', status: 'active', boundAccountId: 'account-active' },
      { id: 'phone-archived', status: 'archived' },
    ],
  });

  assert.deepEqual(counts, {
    validAccountsCount: 1,
    validPhonesCount: 2,
    idlePhonesCount: 1,
    invalidCount: 2,
  });
});
