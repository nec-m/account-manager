import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createBrowserLaunchOptions } from './support/browser-launch-options.mjs';
import { runUiTests } from './support/run-ui-tests.mjs';

async function createUiRunnerFixture(t) {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'account-manager-ui-runner-'));
  const serverScript = path.join(temporaryDirectory, 'server.mjs');
  const childServerScript = path.join(temporaryDirectory, 'child-server.mjs');
  const testScript = path.join(temporaryDirectory, 'test-client.mjs');
  const markerPath = path.join(temporaryDirectory, 'base-url.txt');
  const serverPidPath = path.join(temporaryDirectory, 'server-child-pid.txt');

  t.after(async () => {
    const childPid = Number(await readFile(serverPidPath, 'utf8').catch(() => ''));
    if (Number.isInteger(childPid) && childPid > 0) {
      try {
        process.kill(childPid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  await writeFile(childServerScript, `
    import http from 'node:http';
    const server = http.createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ready');
    });
    server.listen(Number(process.env.UI_TEST_PORT), '127.0.0.1');
  `, 'utf8');

  await writeFile(serverScript, `
    import { spawn } from 'node:child_process';
    import { writeFile } from 'node:fs/promises';
    const child = spawn(process.execPath, [process.env.UI_TEST_CHILD_SERVER], {
      env: process.env,
      stdio: 'ignore',
    });
    await writeFile(process.env.UI_TEST_SERVER_PID, String(child.pid), 'utf8');
    const stop = (signal) => {
      child.kill(signal);
      process.exit(0);
    };
    process.on('SIGINT', () => stop('SIGINT'));
    process.on('SIGTERM', () => stop('SIGTERM'));
    setInterval(() => {}, 1_000);
  `, 'utf8');
  await writeFile(testScript, `
    import { writeFile } from 'node:fs/promises';
    const response = await fetch(process.env.UI_BASE_URL);
    if (!response.ok) throw new Error('fixture server was not ready');
    await writeFile(process.env.UI_TEST_MARKER, process.env.UI_BASE_URL, 'utf8');
    if (process.env.UI_TEST_EXIT_CODE) {
      process.exitCode = Number(process.env.UI_TEST_EXIT_CODE);
    }
  `, 'utf8');

  return {
    childServerScript,
    markerPath,
    serverPidPath,
    serverScript,
    testScript,
  };
}

function createFixtureServerCommand(fixture, port) {
  return {
    command: process.execPath,
    args: [fixture.serverScript],
    env: {
      UI_TEST_CHILD_SERVER: fixture.childServerScript,
      UI_TEST_PORT: String(port),
      UI_TEST_SERVER_PID: fixture.serverPidPath,
    },
  };
}

test('browser launch options omit executablePath unless CHROME_PATH is explicit', () => {
  assert.deepEqual(createBrowserLaunchOptions(undefined), {
    headless: true,
    args: ['--no-sandbox'],
  });
  assert.deepEqual(createBrowserLaunchOptions('./test-browser/chrome'), {
    headless: true,
    args: ['--no-sandbox'],
    executablePath: './test-browser/chrome',
  });
});

test('runUiTests starts a server, passes its URL, and stops it afterward', async (t) => {
  const fixture = await createUiRunnerFixture(t);
  const result = await runUiTests({
    stdio: 'ignore',
    createServerCommand: ({ port }) => createFixtureServerCommand(fixture, port),
    createTestCommand: () => ({
      command: process.execPath,
      args: [fixture.testScript],
      env: { UI_TEST_MARKER: fixture.markerPath },
    }),
  });

  assert.equal(await readFile(fixture.markerPath, 'utf8'), result.baseUrl);
  await assert.rejects(fetch(result.baseUrl));
});

test('runUiTests stops the server process tree when UI tests fail', async (t) => {
  const fixture = await createUiRunnerFixture(t);
  await assert.rejects(
    runUiTests({
      stdio: 'ignore',
      createServerCommand: ({ port }) => createFixtureServerCommand(fixture, port),
      createTestCommand: () => ({
        command: process.execPath,
        args: [fixture.testScript],
        env: {
          UI_TEST_EXIT_CODE: '17',
          UI_TEST_MARKER: fixture.markerPath,
        },
      }),
    }),
    /UI tests failed \(code: 17, signal: null\)/,
  );

  const baseUrl = await readFile(fixture.markerPath, 'utf8');
  await assert.rejects(fetch(baseUrl));
});
