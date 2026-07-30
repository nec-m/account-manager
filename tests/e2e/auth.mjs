import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SANITIZED_UI_FIXTURE,
  loginThroughForm,
  openFixturePage,
  openReadyPage,
  waitForRequestCount,
} from '../support/ui-e2e-harness.mjs';

test('匿名页面先登录再串行加载敏感数据', async () => {
  const requestedPaths = [];
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    authenticated: false,
    requestedPaths,
    waitForData: false,
  });

  assert.match(await page.$eval('body', (body) => body.innerText), /登录账号管家/);
  assert.equal(requestedPaths.includes('/api/data'), false);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'login-username');
  await page.type('#login-username', 'owner');
  await page.type('#login-password', 'owner-pass-123');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('账号资源'));
  assert.equal(requestedPaths.includes('/api/data'), true);
  await page.close();
});

test('登录页统一显示凭证错误并可切换密码可见性', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    authenticated: false,
    waitForData: false,
  });

  assert.equal(await page.$eval('#login-password', (input) => input.type), 'password');
  await page.click('button[title="显示密码"]');
  assert.equal(await page.$eval('#login-password', (input) => input.type), 'text');
  await page.type('#login-username', 'viewer');
  await page.type('#login-password', 'wrong-password');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('用户名或密码不正确'));
  assert.equal(await page.$eval('[aria-live="polite"]', (region) => region.textContent.trim()), '用户名或密码不正确');
  await page.close();
});

test('登录提交期间禁止重复请求', async () => {
  const requestedPaths = [];
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    authenticated: false,
    requestedPaths,
    responseDelays: { '/api/auth/login': 250 },
    waitForData: false,
  });
  await page.type('#login-username', 'owner');
  await page.type('#login-password', 'owner-pass-123');
  await page.evaluate(() => {
    const submit = document.querySelector('button[type="submit"]');
    submit.click();
    submit.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('登录中...'));
  assert.equal(await page.$eval('button[type="submit"]', (button) => button.disabled), true);
  await page.waitForFunction(() => document.body.innerText.includes('账号资源'));
  assert.equal(requestedPaths.filter((path) => path === '/api/auth/login').length, 1);
  await page.close();
});

test('临时密码 Session 只能改密并在成功后加载数据', async () => {
  const requestedPaths = [];
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    mustChangePassword: true,
    requestedPaths,
    waitForData: false,
  });
  await page.waitForFunction(() => document.body.innerText.includes('修改密码'));
  assert.doesNotMatch(await page.$eval('body', (body) => body.innerText), /登录账号管家/);
  assert.equal(requestedPaths.includes('/api/data'), false);
  await page.type('#current-password', 'temporary-pass-123');
  await page.type('#new-password', 'new-secure-pass-123');
  await page.type('#confirm-password', 'new-secure-pass-123');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('账号资源'));
  assert.equal(requestedPaths.includes('/api/data'), true);
  await page.close();
});

test('业务请求返回 401 时清空已加载敏感数据并返回登录页', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, { isAdmin: true });
  assert.match(await page.$eval('body', (body) => body.innerText), /active@example\.invalid/);
  page.uiFixtureController.expireSession();
  await page.click('button[title="停用"]');
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '确定').click());
  await page.waitForFunction(() => document.body.innerText.includes('登录账号管家'));
  const bodyText = await page.$eval('body', (body) => body.innerText);
  assert.doesNotMatch(bodyText, /active@example\.invalid|fixture-password|FIXTURE2FAKEY/);
  await page.close();
});

test('AccountsView 的 fetch-code 401 清空敏感数据并返回登录页', async () => {
  const fixture = structuredClone(SANITIZED_UI_FIXTURE);
  fixture.accounts[0].emailUrl = '';
  const page = await openFixturePage(fixture, {
    responsePlans: {
      '/api/fetch-code': [{
        response: {
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: '请先登录', code: 'UNAUTHENTICATED' }),
        },
      }],
    },
  });

  await page.click('button[title="提取邮箱验证码"]');
  await page.waitForSelector('#login-username', { timeout: 2_000 });
  assert.doesNotMatch(
    await page.$eval('body', (body) => body.innerText),
    /active@example\.invalid|fixture-password|FIXTURE2FAKEY/,
  );
  await page.close();
});

