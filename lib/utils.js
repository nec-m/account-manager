/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 */
export function getTodayStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultExpireDate(date = new Date()) {
  const expirationDate = new Date(date);
  expirationDate.setMonth(expirationDate.getMonth() + 1);
  return expirationDate.toISOString().split('T')[0];
}

export function ensureHttpProtocol(url) {
  if (url.startsWith('http')) return url;
  return `https://${url}`;
}

export function findTextSeparator(text, separators) {
  return separators.find((separator) => text.includes(separator)) ?? null;
}

export function getSecretDisplayValue(value, isVisible, mask = '••••••••') {
  if (!value) return '-';
  return isVisible ? value : mask;
}

export function toggleListItem(items, item) {
  if (items.includes(item)) {
    return items.filter((currentItem) => currentItem !== item);
  }
  return [...items, item];
}

/**
 * 判断账号或手机号记录是否处于失效状态 (已归档或已过期)
 */
export function isInvalid(item) {
  if (!item) return false;
  if (item.status === 'archived') return true;
  if (item.expireDate && item.expireDate < getTodayStr()) return true;
  return false;
}
