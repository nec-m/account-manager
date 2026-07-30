import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const windowsStartScript = path.resolve('scripts/start-windows.bat');
const linuxStartScript = path.resolve('scripts/start-linux.sh');

async function createFakeNpm(t, { buildExitCode = 17 } = {}) {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'account-manager-start-script-'));
  const npmLog = path.join(temporaryDirectory, 'npm-calls.log');
  const launcher = path.join(temporaryDirectory, 'run-start.bat');
  await writeFile(path.join(temporaryDirectory, 'npm.cmd'), `@echo off
echo %*>> "%NPM_CALL_LOG%"
if "%1 %2"=="run build" exit /b ${buildExitCode}
if "%1"=="start" exit /b 0
exit /b 0
`);
  await writeFile(launcher, `@echo off
echo 2|call "${windowsStartScript}"
exit /b %errorlevel%
`);
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  return { temporaryDirectory, npmLog };
}

function createWindowsEnvironment(temporaryDirectory, extra) {
  const env = { ...process.env };
  delete env.PATH;
  delete env.Path;
  return {
    ...env,
    Path: `${temporaryDirectory};${process.env.Path || process.env.PATH}`,
    ...extra,
  };
}

function runWindowsStart(cwd, env) {
  return execFileAsync('cmd.exe', [
    '/d',
    '/s',
    '/c',
    'call run-start.bat',
  ], { cwd, env });
}

test('Windows production start exits nonzero when bootstrap configuration is missing', async (t) => {
  const { temporaryDirectory, npmLog } = await createFakeNpm(t);
  const result = await runWindowsStart(temporaryDirectory, createWindowsEnvironment(temporaryDirectory, {
    NPM_CALL_LOG: npmLog,
    INITIAL_ADMIN_USERNAME: '',
    INITIAL_ADMIN_PASSWORD: '',
    AUTH_COOKIE_SECURE: '',
  })).catch((error) => error);

  assert.match(result.stdout, /Production startup requires/);
  assert.equal(result.code, 1);
  await assert.rejects(() => readFile(npmLog, 'utf8'));
});

test('Windows production start stops after a failed build', async (t) => {
  const { temporaryDirectory, npmLog } = await createFakeNpm(t);
  const result = await runWindowsStart(temporaryDirectory, createWindowsEnvironment(temporaryDirectory, {
    NPM_CALL_LOG: npmLog,
    INITIAL_ADMIN_USERNAME: 'probe-admin',
    INITIAL_ADMIN_PASSWORD: 'probe-password-123',
    AUTH_COOKIE_SECURE: 'false',
  })).catch((error) => error);

  assert.match(result.stdout, /Building project/);
  assert.equal(result.code, 1);
  assert.deepEqual((await readFile(npmLog, 'utf8')).trim().split(/\r?\n/), ['run build']);
});

test('Windows production start returns zero after a successful build and start', async (t) => {
  const { temporaryDirectory, npmLog } = await createFakeNpm(t, { buildExitCode: 0 });
  const result = await runWindowsStart(temporaryDirectory, createWindowsEnvironment(temporaryDirectory, {
    NPM_CALL_LOG: npmLog,
    INITIAL_ADMIN_USERNAME: 'probe-admin',
    INITIAL_ADMIN_PASSWORD: 'probe-password-123',
    AUTH_COOKIE_SECURE: 'false',
  }));

  assert.match(result.stdout, /Build complete/);
  assert.deepEqual((await readFile(npmLog, 'utf8')).trim().split(/\r?\n/), ['run build', 'start']);
});

test('Linux production start exits before npm start when the build fails', async () => {
  const script = await readFile(linuxStartScript, 'utf8');

  assert.match(
    script,
    /if ! npm run build; then\s+echo "构建失败，未启动生产服务。"\s+exit 1\s+fi\s+echo ""\s+echo "构建完毕[^\n]*"\s+npm start/,
  );
});
