import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baseUrl,
  browser,
  createUiApiFixtureController,
  loginAsAdmin,
  openReadyPage,
} from '../support/ui-e2e-harness.mjs';

test('管理员编辑与确认弹窗共享无障碍弹窗契约', async () => {
  const page = await openReadyPage();
  await loginAsAdmin(page);

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('添加账号'))
      .click();
  });
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', {
    timeout: 2_000,
  });
  await page.keyboard.press('Escape');

  await page.click('button[title="删除"]');
  const confirmDialog = await page.waitForSelector('[role="dialog"][aria-modal="true"]', {
    timeout: 2_000,
  });
  assert.match(
    await confirmDialog.evaluate((element) => element.textContent),
    /确定彻底删除该账号吗/,
  );

  await page.keyboard.press('Escape');
  await page.close();
});

test('桌面账号卡片的图标按钮都有可访问名称', async () => {
  const page = await openReadyPage();
  const unnamedButtons = await page.evaluate(() => (
    [...document.querySelectorAll('main button')].filter((button) => {
      const name = button.getAttribute('aria-label')
        || button.getAttribute('title')
        || button.textContent;
      return !name.trim();
    }).length
  ));

  assert.equal(unnamedButtons, 0);
  await page.close();
});

test('数据加载期间显示与最终布局匹配的骨架屏', async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  const controller = createUiApiFixtureController();
  page.on('request', (request) => {
    if (request.url().endsWith('/api/data')) return;
    const response = controller.handle({
      url: request.url(),
      method: request.method(),
      postData: request.postData(),
    });
    if (response) return request.respond(response);
    request.continue();
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForSelector('[data-testid="dashboard-skeleton"]', {
    timeout: 5_000,
  });
  assert.equal(
    await page.$('main [data-testid="loading-spinner"]'),
    null,
  );

  await page.close();
});

test('数据加载失败后可以重试并进入完整空状态', async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  let dataRequestCount = 0;
  const controller = createUiApiFixtureController();
  page.on('request', (request) => {
    if (!request.url().endsWith('/api/data')) {
      const response = controller.handle({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
      if (response) {
        request.respond(response);
        return;
      }
      request.continue();
      return;
    }

    dataRequestCount += 1;
    if (dataRequestCount === 1) {
      request.respond({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'temporary unavailable' }),
      });
      return;
    }

    request.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts: [], phones: [], phoneAccountHistory: [] }),
    });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const alert = await page.waitForSelector('main [role="alert"]', {
    timeout: 5_000,
  });
  assert.match(
    await alert.evaluate((element) => element.textContent),
    /数据加载失败/,
  );

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('重新加载'))
      .click();
  });
  const emptyState = await page.waitForSelector('[data-testid="empty-state"]', {
    timeout: 5_000,
  });
  assert.match(
    await emptyState.evaluate((element) => element.textContent),
    /还没有有效账号/,
  );
  assert.equal(dataRequestCount, 2);

  await page.close();
});

test('辅助文字在白色面板上达到 WCAG AA 对比度', async () => {
  const page = await openReadyPage();
  const contrast = await page.$eval('main .text-muted-foreground', (element) => {
    const parseRgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = (rgb) => {
      const [red, green, blue] = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const foreground = luminance(parseRgb(getComputedStyle(element).color));
    const background = luminance([255, 255, 255]);
    return (Math.max(foreground, background) + 0.05)
      / (Math.min(foreground, background) + 0.05);
  });

  assert.ok(contrast >= 4.5, `contrast ${contrast.toFixed(2)} is below 4.5`);
  await page.close();
});

test('每个业务视图都有唯一且描述明确的主标题', async () => {
  const page = await openReadyPage();

  const assertMainHeading = async (expectedText) => {
    const headings = await page.$$eval('main h1', (elements) => (
      elements.map((element) => element.textContent.trim())
    ));
    assert.deepEqual(headings, [expectedText]);
  };

  await assertMainHeading('账号资源');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Phones'))
      .click();
  });
  await page.waitForFunction(
    () => document.querySelector('main h1')?.textContent.trim() === '手机号资源',
    { timeout: 2_000 },
  );
  await assertMainHeading('手机号资源');
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Invalid'))
      .click();
  });
  await page.waitForFunction(
    () => document.querySelector('main h1')?.textContent.trim() === '失效与过期资源库',
    { timeout: 2_000 },
  );
  await assertMainHeading('失效与过期资源库');

  const invalidHeadingFont = await page.$eval(
    'main h1',
    (element) => getComputedStyle(element).fontFamily,
  );
  assert.doesNotMatch(invalidHeadingFont.toLowerCase(), /newsreader|times new roman|georgia/);

  await page.close();
});

