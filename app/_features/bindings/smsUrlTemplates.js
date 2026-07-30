export function getNormalizedSmsUrlTemplates(phones = []) {
  const rawUrls = (phones || []).map((phone) => phone.smsUrl).filter(Boolean);
  const normalizedMap = new Map();

  rawUrls.forEach((url) => {
    let normalizedUrl = url.trim();
    if (!normalizedUrl) return;

    if (!normalizedUrl.includes('[KEY]') && !normalizedUrl.includes('[PHONE]')) {
      if (/[?&]key=[a-fA-F0-9_-]{8,}/.test(normalizedUrl)) {
        normalizedUrl = normalizedUrl.replace(/([?&]key=)[a-fA-F0-9_-]+/, '$1[KEY]');
      } else if (/\/system\/get_sms\/[a-fA-F0-9_-]{8,}/.test(normalizedUrl)) {
        normalizedUrl = normalizedUrl.replace(/(\/system\/get_sms\/)[a-fA-F0-9_-]+/, '$1[KEY]');
      } else if (/\/[a-fA-F0-9]{16,64}$/.test(normalizedUrl)) {
        normalizedUrl = normalizedUrl.replace(/\/[a-fA-F0-9]{16,64}$/, '/[KEY]');
      }
    }

    normalizedMap.set(normalizedUrl, (normalizedMap.get(normalizedUrl) || 0) + 1);
  });

  return Array.from(normalizedMap.entries())
    .sort((first, second) => second[1] - first[1])
    .map(([url]) => url);
}
