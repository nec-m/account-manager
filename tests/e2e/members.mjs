import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SANITIZED_UI_FIXTURE,
  forceCloseMemberDialogFromParent,
  openFixturePage,
} from '../support/ui-e2e-harness.mjs';

test('管理员可以管理 viewer 且临时密码只在当前弹窗会话显示', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, { isAdmin: true });
  assert.match(await page.$eval('header', (header) => header.innerText), /owner/);
  assert.match(await page.$eval('header', (header) => header.innerText), /管理员/);

  await page.click('button[title="成员管理"]');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]');
  await page.waitForSelector('[role="dialog"] button[aria-label="创建成员"]:not([disabled])');
  assert.equal(await page.$$eval('[role="dialog"]', (dialogs) => dialogs.length), 1);
  assert.equal(
    await page.$('[role="dialog"] button[aria-label="停用 owner"]'),
    null,
  );
  assert.equal(
    await page.$('[role="dialog"] button[aria-label="重置 owner 的密码"]'),
    null,
  );

  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '创建成员').click());
  await page.type('#member-username', 'reader-two');
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '确认创建').click());
  await page.waitForFunction(() => document.body.innerText.includes('fixture-created-pass-123'));
  assert.equal(await page.$$eval('[role="dialog"]', (dialogs) => dialogs.length), 1);
  assert.deepEqual(await page.evaluate(() => ({
    local: localStorage.getItem('temporaryPassword'),
    session: sessionStorage.getItem('temporaryPassword'),
  })), { local: null, session: null });

  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '关闭').click());
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent.trim()),
    '成员管理',
  );

  await page.click('button[title="成员管理"]');
  await page.waitForSelector('[role="dialog"]');
  assert.doesNotMatch(
    await page.$eval('[role="dialog"]', (dialog) => dialog.textContent),
    /fixture-created-pass-123/,
  );

  await page.waitForSelector('[role="dialog"] button[aria-label="停用 reader-two"]:not([disabled])');
  await page.click('[role="dialog"] button[aria-label="停用 reader-two"]');
  await page.waitForSelector('[role="dialog"] button[aria-label="启用 reader-two"]:not([disabled])');
  await page.click('[role="dialog"] button[aria-label="启用 reader-two"]');
  await page.waitForSelector('[role="dialog"] button[aria-label="停用 reader-two"]:not([disabled])');
  await page.waitForSelector('[role="dialog"] button[aria-label="重置 reader-two 的密码"]:not([disabled])');
  await page.click('[role="dialog"] button[aria-label="重置 reader-two 的密码"]');
  await page.waitForFunction(() => document.body.innerText.includes('fixture-reset-pass-123'));

  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '关闭').click());
  await page.click('button[title="成员管理"]');
  assert.doesNotMatch(
    await page.$eval('[role="dialog"]', (dialog) => dialog.textContent),
    /fixture-reset-pass-123/,
  );

  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '创建成员').click());
  await page.type('#member-username', 'reader-three');
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '确认创建').click());
  await page.waitForFunction(() => document.body.innerText.includes('成员数量已达 5 人上限'));
  assert.equal(
    await page.$eval(
      '[role="dialog"] button[aria-label="创建成员"]',
      (button) => button.disabled,
    ),
    true,
  );
  await page.close();
});

test('创建成员在途时阻止关闭并在响应后交付唯一临时密码', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    isAdmin: true,
    responsePlans: {
      '/api/members': [{}, { delay: 500 }, {}],
    },
  });
  await page.click('button[title="成员管理"]');
  await page.waitForSelector('[role="dialog"] button[aria-label="创建成员"]:not([disabled])');
  await page.click('[role="dialog"] button[aria-label="创建成员"]');
  await page.type('#member-username', 'delayed-reader');
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '确认创建').click());
  await page.waitForFunction(() => document.body.innerText.includes('创建中...'));

  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.notEqual(await page.$('[role="dialog"]'), null);
  assert.equal(
    await page.$eval('button[aria-label="关闭成员管理弹窗"]', (button) => button.disabled),
    true,
  );
  assert.match(
    await page.$eval('[role="dialog"]', (dialog) => dialog.textContent),
    /成员操作处理中，请等待完成后关闭/,
  );

  await page.waitForFunction(() => document.body.innerText.includes('fixture-created-pass-123'));
  assert.equal(
    await page.$eval('button[aria-label="关闭成员管理弹窗"]', (button) => button.disabled),
    false,
  );
  await page.click('button[aria-label="关闭成员管理弹窗"]');
  await page.click('button[title="成员管理"]');
  await page.waitForSelector('[data-member-row="delayed-reader"]');
  assert.doesNotMatch(
    await page.$eval('[role="dialog"]', (dialog) => dialog.textContent),
    /fixture-created-pass-123/,
  );
  await page.close();
});

