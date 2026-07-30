import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthError } from '../lib/auth/service.js';
import { createFetchCodePostHandler } from '../lib/routeHandlers/fetchCode.js';

function createFetchCodeRequest(body, { origin = 'http://localhost' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin !== undefined) headers.Origin = origin;
  return new Request('http://localhost/api/fetch-code', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function authorizeRole(role) {
  return async (roles) => {
    if (!roles.includes(role)) {
      throw new AuthError(403, 'FORBIDDEN', '无权执行此操作');
    }
    return { user: { role } };
  };
}

test('unauthenticated fetch-code never checks input, generates TOTP, or launches a browser', async () => {
  let generated = false;
  let parsed = false;
  const POST = createFetchCodePostHandler({
    authorize: async () => {
      throw new AuthError(401, 'UNAUTHENTICATED', '请先登录');
    },
    generateTotp: async () => {
      generated = true;
    },
  });
  const request = new Request('http://localhost/api/fetch-code', { method: 'POST' });
  Object.defineProperty(request, 'json', {
    value: async () => {
      parsed = true;
      return {};
    },
  });

  const response = await POST(request);

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: '请先登录', code: 'UNAUTHENTICATED' });
  assert.equal(parsed, false);
  assert.equal(generated, false);
});

test('viewer and admin can generate a local TOTP without launching a browser', async () => {
  for (const role of ['viewer', 'admin']) {
    const POST = createFetchCodePostHandler({
      authorize: authorizeRole(role),
      generateTotp: async ({ secret }) => {
        assert.equal(secret, 'ABC123');
        return '123456';
      },
    });

    const response = await POST(createFetchCodeRequest({
      serviceType: '2fa',
      account: { twoFaKey: ' ABC 123 ', twoFaUrl: '' },
    }));

    assert.equal(response.status, 200, role);
    assert.equal(response.headers.get('cache-control'), 'no-store', role);
    assert.deepEqual(await response.json(), {
      success: true,
      code: '123456',
      message: '获取 2FA 成功',
    });
  }
});

test('fetch-code rejects a missing Origin before parsing JSON or starting side effects', async () => {
  let generated = false;
  let parsed = false;
  const POST = createFetchCodePostHandler({
    authorize: authorizeRole('viewer'),
    generateTotp: async () => {
      generated = true;
    },
  });
  const request = new Request('http://localhost/api/fetch-code', { method: 'POST' });
  Object.defineProperty(request, 'json', {
    value: async () => {
      parsed = true;
      return {};
    },
  });

  const response = await POST(request);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: '请求来源无效', code: 'INVALID_ORIGIN' });
  assert.equal(parsed, false);
  assert.equal(generated, false);
});

test('configured webpage sources ask the user to open them in a browser', async () => {
  const cases = [
    {
      body: { serviceType: '2fa', account: { twoFaKey: 'ABC123', twoFaUrl: 'https://2fa.example.invalid' } },
      expectedMessage: '请在浏览器中打开已配置的网页',
    },
    { body: { serviceType: 'email', account: { emailUrl: 'https://mail.example.invalid' } }, expectedMessage: '请在浏览器中打开已配置的网页' },
    { body: { serviceType: 'sms', phone: { smsUrl: 'https://sms.example.invalid' } }, expectedMessage: '请在浏览器中打开已配置的网页' },
  ];

  for (const { body, expectedMessage } of cases) {
    const POST = createFetchCodePostHandler({
      authorize: authorizeRole('viewer'),
      generateTotp: async () => assert.fail('browser-backed flow generated TOTP'),
    });

    const response = await POST(createFetchCodeRequest(body));

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      error: expectedMessage,
      code: 'CODE_SOURCE_NOT_CONFIGURED',
    });
  }
});

test('missing 2FA, email, and SMS sources return a configuration error without browser work', async () => {
  const cases = [
    { serviceType: '2fa', account: {} },
    { serviceType: 'email', account: {} },
    { serviceType: 'sms', phone: {} },
  ];

  for (const body of cases) {
    const POST = createFetchCodePostHandler({
      authorize: authorizeRole('admin'),
      generateTotp: async () => assert.fail('missing-source flow generated TOTP'),
    });

    const response = await POST(createFetchCodeRequest(body));

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      error: '未配置验证码来源',
      code: 'CODE_SOURCE_NOT_CONFIGURED',
    });
  }
});

test('TOTP failures return a generic error without logging downstream secrets', async (t) => {
  const logged = [];
  t.mock.method(console, 'error', (...args) => logged.push(args));
  const POST = createFetchCodePostHandler({
    authorize: authorizeRole('admin'),
    generateTotp: async () => {
      throw new Error('credential=TOP_SECRET');
    },
  });

  const response = await POST(createFetchCodeRequest({ serviceType: '2fa', account: { twoFaKey: 'ABC123' } }));

  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: '获取失败' });
  assert.deepEqual(logged, [['[fetch-code] FETCH_FAILED']]);
  assert.doesNotMatch(JSON.stringify(logged), /TOP_SECRET|credential=/);
});
