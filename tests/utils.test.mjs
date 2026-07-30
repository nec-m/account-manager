import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  ensureHttpProtocol,
  findTextSeparator,
  getDefaultExpireDate,
  getSecretDisplayValue,
  toggleListItem,
} from '../lib/utils.js';

const execFileAsync = promisify(execFile);

test('getTodayStr uses the local calendar date in UTC-positive timezones', async () => {
  const moduleUrl = new URL('../lib/utils.js', import.meta.url).href;
  const script = `
    const { getTodayStr } = await import(process.env.UTILS_MODULE_URL);
    process.stdout.write(getTodayStr(new Date('2024-01-01T16:30:00.000Z')));
  `;
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      env: {
        ...process.env,
        TZ: 'Asia/Shanghai',
        UTILS_MODULE_URL: moduleUrl,
      },
    },
  );

  assert.equal(stdout, '2024-01-02');
});

test('shared display and parsing helpers preserve existing UI rules', () => {
  assert.equal(getDefaultExpireDate(new Date('2024-01-15T12:00:00.000Z')), '2024-02-15');
  assert.equal(ensureHttpProtocol('https://example.invalid'), 'https://example.invalid');
  assert.equal(ensureHttpProtocol('example.invalid'), 'https://example.invalid');
  assert.equal(findTextSeparator('user----password,ignored', ['----', '---', ',']), '----');
  assert.equal(findTextSeparator('plain text', ['----', '---', ',']), null);
  assert.equal(getSecretDisplayValue('secret', false), '••••••••');
  assert.equal(getSecretDisplayValue('secret', true), 'secret');
  assert.equal(getSecretDisplayValue('', true), '-');
  assert.deepEqual(toggleListItem(['a', 'b'], 'b'), ['a']);
  assert.deepEqual(toggleListItem(['a'], 'b'), ['a', 'b']);
});
