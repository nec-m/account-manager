import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SANITIZED_UI_FIXTURE,
  loginAsAdmin,
  openFixturePage,
  openReadyPage,
} from '../support/ui-e2e-harness.mjs';

const DETAIL_BUTTON_SELECTOR = 'button[aria-label="查看 Fixture Service 详情"]';
const TITLE_BUTTON_SELECTOR = 'button[aria-label="通过站点标题查看 Fixture Service 详情"]';

test('普通用户和管理员均可从账号卡片打开详情，并保留对应编辑权限', async () => {
  for (const { isAdmin, canEdit } of [
    { isAdmin: false, canEdit: false },
    { isAdmin: true, canEdit: true },
  ]) {
    const page = await openFixturePage(SANITIZED_UI_FIXTURE, { isAdmin });
    const detailButton = await page.waitForSelector(DETAIL_BUTTON_SELECTOR, {
      visible: true,
      timeout: 2_000,
    });
    assert.equal(await detailButton.evaluate((button) => button.textContent.trim()), '详情');

    await detailButton.click();
    await page.waitForSelector('[role="dialog"][aria-modal="true"]', {
      timeout: 2_000,
    });
    const hasEditAction = await page.$eval('[role="dialog"]', (dialog) => (
      [...dialog.querySelectorAll('button')]
        .some((button) => button.textContent.trim().startsWith('编辑账号'))
    ));
    assert.equal(hasEditAction, canEdit);

    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]'),
      { timeout: 2_000 },
    );
    await page.close();
  }
});

test('站点标题是可聚焦的详情按钮，并支持 Enter 打开和 Escape 关闭', async () => {
  const page = await openReadyPage();

  const titleButtonContract = await page.$eval(TITLE_BUTTON_SELECTOR, (button) => ({
    parentTagName: button.parentElement?.tagName,
    type: button.type,
    hasPopup: button.getAttribute('aria-haspopup'),
  }));
  assert.deepEqual(titleButtonContract, {
    parentTagName: 'H3',
    type: 'button',
    hasPopup: 'dialog',
  });

  await page.focus(TITLE_BUTTON_SELECTOR);
  assert.equal(
    await page.evaluate((selector) => document.activeElement?.matches(selector), TITLE_BUTTON_SELECTOR),
    true,
  );
  await page.keyboard.press('Enter');
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

test('账号卡片四个底部按钮在移动端和 1440px 桌面端均不换行、不溢出', async () => {
  const page = await openReadyPage();

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewport(viewport);
    const layout = await page.$eval(DETAIL_BUTTON_SELECTOR, (detailButton) => {
      const actionBar = detailButton.parentElement;
      const actionBarRect = actionBar.getBoundingClientRect();
      const buttons = [...actionBar.querySelectorAll(':scope > button')];
      return {
        labels: buttons.map((button) => button.textContent.trim()),
        flexWrap: getComputedStyle(actionBar).flexWrap,
        hasHorizontalOverflow: actionBar.scrollWidth > actionBar.clientWidth,
        buttons: buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            whiteSpace: getComputedStyle(button).whiteSpace,
            insideActionBar: rect.left >= actionBarRect.left - 0.5
              && rect.right <= actionBarRect.right + 0.5,
            hasContentOverflow: button.scrollWidth > button.clientWidth,
          };
        }),
      };
    });

    assert.deepEqual(layout.labels, ['详情', '查邮箱', '查2FA', '查短信']);
    assert.equal(layout.flexWrap, 'nowrap');
    assert.equal(layout.hasHorizontalOverflow, false);
    for (const button of layout.buttons) {
      assert.equal(button.whiteSpace, 'nowrap');
      assert.equal(button.insideActionBar, true);
      assert.equal(button.hasContentOverflow, false);
    }
  }

  await page.close();
});

test('1440px 桌面视口使用四列资源卡片', async () => {
  const page = await openReadyPage();
  const accountColumns = await page.$eval(
    '[data-testid="accounts-grid"]',
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  );
  assert.equal(accountColumns, 4);

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Phones'))
      .click();
  });
  await page.waitForSelector('[data-testid="phones-grid"]');
  const phoneColumns = await page.$eval(
    '[data-testid="phones-grid"]',
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  );
  assert.equal(phoneColumns, 4);

  await page.close();
});

