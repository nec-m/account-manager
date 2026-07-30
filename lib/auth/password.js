import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const FORMAT = 'scrypt$1';
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const scryptAsync = promisify(scrypt);

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}

export function assertValidPassword(password) {
  if (typeof password !== 'string' || password.length < 10) {
    throw new TypeError('密码至少 10 个字符');
  }
}

export async function hashPassword(password) {
  assertValidPassword(password);
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return `${FORMAT}$${N}$${R}$${P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string') {
    return false;
  }

  const parts = encodedHash.split('$');
  if (
    parts.length !== 7
    || `${parts[0]}$${parts[1]}` !== FORMAT
    || parts[2] !== String(N)
    || parts[3] !== String(R)
    || parts[4] !== String(P)
  ) {
    return false;
  }

  try {
    const salt = decodeBase64Url(parts[5]);
    const expectedHash = decodeBase64Url(parts[6]);
    if (
      salt === null
      || expectedHash === null
      || salt.length !== SALT_LENGTH
      || expectedHash.length !== KEY_LENGTH
    ) {
      return false;
    }

    const actualHash = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P });
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

export function generateTemporaryPassword() {
  return randomBytes(18).toString('base64url');
}
