import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loginAsAdmin,
  openFixturePage,
  openReadyPage,
} from '../support/ui-e2e-harness.mjs';

test('手机号编辑弹窗使用统一的无障碍弹窗契约', async () => {
  const page = await openReadyPage();
  await loginAsAdmin(page);

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Phones'))
      .click();
  });
  await page.waitForFunction(
    () => document.body.innerText.includes('有效手机号总数'),
    { timeout: 5_000 },
  );
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('录入号码'))
      .click();
  });

  await page.waitForSelector('[role="dialog"][aria-modal="true"]', {
    timeout: 2_000,
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !document.querySelector('[role="dialog"]'),
    { timeout: 2_000 },
  );

  await page.close();
});

test('手机号网格与表格切换时保留选择状态和批量操作区', async () => {
  const page = await openReadyPage();
  await loginAsAdmin(page);

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Phones'))
      .click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('有效手机号总数'));

  await page.click('button[title="紧凑表格视图"]');
  await page.waitForSelector('[data-testid="phones-table"]');
  await page.click('[data-testid="phones-table"] tbody input[type="checkbox"]');
  await page.waitForSelector('[data-testid="phones-selection-dock"]');
  assert.match(
    await page.$eval('[data-testid="phones-selection-dock"]', (element) => element.textContent),
    /已选 1 个手机号/,
  );

  await page.click('button[title="卡片网格视图"]');
  await page.waitForSelector('[data-testid="phones-grid"]');
  assert.equal(
    await page.$eval(
      '[data-testid="phones-grid"] input[type="checkbox"]',
      (checkbox) => checkbox.checked,
    ),
    true,
  );
  assert.match(
    await page.$eval('[data-testid="phones-selection-dock"]', (element) => element.textContent),
    /已选 1 个手机号/,
  );

  await page.close();
});