test('重置密码在途时关闭按钮失效且响应后密码可见', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    isAdmin: true,
    responsePlans: {
      '/api/members/fixture-viewer/reset-password': [{ delay: 500 }],
    },
  });
  await page.click('button[title="成员管理"]');
  await page.waitForSelector(
    '[role="dialog"] button[aria-label="重置 viewer 的密码"]:not([disabled])',
  );
  await page.click('[role="dialog"] button[aria-label="重置 viewer 的密码"]');
  await page.waitForFunction(() => document.body.innerText.includes('重置中...'));

  assert.equal(
    await page.$eval('button[aria-label="关闭成员管理弹窗"]', (button) => button.disabled),
    true,
  );
  const footerCloseDisabled = await page.$eval('[role="dialog"]', (dialog) => (
    [...dialog.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === '关闭').disabled
  ));
  assert.equal(footerCloseDisabled, true);
  await page.click('button[aria-label="关闭成员管理弹窗"]');
  assert.notEqual(await page.$('[role="dialog"]'), null);

  await page.waitForFunction(() => document.body.innerText.includes('fixture-reset-pass-123'));
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '关闭').click());
  await page.click('button[title="成员管理"]');
  await page.waitForSelector('[role="dialog"] button[aria-label="重置 viewer 的密码"]');
  assert.doesNotMatch(
    await page.$eval('[role="dialog"]', (dialog) => dialog.textContent),
    /fixture-reset-pass-123/,
  );
  await page.close();
});

test('旧 mutation 响应不会覆盖重开后的列表或解除新 operation', async () => {
  const memberPath = '/api/members/fixture-viewer';
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, {
    isAdmin: true,
    responsePlans: {
      [memberPath]: [{ delay: 500 }, { delay: 1_100 }],
    },
  });
  await page.click('button[title="成员管理"]');
  await page.waitForSelector(
    '[role="dialog"] button[aria-label="停用 viewer"]:not([disabled])',
  );
  const oldResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === memberPath
    && response.request().method() === 'PATCH'
  ));
  await page.click('[role="dialog"] button[aria-label="停用 viewer"]');
  await page.waitForFunction(() => document.body.innerText.includes('处理中...'));

  await forceCloseMemberDialogFromParent(page);
  await page.click('button[title="成员管理"]');
  await page.waitForSelector(
    '[role="dialog"] button[aria-label="启用 viewer"]:not([disabled])',
  );
  await page.click('[role="dialog"] button[aria-label="启用 viewer"]');
  await page.waitForFunction(() => document.body.innerText.includes('处理中...'));

  await oldResponse;
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.match(
    await page.$eval('[role="dialog"]', (dialog) => dialog.textContent),
    /处理中.../,
  );
  assert.equal(
    await page.$eval(
      '[role="dialog"] button[aria-label="启用 viewer"]',
      (button) => button.disabled,
    ),
    true,
  );

  await page.waitForSelector(
    '[role="dialog"] button[aria-label="停用 viewer"]:not([disabled])',
    { timeout: 3_000 },
  );
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '关闭').click());
  await page.click('button[title="成员管理"]');
  await page.waitForSelector(
    '[role="dialog"] button[aria-label="停用 viewer"]:not([disabled])',
  );
  assert.doesNotMatch(
    await page.$eval('[role="dialog"]', (dialog) => dialog.textContent),
    /处理中.../,
  );
  await page.close();
});

test('成员弹窗支持焦点陷阱、Escape 恢复焦点和移动端无横向溢出', async () => {
  const page = await openFixturePage(SANITIZED_UI_FIXTURE, { isAdmin: true });
  await page.click('button[title="成员管理"]');
  await page.waitForSelector('[role="dialog"][aria-modal="true"]');

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const expectedFirstLabel = await page.$eval('[role="dialog"]', (dialog, selector) => {
    const focusable = [...dialog.querySelectorAll(selector)]
      .filter((element) => element.getClientRects().length > 0);
    focusable.at(-1).focus();
    return focusable[0].getAttribute('aria-label') || focusable[0].textContent.trim();
  }, focusableSelector);
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => (
      document.activeElement?.getAttribute('aria-label')
      || document.activeElement?.textContent.trim()
    )),
    expectedFirstLabel,
  );

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(await page.evaluate(() => document.activeElement?.textContent.trim()), '成员管理');

  await page.setViewport({ width: 390, height: 844 });
  await page.click('button[title="成员管理"]');
  await page.waitForSelector('[role="dialog"]');
  const mobileLayout = await page.$eval('[role="dialog"]', (dialog) => {
    const rect = dialog.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      dialogOverflow: dialog.scrollWidth - dialog.clientWidth,
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  assert.ok(mobileLayout.left >= -1, `dialog left is ${mobileLayout.left}px`);
  assert.ok(
    mobileLayout.right <= mobileLayout.viewportWidth + 1,
    `dialog right is ${mobileLayout.right}px`,
  );
  assert.ok(mobileLayout.dialogOverflow <= 1, `dialog overflow is ${mobileLayout.dialogOverflow}px`);
  assert.ok(mobileLayout.pageOverflow <= 1, `page overflow is ${mobileLayout.pageOverflow}px`);

  const modalIsolation = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const overlay = dialog?.parentElement;
    const addButton = [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === '添加账号');
    const rect = addButton?.getBoundingClientRect();
    const topElement = rect
      ? document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2))
      : null;
    return {
      ariaModal: dialog?.getAttribute('aria-modal'),
      backgroundButtonExists: Boolean(addButton),
      topElementBelongsToModal: Boolean(topElement && overlay?.contains(topElement)),
      backgroundButtonIsTopElement: Boolean(
        topElement && (topElement === addButton || addButton?.contains(topElement)),
      ),
    };
  });
  assert.equal(modalIsolation.ariaModal, 'true');
  assert.equal(modalIsolation.backgroundButtonExists, true);
  assert.equal(modalIsolation.backgroundButtonIsTopElement, false);
  assert.equal(modalIsolation.topElementBelongsToModal, true);
  await page.close();
});