test('PhonesView 的 fetch-code 401 清空敏感数据并返回登录页', async () => {
  const fixture = structuredClone(SANITIZED_UI_FIXTURE);
  fixture.phones[0].smsUrl = '/api/fixture-sms';
  const page = await openFixturePage(fixture, {
    responsePlans: {
      '/api/fetch-code': [{
        response: {
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: '请先登录', code: 'UNAUTHENTICATED' }),
        },
      }],
    },
  });
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find((button) => button.textContent.includes('Phones')).click());

  await page.evaluate(() => [...document.querySelectorAll('main button')]
    .find((button) => button.textContent.trim() === '查短信').click());
  await page.waitForSelector('#login-username', { timeout: 2_000 });
  assert.doesNotMatch(
    await page.$eval('body', (body) => body.innerText),
    /202-555-0101|fixture-sms-key|active@example\.invalid/,
  );
  await page.close();
});

test('已加载页面到达 Session 绝对到期时间时自动清空敏感数据', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    sessionExpiresInMs: 2_500,
  });
  assert.match(await page.$eval('body', (body) => body.innerText), /active@example\.invalid/);

  await page.waitForSelector('#login-username', { timeout: 5_000 });
  assert.doesNotMatch(
    await page.$eval('body', (body) => body.innerText),
    /active@example\.invalid|fixture-password|FIXTURE2FAKEY/,
  );
  await page.close();
});

test('退出后忽略上一 Session 延迟返回的数据', async () => {
  const requestedPaths = [];
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    isAdmin: true,
    requestedPaths,
    responsePlans: {
      '/api/data': [{ delay: 600 }, { delay: 50 }],
    },
    waitForData: false,
  });
  await page.waitForSelector('button[title="退出登录"]');
  await waitForRequestCount(requestedPaths, '/api/data', 1);
  await page.click('button[title="退出登录"]');
  await page.waitForSelector('#login-username');
  page.uiFixtureController.replaceData({ accounts: [], phones: [], phoneAccountHistory: [] });
  await loginThroughForm(page);
  await waitForRequestCount(requestedPaths, '/api/data', 2);
  await page.waitForSelector('[data-testid="empty-state"]', { timeout: 2_000 });
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.doesNotMatch(
    await page.$eval('body', (body) => body.innerText),
    /active@example\.invalid/,
  );
  await page.close();
});

test('新 Session 数据请求返回 401 后忽略旧 Session 的延迟成功响应', async () => {
  const requestedPaths = [];
  const unauthorized = {
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: '请先登录', code: 'UNAUTHENTICATED' }),
  };
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    isAdmin: true,
    requestedPaths,
    responsePlans: {
      '/api/data': [
        { delay: 600 },
        { delay: 50, response: unauthorized },
        { delay: 700 },
      ],
    },
    waitForData: false,
  });
  await page.waitForSelector('button[title="退出登录"]');
  await waitForRequestCount(requestedPaths, '/api/data', 1);
  await page.click('button[title="退出登录"]');
  await page.waitForSelector('#login-username');
  page.uiFixtureController.replaceData({ accounts: [], phones: [], phoneAccountHistory: [] });
  await loginThroughForm(page);
  await page.waitForSelector('#login-username', { timeout: 2_000 });
  await new Promise((resolve) => setTimeout(resolve, 650));

  await page.evaluate(() => {
    window.__oldSessionSensitiveSeen = false;
    const detectSensitiveText = () => {
      if (document.body.innerText.includes('active@example.invalid')) {
        window.__oldSessionSensitiveSeen = true;
      }
    };
    detectSensitiveText();
    new MutationObserver(detectSensitiveText).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  await loginThroughForm(page);
  await waitForRequestCount(requestedPaths, '/api/data', 3);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(await page.evaluate(() => window.__oldSessionSensitiveSeen), false);
  await page.waitForSelector('[data-testid="empty-state"]', { timeout: 2_000 });
  await page.close();
});

test('慢退出完成前不开放重新登录', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    responsePlans: {
      '/api/auth/logout': [{ delay: 350 }],
    },
  });
  await page.click('button[title="退出登录"]');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(await page.$('#login-username'), null);
  assert.match(await page.$eval('body', (body) => body.innerText), /正在验证登录状态/);
  await page.waitForSelector('#login-username', { timeout: 2_000 });
  await page.close();
});

