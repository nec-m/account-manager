import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '../..');
const nextCliPath = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const desktopUiTestPath = path.join(projectRoot, 'tests', 'desktop-ui.e2e.mjs');
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getAvailablePort(host) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, host, () => {
      const address = probe.address();
      probe.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function spawnManaged(command, args, options) {
  const child = spawn(command, args, options);
  child.spawnError = null;
  child.on('error', (error) => {
    child.spawnError = error;
  });
  return child;
}

async function waitForServer(baseUrl, serverProcess, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverProcess.spawnError) throw serverProcess.spawnError;
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error(
        `UI server exited before readiness (code: ${serverProcess.exitCode}, signal: ${serverProcess.signalCode})`,
      );
    }

    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
      // Next 尚未监听或仍在编译时继续进行条件轮询。
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for UI server at ${baseUrl}`);
}

async function waitForChild(child) {
  if (child.spawnError) throw child.spawnError;
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const exitPromise = waitForChild(child).catch(() => null);
  child.kill('SIGTERM');
  const exited = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5_000);
    exitPromise.then(() => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
  if (!exited) {
    child.kill('SIGKILL');
    await exitPromise;
  }
}

function createDefaultServerCommand({ host, port }) {
  return {
    command: process.execPath,
    args: [nextCliPath, 'dev', '-H', host, '-p', String(port)],
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  };
}

function createDefaultTestCommand() {
  return {
    command: process.execPath,
    args: ['--test', desktopUiTestPath],
  };
}

export async function runUiTests({
  host = '127.0.0.1',
  port,
  cwd = projectRoot,
  stdio = 'inherit',
  readinessTimeoutMs = 60_000,
  createServerCommand = createDefaultServerCommand,
  createTestCommand = createDefaultTestCommand,
} = {}) {
  const selectedPort = port ?? await getAvailablePort(host);
  const baseUrl = `http://${host}:${selectedPort}`;
  const serverCommand = createServerCommand({ baseUrl, host, port: selectedPort });
  const serverProcess = spawnManaged(serverCommand.command, serverCommand.args, {
    cwd,
    env: { ...process.env, ...serverCommand.env },
    stdio,
  });
  let testProcess;

  const stopForSignal = (signal) => {
    testProcess?.kill(signal);
    serverProcess.kill('SIGTERM');
  };
  const stopForSigint = () => stopForSignal('SIGINT');
  const stopForSigterm = () => stopForSignal('SIGTERM');
  process.once('SIGINT', stopForSigint);
  process.once('SIGTERM', stopForSigterm);

  try {
    await waitForServer(baseUrl, serverProcess, readinessTimeoutMs);
    const testCommand = createTestCommand({ baseUrl, host, port: selectedPort });
    testProcess = spawnManaged(testCommand.command, testCommand.args, {
      cwd,
      env: {
        ...process.env,
        ...testCommand.env,
        UI_BASE_URL: baseUrl,
      },
      stdio,
    });
    const result = await waitForChild(testProcess);
    if (result.code !== 0) {
      throw new Error(`UI tests failed (code: ${result.code}, signal: ${result.signal})`);
    }
    return { baseUrl, port: selectedPort };
  } finally {
    process.removeListener('SIGINT', stopForSigint);
    process.removeListener('SIGTERM', stopForSigterm);
    await stopChildProcess(testProcess);
    await stopChildProcess(serverProcess);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    await runUiTests();
  } catch (error) {
    console.error('[UI 测试] 执行失败:', error);
    process.exitCode = 1;
  }
}
