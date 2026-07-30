import { isInvalid } from '../../../lib/utils.js';

export function normalizeDataPayload(payload = {}) {
  return {
    accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
    phones: Array.isArray(payload.phones) ? payload.phones : [],
    phoneAccountHistory: Array.isArray(payload.phoneAccountHistory) ? payload.phoneAccountHistory : [],
  };
}

export function getDashboardCounts(data) {
  const validAccountsCount = data.accounts?.filter(account => !isInvalid(account)).length || 0;
  const validPhonesCount = data.phones?.filter(phone => !isInvalid(phone)).length || 0;
  const idlePhonesCount = data.phones?.filter(phone => !isInvalid(phone) && !phone.boundAccountId).length || 0;
  const invalidCount = (data.accounts?.filter(isInvalid).length || 0) + (data.phones?.filter(isInvalid).length || 0);

  return {
    validAccountsCount,
    validPhonesCount,
    idlePhonesCount,
    invalidCount,
  };
}
