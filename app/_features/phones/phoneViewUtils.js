import { findTextSeparator, getDefaultExpireDate } from '@/lib/utils';

export const PHONE_FIELDS = [
  { id: 'number', label: '手机号' },
  { id: 'smsUrl', label: '短信获取地址' },
  { id: 'smsKey', label: '短信凭证(Key)' },
  { id: 'note', label: '备注' },
  { id: 'ignore', label: '忽略此项' },
];

export function parsePhoneLine(text, parseFormat, defaults = {}) {
  if (!text.trim()) return null;

  if (parseFormat.length > 0) {
    const separator = findTextSeparator(text, ['----', '---', ',', '|', ' ']);

    const parts = separator ? text.split(separator).map((part) => part.trim()) : [text];
    const parsed = { ...defaults };
    for (let index = 0; index < Math.min(parts.length, parseFormat.length); index++) {
      const field = parseFormat[index];
      if (field !== 'ignore' && parts[index]) parsed[field] = parts[index];
    }
    return parsed;
  }

  const parsed = { ...defaults };
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  if (urlMatch) parsed.smsUrl = urlMatch[0];

  const phoneMatch = text.match(/\+\d{1,4}\s?\d{6,14}|\b1[3-9]\d{9}\b/);
  if (phoneMatch && !parsed.number) parsed.number = phoneMatch[0].trim();

  const separator = findTextSeparator(text, ['----', '---', ',']);
  if (separator) {
    text.split(separator).map((part) => part.trim()).forEach((part) => {
      if (/https?:\/\//.test(part)) parsed.smsUrl = part;
      else if (part.startsWith('+') || /^\d{11}$/.test(part)) parsed.number = part;
      else if (part.length > 3 && !part.includes('http')) parsed.smsKey = part;
    });
  }

  return parsed;
}

export function parsePhoneBatch(text, parseFormat, defaults = {}) {
  if (!text.trim()) return [];

  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    let item = {
      number: '',
      smsUrl: defaults.smsUrl || '',
      smsKey: '',
      expireDate: defaults.expireDate || getDefaultExpireDate(),
      note: '',
    };

    if (parseFormat.length > 0) {
      const separator = findTextSeparator(line, ['----', '---', ',', '|']) || ' ';
      const parts = line.split(separator).map((part) => part.trim());
      for (let index = 0; index < Math.min(parts.length, parseFormat.length); index++) {
        const field = parseFormat[index];
        if (field !== 'ignore' && parts[index]) item[field] = parts[index];
      }
    } else {
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      if (urlMatch) item.smsUrl = urlMatch[0];

      const phoneMatch = line.match(/\+\d{1,4}\s?\d{6,14}|\b1[3-9]\d{9}\b/);
      if (phoneMatch) item.number = phoneMatch[0].trim();

      const separator = findTextSeparator(line, ['----', '---', ',']);
      if (separator) {
        line.split(separator).map((part) => part.trim()).forEach((part) => {
          if (/https?:\/\//.test(part)) item.smsUrl = part;
          else if (part.startsWith('+') || /^\d{11}$/.test(part)) item.number = part;
          else if (part.length > 3 && !part.includes('http') && !item.smsKey) item.smsKey = part;
        });
      } else if (!item.number && !item.smsUrl) {
        const cleanNumber = line.trim();
        if (cleanNumber.length >= 5) item.number = cleanNumber;
      }
    }

    if (!item.smsUrl && defaults.smsUrl) item.smsUrl = defaults.smsUrl;
    if (!item.expireDate && defaults.expireDate) item.expireDate = defaults.expireDate;
    return item;
  });
}