test('手机号列表展示去重历史并可逐层查看账号详情', async () => {
  const page = await openFixturePage({
    accounts: [
      {
        id: 'active-account', site: 'Active Site', username: 'active@example.invalid',
        password: 'active-password', expireDate: '2099-12-31', status: 'active',
      },
      {
        id: 'archived-account', site: 'Archived Site', username: 'archived@example.invalid',
        password: 'archived-password', expireDate: '2099-12-31', status: 'archived',
      },
      {
        id: 'expired-account', site: 'Expired Site', username: 'expired@example.invalid',
        password: 'expired-password', expireDate: '2000-01-01', status: 'active',
      },
    ],
    phones: [{
      id: 'history-phone', number: '+1 202-555-0188', expireDate: '2099-12-31',
      smsUrl: '', smsKey: '', boundAccountId: null, status: 'active',
    }],
    phoneAccountHistory: [
      {
        phoneId: 'history-phone', accountId: 'active-account', siteSnapshot: 'Active Site',
        usernameSnapshot: 'active@example.invalid', firstBoundAt: '2026-07-25T10:00:00.000Z',
        lastBoundAt: '2026-07-27T10:00:00.000Z',
      },
      {
        phoneId: 'history-phone', accountId: 'archived-account', siteSnapshot: 'Archived Site',
        usernameSnapshot: 'archived@example.invalid', firstBoundAt: '2026-07-24T10:00:00.000Z',
        lastBoundAt: '2026-07-26T10:00:00.000Z',
      },
      {
        phoneId: 'history-phone', accountId: 'deleted-account', siteSnapshot: 'Deleted Site',
        usernameSnapshot: 'deleted@example.invalid', firstBoundAt: '2026-07-23T10:00:00.000Z',
        lastBoundAt: '2026-07-25T10:00:00.000Z',
      },
      {
        phoneId: 'history-phone', accountId: 'expired-account', siteSnapshot: 'Expired Site',
        usernameSnapshot: 'expired@example.invalid', firstBoundAt: '2026-07-22T10:00:00.000Z',
        lastBoundAt: '2026-07-24T10:00:00.000Z',
      },
    ],
  });

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Phones'))
      .click();
  });

  const historyButtonSelector = 'button[aria-label="查看 +1 202-555-0188 的 4 个历史关联账号"]';
  await page.click('button[title="紧凑表格视图"]');
  await page.waitForSelector(historyButtonSelector, { timeout: 2_000 });
  const idleHistoryLayout = await page.$eval(historyButtonSelector, (button) => {
    const bindingCell = button.closest('td');
    const idleLabel = [...bindingCell.querySelectorAll('span')]
      .find((element) => element.textContent.trim() === '闲置可用');
    const idleRect = idleLabel.getBoundingClientRect();
    const historyRect = button.getBoundingClientRect();
    return { idleBottom: idleRect.bottom, historyTop: historyRect.top };
  });
  assert.ok(
    idleHistoryLayout.historyTop >= idleHistoryLayout.idleBottom - 1,
    `idle history entry shares the first line: ${JSON.stringify(idleHistoryLayout)}`,
  );
  await page.click('button[title="卡片网格视图"]');
  await page.waitForSelector('[data-testid="phones-grid"]', { timeout: 2_000 });
  await page.waitForSelector(historyButtonSelector, { timeout: 2_000 });
  await page.click(historyButtonSelector);
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 2_000 });
  assert.equal(await page.$$eval('[role="dialog"]', (dialogs) => dialogs.length), 1);
  const historyText = await page.$eval('[role="dialog"]', (dialog) => dialog.textContent);
  assert.match(historyText, /Active Site/);
  assert.match(historyText, /Archived Site/);
  assert.match(historyText, /Deleted Site/);
  assert.match(historyText, /Expired Site/);
  const historyListLayout = await page.$eval('[data-phone-history-item]', (item) => {
    const times = item.querySelector('[data-phone-history-times]');
    return {
      timeDisplay: getComputedStyle(times).display,
      timeColumns: getComputedStyle(times).gridTemplateColumns.split(' ').filter(Boolean).length,
      overflow: item.scrollWidth - item.clientWidth,
    };
  });
  assert.equal(historyListLayout.timeDisplay, 'grid');
  assert.equal(historyListLayout.timeColumns, 2);
  assert.ok(historyListLayout.overflow <= 1, `history item overflow is ${historyListLayout.overflow}px`);
  const historyStatuses = await page.$$eval('[data-phone-history-item]', (items) => {
    const knownStatuses = new Set(['有效', '停用', '已删除', '已过期']);
    return items.map((item) => [...item.querySelectorAll('span')]
      .find((element) => knownStatuses.has(element.textContent.trim()))?.textContent.trim());
  });
  assert.deepEqual(historyStatuses, ['有效', '停用', '已删除', '已过期']);
  const historyTimes = await page.$$eval('[data-phone-history-times]', (items) => items.map((item) => item.textContent));
  assert.equal(historyTimes.length, 4);
  assert.ok(historyTimes.every((value) => value.includes('首次关联') && value.includes('最近关联') && !value.includes('-')));
  assert.equal(
    await page.$eval(
      'button[aria-label="查看账号 expired@example.invalid 详情"]',
      (button) => button.parentElement.querySelector('span')?.textContent.trim(),
    ),
    '已过期',
  );
  const historyViewAction = await page.$eval(
    'button[aria-label="查看账号 active@example.invalid 详情"]',
    (button) => {
      const rect = button.getBoundingClientRect();
      return {
        text: button.textContent.trim(),
        height: rect.height,
      };
    },
  );
  assert.equal(historyViewAction.text, '查看');
  assert.ok(historyViewAction.height >= 32, `history view action height is ${historyViewAction.height}px`);

  await page.click('button[aria-label="查看账号 active@example.invalid 详情"]');
  await page.waitForSelector('[role="dialog"] button[title="显示密码"]', { timeout: 2_000 });
  await page.click('[role="dialog"] button[title="显示密码"]');
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"]')?.textContent.includes('active-password'),
    { timeout: 2_000 },
  );
  assert.equal(await page.$$eval('[role="dialog"]', (dialogs) => dialogs.length), 1);
  assert.equal(
    await page.$eval('button[aria-label="账号 deleted@example.invalid 已删除，无法查看详情"]', (button) => button.disabled),
    true,
  );

  await page.click('button[aria-label="关闭账号详情弹窗"]');
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"]')?.textContent.includes('Deleted Site'),
    { timeout: 2_000 },
  );
  assert.equal(await page.$$eval('[role="dialog"]', (dialogs) => dialogs.length), 1);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 2_000 });
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    '查看 +1 202-555-0188 的 4 个历史关联账号',
  );

  await page.click(historyButtonSelector);
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === '关闭历史关联账号弹窗',
    { timeout: 2_000 },
  );
  assert.equal(await page.$$eval('[role="dialog"]', (dialogs) => dialogs.length), 1);

  await page.close();
});

