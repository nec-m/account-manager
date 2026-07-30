import { AuthError } from './service.js';

export function assertSameOrigin(request) {
  if (new URL(request.url).origin !== request.headers.get('origin')) {
    throw new AuthError(403, 'INVALID_ORIGIN', '请求来源无效');
  }
}

export async function readJsonObject(request) {
  try {
    const body = await request.json();
    if (body === null || Array.isArray(body) || typeof body !== 'object') {
      throw new Error();
    }
    return body;
  } catch {
    throw new AuthError(400, 'INVALID_REQUEST', '请求内容无效');
  }
}

export function jsonNoStore(body, { status = 200, headers } = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers: responseHeaders });
}

export function toAuthErrorResponse(error) {
  if (error instanceof AuthError) {
    return jsonNoStore(
      { error: error.message, code: error.code },
      { status: error.status, headers: error.headers },
    );
  }
  return jsonNoStore(
    { error: '服务器内部错误', code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
