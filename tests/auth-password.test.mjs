import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidPassword,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from '../lib/auth/password.js';

test('scrypt hashes use independent salts and verify without exposing plaintext', async () => {
  const first = await hashPassword('correct-horse');
  const second = await hashPassword('correct-horse');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('correct-horse', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(first.includes('correct-horse'), false);
});

test('password verification rejects an otherwise valid hash with an illegal base64url character', async () => {
  const encodedHash = await hashPassword('correct-horse');
  assert.equal(await verifyPassword('correct-horse', `${encodedHash}!`), false);
});

test('password rule rejects fewer than 10 characters', () => {
  assert.throws(() => assertValidPassword('short'), /至少 10 个字符/);
  assert.doesNotThrow(() => assertValidPassword('0123456789'));
});

test('temporary passwords satisfy the same rule and are not repeated', () => {
  const first = generateTemporaryPassword();
  const second = generateTemporaryPassword();
  assert.doesNotThrow(() => assertValidPassword(first));
  assert.notEqual(first, second);
});