test('关联手机弹窗展示历史数量并在详情关闭后逐层返回', async () => {
  const fixture = {
    accounts: [
      { id: 'target-account', site: 'Target Site', username: 'target@example.invalid', password: 'target-password', expireDate: '2099-12-31', status: 'active' },
      { id: 'history-account', site: 'History Site', username: 'history@example.invalid', password: 'history-password', expireDate: '2099-12-31', status: 'active' },
      { id: 'bound-account', site: 'Bound Site', username: 'a-very-long-bound-account-name@example.invalid', password: 'bound-password', expireDate: '2099-12-31', status: 'active' },
    ],
    phones: [
      { id: 'idle-history-phone', number: '+1 202-555-0177', expireDate: '2099-12-31', smsUrl: '', smsKey: '', boundAccountId: null, status: 'active' },
      { id: 'bound-history-phone', number: '+1 202-555-0199', expireDate: '2099-12-31', smsUrl: '', smsKey: '', boundAccountId: 'bound-account', status: 'active' },
    ],
    phoneAccountHistory: [
      { phoneId: 'idle-history-phone', accountId: 'history-account', siteSnapshot: 'History Site', usernameSnapshot: 'history@example.invalid', firstBoundAt: '2026-07-27T01:00:00.000Z', lastBoundAt: '2026-07-27T02:00:00.000Z' },
    ],
  };
  const page = await openFixturePage(fixture, { isAdmin: true });
  await page.waitForFunction(() => document.body.innerText.includes('管理员'));
  await page.click('button[title="绑定手机"]');
  await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')]
    .find((button) => button.textContent.includes('从已有号池中选择')).click());
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((button) => button.textContent.trim() === '抢占绑定'));
  const desktopBoundRowLayout = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="抢占绑定 +1 202-555-0199"]');
    const row = button?.closest('[data-phone-selection-row]');
    const expiry = row?.querySelector('[data-phone-selection-expiry]');
    return {
      opacity: row ? getComputedStyle(row).opacity : null,
      expiryWhiteSpace: expiry ? getComputedStyle(expiry).whiteSpace : null,
      display: row ? getComputedStyle(row).display : null,
      columns: row ? getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      overflow: row ? row.scrollWidth - row.clientWidth : null,
    };
  });
  assert.equal(desktopBoundRowLayout.opacity, '1');
  assert.equal(desktopBoundRowLayout.expiryWhiteSpace, 'nowrap');
  assert.equal(desktopBoundRowLayout.display, 'grid');
  assert.equal(desktopBoundRowLayout.columns, 3);
  assert.ok(desktopBoundRowLayout.overflow <= 1, `phone selection row overflow is ${desktopBoundRowLayout.overflow}px`);

  await page.setViewport({ width: 390, height: 844 });
  const mobileBoundRowLayout = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="抢占绑定 +1 202-555-0199"]');
    const row = button?.closest('[data-phone-selection-row]');
    const infoRect = row?.querySelector('[data-phone-selection-info]')?.getBoundingClientRect();
    const actionsRect = row?.querySelector('[data-phone-selection-actions]')?.getBoundingClientRect();
    const dialog = document.querySelector('[role="dialog"]');
    return {
      infoBottom: infoRect?.bottom ?? null,
      actionsTop: actionsRect?.top ?? null,
      dialogOverflow: dialog ? dialog.scrollWidth - dialog.clientWidth : null,
    };
  });
  assert.ok(mobileBoundRowLayout.actionsTop >= mobileBoundRowLayout.infoBottom - 1);
  assert.ok(mobileBoundRowLayout.dialogOverflow <= 1);
  await page.setViewport({ width: 1440, height: 900 });

  const historyButton = await page.waitForSelector(
    'button[aria-label="查看 +1 202-555-0177 的 1 个历史关联账号"]',
  );
  await historyButton.click();
  await page.click('button[aria-label="查看账号 history@example.invalid 详情"]');
  await page.click('[role="dialog"] button[title="显示密码"]');
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent.includes('history-password'));
  await page.click('button[aria-label="关闭账号详情弹窗"]');
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent.includes('历史关联账号'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent.includes('关联手机'));
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('aria-label') === '查看 +1 202-555-0177 的 1 个历史关联账号',
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    '查看 +1 202-555-0177 的 1 个历史关联账号',
  );

  await page.click('button[aria-label="查看 +1 202-555-0177 的 1 个历史关联账号"]');
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent.includes('历史关联账号'));
  const mobileDialog = await page.$eval('[role="dialog"]', (dialog) => {
    const rect = dialog.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
      overflow: dialog.scrollWidth - dialog.clientWidth,
    };
  });
  assert.ok(mobileDialog.left >= -1, `dialog left is ${mobileDialog.left}px`);
  assert.ok(mobileDialog.right <= mobileDialog.viewportWidth + 1, `dialog right is ${mobileDialog.right}px`);
  assert.ok(mobileDialog.overflow <= 1, `dialog overflow is ${mobileDialog.overflow}px`);
  await page.close();
});
