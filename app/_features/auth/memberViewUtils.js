export const MEMBER_LIMIT = 5;

export function safeMemberError(response, payload, fallback) {
  if (response.status === 400 || response.status === 409) {
    return typeof payload?.error === 'string' ? payload.error : fallback;
  }
  if (response.status === 403) return '无权管理成员';
  return fallback;
}

export function formatLastLogin(value) {
  if (!value) return '从未登录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
