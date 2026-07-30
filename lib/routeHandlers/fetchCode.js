import { assertSameOrigin, jsonNoStore, toAuthErrorResponse } from '../auth/http.js';
import { AuthError } from '../auth/service.js';

export function createFetchCodePostHandler({
  authorize,
  generateTotp,
}) {
  return async function POST(request) {
    try {
      await authorize(['viewer', 'admin']);
      assertSameOrigin(request);
      const { serviceType, account, phone } = await request.json();

      if (serviceType === '2fa' && account?.twoFaKey && !account.twoFaUrl) {
        const token = await generateTotp({ secret: account.twoFaKey.replace(/\s+/g, '') });
        return jsonNoStore({ success: true, code: token, message: '获取 2FA 成功' });
      }

      const webpageConfigured = serviceType === '2fa'
        ? Boolean(account?.twoFaUrl)
        : serviceType === 'email'
          ? Boolean(account?.emailUrl)
          : serviceType === 'sms'
            ? Boolean(phone?.smsUrl)
            : false;

      if (webpageConfigured) {
        return jsonNoStore({
          error: '请在浏览器中打开已配置的网页',
          code: 'CODE_SOURCE_NOT_CONFIGURED',
        }, { status: 400 });
      }

      return jsonNoStore({
        error: '未配置验证码来源',
        code: 'CODE_SOURCE_NOT_CONFIGURED',
      }, { status: 400 });
    } catch (error) {
      if (error instanceof AuthError) return toAuthErrorResponse(error);
      console.error('[fetch-code] FETCH_FAILED');
      return jsonNoStore({ error: '获取失败' }, { status: 500 });
    }
  };
}