test('迟到的改密响应不能跨越 logout 恢复 Cookie、用户或敏感数据', async () => {
  const requestedPaths = [];
  const pageErrors = [];
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    requestedPaths,
    responsePlans: {
      '/api/auth/change-password': [{ delay: 600 }],
      '/api/auth/logout': [{ delay: 50 }],
    },
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.click('button[title="修改密码"]');
  await page.waitForSelector('[role="dialog"] #current-password');
  await page.type('[role="dialog"] #current-password', 'viewer-pass-123');
  await page.type('[role="dialog"] #new-password', 'new-viewer-pass-123');
  await page.type('[role="dialog"] #confirm-password', 'new-viewer-pass-123');
  await page.click('[role="dialog"] button[type="submit"]');
  await waitForRequestCount(requestedPaths, '/api/auth/change-password', 1);
  assert.equal(
    requestedPaths.filter((value) => value === '/api/auth/change-password').length,
    1,
    JSON.stringify({ pageErrors, requestedPaths }),
  );
  await page.click('button[aria-label="关闭修改密码弹窗"]');
  await page.click('button[title="退出登录"]');
  await page.waitForSelector('#login-username', { timeout: 2_000 });
  await new Promise((resolve) => setTimeout(resolve, 800));

  assert.notEqual(await page.$('#login-username'), null);
  assert.doesNotMatch(
    await page.$eval('body', (body) => body.innerText),
    /active@example\.invalid|fixture-password|FIXTURE2FAKEY/,
  );
  assert.deepEqual(
    (await page.cookies())
      .filter((cookie) => cookie.name === 'account_manager_session')
      .map((cookie) => cookie.value),
    [],
  );
  await page.close();
});

test('退出接口失败时保留当前会话并显示安全错误', async () => {
  const logoutFailure = {
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'internal detail', code: 'INTERNAL_ERROR' }),
  };
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    isAdmin: true,
    responsePlans: {
      '/api/auth/logout': [{ delay: 50, response: logoutFailure }],
    },
  });
  await page.click('button[title="退出登录"]');
  await page.waitForFunction(
    () => document.body.innerText.includes('退出失败，请稍后重试'),
    { timeout: 2_000 },
  );
  const bodyText = await page.$eval('body', (body) => body.innerText);
  assert.match(bodyText, /退出失败，请稍后重试/);
  assert.match(bodyText, /管理员/);
  assert.doesNotMatch(bodyText, /internal detail/);
  await page.close();
});

test('viewer 只显示会话操作并能主动修改密码', async () => {
  const page = await openReadyPage();
  const headerText = await page.$eval('header', (header) => header.innerText);
  assert.match(headerText, /viewer/);
  assert.match(headerText, /只读成员/);
  assert.doesNotMatch(headerText, /成员管理/);
  assert.match(headerText, /修改密码/);
  assert.match(headerText, /退出/);

  await page.evaluate(() => [...document.querySelectorAll('header button')]
    .find((button) => button.textContent.trim() === '修改密码').click());
  await page.waitForSelector('[role="dialog"] #new-password');
  await page.type('[role="dialog"] #current-password', 'viewer-pass-123');
  await page.type('[role="dialog"] #new-password', 'new-viewer-pass-123');
  await page.type('[role="dialog"] #confirm-password', 'new-viewer-pass-123');
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '保存新密码').click());
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.match(await page.$eval('header', (header) => header.innerText), /viewer/);
  await page.close();
});

test('当前密码错误时保留 Session 并在改密弹窗显示安全错误', async () => {
  const page = await openReadyPage();
  await page.click('button[title="修改密码"]');
  await page.waitForSelector('[role="dialog"] #current-password');
  await page.type('[role="dialog"] #current-password', 'wrong-password');
  await page.type('[role="dialog"] #new-password', 'new-viewer-pass-123');
  await page.type('[role="dialog"] #confirm-password', 'new-viewer-pass-123');
  await page.click('[role="dialog"] button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"]')?.innerText.includes('当前密码不正确'),
    { timeout: 2_000 },
  );

  assert.notEqual(await page.$('[role="dialog"]'), null);
  assert.match(await page.$eval('[role="dialog"]', (dialog) => dialog.innerText), /当前密码不正确/);
  assert.match(await page.$eval('header', (header) => header.innerText), /viewer/);
  assert.match(await page.$eval('body', (body) => body.innerText), /active@example\.invalid/);
  await page.close();
});
