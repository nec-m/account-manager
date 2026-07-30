import assert from 'node:assert/strict';
import test from 'node:test';
import puppeteer from 'puppeteer';
import {
  createUiApiFixtureController,
  SANITIZED_UI_FIXTURE,
} from './ui-api-fixture.mjs';
import { createBrowserLaunchOptions } from './browser-launch-options.mjs';

const baseUrl = process.env.UI_BASE_URL || 'http://localhost:3000';

let browser;

test.before(async () => {
  browser = await puppeteer.launch(createBrowserLaunchOptions(process.env.CHROME_PATH));
});

test.after(async () => {
  await browser?.close();
});

async function openReadyPage() {
  return openFixturePage(SANITIZED_UI_FIXTURE);
}

async function openFixturePage(fixture, {
  isAdmin = false,
  authenticated = true,
  mustChangePassword = false,
  onDataPost,
  requestedPaths,
  responseDelays = {},
  responsePlans = {},
  sessionExpiresInMs,
  waitForData = authenticated && !mustChangePassword,
} = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  const controller = createUiApiFixtureController({
    fixture,
    isAdmin,
    authenticated,
    mustChangePassword,
    onDataPost,
    sessionExpiresInMs,
  });
  page.uiFixtureController = controller;
  if (authenticated) {
    await page.setCookie({
      name: 'account_manager_session',
      value: 'fixture-initial-session',
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Strict',
    });
  }
  const requestCounts = new Map();
  page.on('request', async (request) => {
    const pathname = new URL(request.url()).pathname;
    requestedPaths?.push(pathname);
    const requestIndex = requestCounts.get(pathname) ?? 0;
    requestCounts.set(pathname, requestIndex + 1);
    const responsePlan = responsePlans[pathname]?.[requestIndex];
    const hasPlannedResponse = responsePlan
      && Object.prototype.hasOwnProperty.call(responsePlan, 'response');
    const response = hasPlannedResponse
      ? responsePlan.response
      : controller.handle({
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      });
    const delay = responsePlan?.delay ?? responseDelays[pathname] ?? 0;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    if (request.isInterceptResolutionHandled()) return;
    if (response) return request.respond(response);
    return request.continue();
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  if (!authenticated) {
    await page.waitForSelector('#login-username', { timeout: 15_000 });
  } else if (mustChangePassword) {
    await page.waitForSelector('#new-password', { timeout: 15_000 });
  } else if (waitForData) {
    await page.waitForFunction(
      () => document.querySelectorAll('main h3').length > 0,
      { timeout: 15_000 },
    );
  }
  return page;
}

async function waitForRequestCount(requestedPaths, pathname, expectedCount, timeout = 2_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (requestedPaths.filter((value) => value === pathname).length >= expectedCount) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`timed out waiting for ${pathname} request ${expectedCount}`);
}

async function loginThroughForm(page, username = 'viewer', password = 'viewer-pass-123') {
  await page.type('#login-username', username);
  await page.type('#login-password', password);
  await page.keyboard.press('Enter');
}

async function loginAsAdmin(page) {
  const response = await page.evaluate(async () => {
    const result = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'owner-pass-123' }),
    });
    return result.status;
  });
  assert.equal(response, 200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelectorAll('main h3').length > 0,
    { timeout: 15_000 },
  );
}

async function forceCloseMemberDialogFromParent(page) {
  await page.evaluate(() => {
    const trigger = document.querySelector('button[title="成员管理"]');
    const fiberKey = Object.keys(trigger).find((key) => key.startsWith('__reactFiber$'));
    let fiber = trigger[fiberKey];
    while (fiber) {
      const firstHook = fiber.memoizedState;
      if (firstHook?.memoizedState === 'members' && firstHook.queue?.dispatch) {
        firstHook.queue.dispatch(null);
        return;
      }
      fiber = fiber.return;
    }
    throw new Error('SessionControls dialog state was not found');
  });
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
}

export {
  SANITIZED_UI_FIXTURE,
  baseUrl,
  browser,
  createUiApiFixtureController,
  forceCloseMemberDialogFromParent,
  loginAsAdmin,
  loginThroughForm,
  openFixturePage,
  openReadyPage,
  waitForRequestCount,
};
