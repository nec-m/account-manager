export class InvalidPhoneBindingError extends Error {
  constructor(phoneId, accountId) {
    super(`Phone ${phoneId} is bound to missing account ${accountId}`);
    this.name = 'InvalidPhoneBindingError';
    this.phoneId = phoneId;
    this.accountId = accountId;
  }
}

function getAccountSnapshot(account) {
  return {
    accountId: account.id,
    siteSnapshot: account.site || '',
    usernameSnapshot: account.username || '',
  };
}

export function getValidHistoryTimestamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function planPhoneAccountHistoryChanges({ previousPhones, nextPhones, nextAccounts }) {
  const accountsById = new Map(nextAccounts.map((account) => [account.id, account]));
  const previousBindingsByPhoneId = new Map(
    previousPhones.map((phone) => [phone.id, phone.boundAccountId]),
  );
  const nextPhoneIds = new Set(nextPhones.map((phone) => phone.id));
  const newBindings = [];

  for (const phone of nextPhones) {
    const accountId = phone.boundAccountId;
    if (!accountId) continue;

    const account = accountsById.get(accountId);
    if (!account) throw new InvalidPhoneBindingError(phone.id, accountId);

    if (previousBindingsByPhoneId.get(phone.id) !== accountId) {
      newBindings.push({ phoneId: phone.id, ...getAccountSnapshot(account) });
    }
  }

  return {
    newBindings,
    accountSnapshots: nextAccounts.map(getAccountSnapshot),
    deletedPhoneIds: previousPhones
      .filter((phone) => !nextPhoneIds.has(phone.id))
      .map((phone) => phone.id),
  };
}

export function getPhoneAccountHistoryForPhone({ phoneId, history, accounts }) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const latestHistoryByAccountId = new Map();

  for (const row of history) {
    if (row.phoneId !== phoneId) continue;
    const timestamp = getValidHistoryTimestamp(row.lastBoundAt);
    const latest = latestHistoryByAccountId.get(row.accountId);
    if (!latest || (timestamp !== null && (latest.timestamp === null || timestamp > latest.timestamp))) {
      latestHistoryByAccountId.set(row.accountId, { row, timestamp });
    }
  }

  return [...latestHistoryByAccountId.values()]
    .sort((left, right) => {
      if (left.timestamp === null) return right.timestamp === null ? 0 : 1;
      if (right.timestamp === null) return -1;
      return right.timestamp - left.timestamp;
    })
    .map(({ row }) => {
      const account = accountsById.get(row.accountId) || null;
      return {
        ...row,
        account,
        site: account ? account.site || '' : row.siteSnapshot || '',
        username: account ? account.username || '' : row.usernameSnapshot || '',
        isDeleted: !account,
      };
    });
}