test('账号网格与表格切换时保留选择状态和批量操作区', async () => {
  const page = await openReadyPage();
  await loginAsAdmin(page);
  await page.waitForFunction(() => document.body.innerText.includes('管理员'));

  await page.click('button[title="紧凑表格视图"]');
  await page.waitForSelector('[data-testid="accounts-table"]');
  await page.click('[data-testid="accounts-table"] tbody input[type="checkbox"]');
  await page.waitForSelector('[data-testid="accounts-selection-dock"]');
  assert.match(
    await page.$eval('[data-testid="accounts-selection-dock"]', (element) => element.textContent),
    /已选 1 项/,
  );

  await page.click('button[title="卡片网格视图"]');
  await page.waitForSelector('[data-testid="accounts-grid"]');
  assert.equal(
    await page.$eval(
      '[data-testid="accounts-grid"] input[type="checkbox"]',
      (checkbox) => checkbox.checked,
    ),
    true,
  );
  assert.match(
    await page.$eval('[data-testid="accounts-selection-dock"]', (element) => element.textContent),
    /已选 1 项/,
  );

  await page.close();
});

test('剪贴板写入失败时不再误报自动复制成功', async () => {
  const page = await openReadyPage();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException('Clipboard permission denied', 'NotAllowedError');
        },
      },
    });
    window.open = () => null;
  });

  await page.evaluate(() => [...document.querySelectorAll('main button')]
    .find((button) => button.textContent.trim() === '查短信').click());
  await page.waitForFunction(() => document.body.innerText.includes('自动复制失败，请手动复制'));

  const bodyText = await page.$eval('body', (body) => body.innerText);
  assert.match(bodyText, /自动复制\s*接码凭证\(Key\)\s*失败/);
  assert.match(bodyText, /自动复制失败，请手动复制/);
  assert.doesNotMatch(bodyText, /系统已自动复制|已自动复制凭证/);
  await page.close();
});

test('停用账号会保留手机号接码快照，并在失效详情中展示凭证', async () => {
  const fixture = {
    accounts: [{
      id: 'snapshot-account', site: 'Snapshot Service', username: 'snapshot@example.invalid',
      password: 'snapshot-password', expireDate: '2099-12-31', twoFaUrl: 'https://example.invalid/2fa',
      twoFaKey: 'JBSWY3DPEHPK3PXP', emailUrl: 'https://example.invalid/mail',
      emailKey: 'snapshot-email-key', status: 'active',
    }],
    phones: [{
      id: 'snapshot-phone', number: '+1 202-555-0199', expireDate: '2099-12-31',
      smsUrl: 'https://example.invalid/sms', smsKey: 'snapshot-sms-key',
      boundAccountId: 'snapshot-account', status: 'active',
    }],
    phoneAccountHistory: [],
  };
  let savedData;
  const page = await openFixturePage(fixture, {
    onDataPost(submittedData) {
      savedData = submittedData;
    },
  });
  await loginAsAdmin(page);
  await page.waitForFunction(() => document.body.innerText.includes('管理员'));
  await page.click('button[title="停用"]');
  await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
    .find((button) => button.textContent.trim() === '确定').click());
  await page.waitForFunction(() => document.body.innerText.includes('还没有有效账号'));

  assert.deepEqual(JSON.parse(savedData.accounts[0].archivedPhoneSnapshot), {
    number: '+1 202-555-0199',
    smsUrl: 'https://example.invalid/sms',
    smsKey: 'snapshot-sms-key',
  });
  assert.equal(savedData.phones[0].boundAccountId, null);

  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find((button) => button.textContent.includes('Invalid')).click());
  await page.waitForFunction(() => document.body.innerText.includes('Snapshot Service'));
  await page.click('main h3');
  await page.waitForSelector('[role="dialog"]');
  const detailText = await page.$eval('[role="dialog"]', (dialog) => dialog.textContent);
  assert.match(detailText, /snapshot-email-key/);
  assert.match(detailText, /\+1 202-555-0199/);
  assert.match(detailText, /snapshot-sms-key/);
  await page.close();
});
