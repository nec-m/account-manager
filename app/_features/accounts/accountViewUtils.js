import { findTextSeparator, getDefaultExpireDate } from '@/lib/utils';

export const ACCOUNT_FIELDS = [
  { id: 'username', label: '账号' },
  { id: 'password', label: '密码' },
  { id: 'twoFaUrl', label: '2FA地址' },
  { id: 'twoFaKey', label: '2FA Key' },
  { id: 'emailUrl', label: '邮箱地址' },
  { id: 'emailKey', label: '邮箱凭证' },
  { id: 'note', label: '备注' },
  { id: 'ignore', label: '忽略此项' },
];

export function parseAccountLine(lineText, currentFormat, defaults = {}) {
  if (!lineText.trim()) return null;

  const text = lineText.trim();
  const result = {
    site: defaults.site || 'OpenAI',
    username: '',
    password: defaults.password || '',
    expireDate: defaults.expireDate || getDefaultExpireDate(),
    twoFaUrl: defaults.twoFaUrl || '',
    twoFaKey: '',
    emailUrl: defaults.emailUrl || '',
    emailKey: '',
    note: '',
  };

  if (currentFormat && currentFormat.length > 0) {
    const separator = findTextSeparator(text, ['----', '---', ',', '|', ' ']);

    const parts = separator
      ? text.split(separator).map((part) => part.trim()).filter(Boolean)
      : text.split(/[\n\s]+/).filter(Boolean);

    for (let index = 0; index < Math.min(parts.length, currentFormat.length); index += 1) {
      const field = currentFormat[index];
      if (field !== 'ignore' && parts[index]) {
        result[field] = parts[index];
      }
    }
    return result;
  }

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) result.username = emailMatch[0];

  const base32Match = text.match(/\b[A-Z2-7]{16,32}\b/);
  if (base32Match) result.twoFaKey = base32Match[0];

  const urlMatches = text.match(/https?:\/\/[^\s]+/g);
  if (urlMatches) {
    urlMatches.forEach((url) => {
      if (url.includes('2fa') && !result.twoFaUrl) result.twoFaUrl = url;
      else if (!result.emailUrl && !result.twoFaUrl) result.emailUrl = url;
    });
  }

  const separator = findTextSeparator(text, ['----', '---', ',']);
  const partsToScan = separator
    ? text.split(separator).map((part) => part.trim()).filter(Boolean)
    : text.split(/[\n\s]+/).filter(Boolean);

  if (partsToScan.length >= 2) {
    if (!result.username && (partsToScan[0].includes('@') || !partsToScan[0].includes('http'))) {
      result.username = partsToScan[0];
    }

    partsToScan.forEach((part, index) => {
      if (/^[A-Z2-7]{16,32}$/.test(part)) {
        result.twoFaKey = part;
      } else if (/https?:\/\//.test(part)) {
        if (part.includes('2fa')) result.twoFaUrl = part;
        else if (!result.emailUrl) result.emailUrl = part;
      } else if (index === 1 && !part.includes('@') && !part.includes('http') && !result.password) {
        result.password = part;
      }
    });
  }

  return result;
}