test('导航下划线切换到 Invalid 时不会临时产生横向溢出', async () => {
  for (const width of [1440, 320]) {
    const page = await openReadyPage();
    try {
      await page.setViewport({ width, height: 900 });
      const samples = await page.evaluate(async () => {
        const nav = document.querySelector('header nav');
        const invalidButton = [...nav.querySelectorAll('button')]
          .find((button) => button.textContent.includes('Invalid'));
        const frames = [];
        const captureFrame = (elapsedMs) => {
          frames.push({
            elapsedMs: Math.round(elapsedMs),
            clientWidth: nav.clientWidth,
            scrollWidth: nav.scrollWidth,
          });
        };

        captureFrame(0);
        invalidButton.click();
        const startedAt = performance.now();
        await new Promise((resolve) => {
          const sample = (timestamp) => {
            captureFrame(timestamp - startedAt);
            if (timestamp - startedAt >= 350) {
              resolve();
              return;
            }
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });

        return frames;
      });
      const overflowingFrame = samples.find(({ scrollWidth, clientWidth }) => (
        scrollWidth > clientWidth
      ));

      assert.equal(
        overflowingFrame,
        undefined,
        overflowingFrame
          ? `${width}px 视口在 ${overflowingFrame.elapsedMs}ms 时横向溢出 ${overflowingFrame.scrollWidth - overflowingFrame.clientWidth}px`
          : undefined,
      );
    } finally {
      await page.close();
    }
  }
});

test('管理员账号与手机号表单的每个控件都有明确标签', async () => {
  const page = await openReadyPage();
  await loginAsAdmin(page);

  const countUnlabelledControls = () => page.$eval(
    '[role="dialog"]',
    (dialog) => [...dialog.querySelectorAll('input, select, textarea')]
      .filter((control) => control.getClientRects().length > 0)
      .filter((control) => {
        const id = control.getAttribute('id');
        return !control.getAttribute('aria-label')
          && !control.getAttribute('aria-labelledby')
          && !(id && dialog.querySelector(`label[for="${id}"]`));
      }).length,
  );

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('添加账号'))
      .click();
  });
  await page.waitForSelector('[role="dialog"]');
  assert.equal(await countUnlabelledControls(), 0);
  await page.keyboard.press('Escape');

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
  await page.waitForSelector('[role="dialog"]');
  assert.equal(await countUnlabelledControls(), 0);

  await page.close();
});

test('管理员表单只使用当前设计系统中的颜色与表面 token', async () => {
  const page = await openReadyPage();
  await loginAsAdmin(page);

  const assertNoLegacyTokens = async () => {
    const dialogMarkup = await page.$eval('[role="dialog"]', (dialog) => dialog.outerHTML);
    assert.doesNotMatch(
      dialogMarkup,
      /var\(--(?:panel-border|text-muted|text-main|btn-bg|btn-text|text)\)/,
    );
  };

  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('添加账号'))
      .click();
  });
  await page.waitForSelector('[role="dialog"]');
  await assertNoLegacyTokens();
  assert.ok(
    await page.$eval('[role="dialog"]', (dialog) => {
      const top = dialog.getBoundingClientRect().top;
      return top >= 16 && top < 200;
    }),
    '账号编辑弹窗顶部应位于当前桌面视口内',
  );
  assert.ok(
    await page.evaluate(() => document.elementFromPoint(8, 8)?.classList.contains('fixed')),
    '弹窗遮罩应覆盖粘性顶栏',
  );
  await page.keyboard.press('Escape');

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
  await page.waitForSelector('[role="dialog"]');
  await assertNoLegacyTokens();
  assert.ok(
    await page.$eval('[role="dialog"]', (dialog) => {
      const top = dialog.getBoundingClientRect().top;
      return top >= 16 && top < 200;
    }),
    '手机号编辑弹窗顶部应位于当前桌面视口内',
  );

  await page.close();
});

test('系统要求减少动态效果时会停用长动画', async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await page.setRequestInterception(true);
  const controller = createUiApiFixtureController();
  page.on('request', (request) => {
    if (request.url().endsWith('/api/data')) return;
    const response = controller.handle({
      url: request.url(),
      method: request.method(),
      postData: request.postData(),
    });
    if (response) return request.respond(response);
    request.continue();
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const pulse = await page.waitForSelector('[data-testid="dashboard-skeleton"].animate-pulse', {
    timeout: 5_000,
  });
  const duration = await pulse.evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).animationDuration) || 0
  ));
  assert.ok(duration <= 0.01, `animation duration ${duration}s is too long`);

  await page.close();
});
