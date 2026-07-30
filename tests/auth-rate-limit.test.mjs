import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoginRateLimiter } from '../lib/auth/rateLimit.js';

test('fifth failure blocks one normalized username for 15 minutes', () => {
  let now = 0;
  const limiter = createLoginRateLimiter({ now: () => now });
  for (let count = 1; count <= 4; count += 1) {
    assert.equal(limiter.recordFailure(' Alice ').allowed, true);
  }
  const blocked = limiter.recordFailure('alice');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 900);
  now += 900_001;
  assert.equal(limiter.check('ALICE').allowed, true);
});

test('thirtieth failure activates the service-wide bucket', () => {
  const limiter = createLoginRateLimiter();
  for (let count = 1; count <= 29; count += 1) {
    limiter.recordFailure(`user-${count}`);
  }
  assert.equal(limiter.recordFailure('user-30').allowed, false);
  assert.equal(limiter.check('unseen-user').allowed, false);
});

test('failure at a window boundary keeps a positive retry time from one clock reading', () => {
  let now = 0;
  let boundaryTimes = [];
  const limiter = createLoginRateLimiter({
    now: () => boundaryTimes.shift() ?? now,
  });
  for (let count = 1; count <= 29; count += 1) {
    limiter.recordFailure(`user-${count}`);
  }

  boundaryTimes = [899_999, 900_000];
  assert.deepEqual(limiter.recordFailure('new-user'), { allowed: false, retryAfterSeconds: 1 });
});

test('success clears only the matching username bucket', () => {
  const limiter = createLoginRateLimiter();
  limiter.recordFailure('viewer-a');
  limiter.recordFailure('viewer-b');
  limiter.recordSuccess('viewer-a');
  for (let count = 1; count <= 4; count += 1) {
    assert.equal(limiter.recordFailure('viewer-a').allowed, true);
  }
  assert.equal(limiter.recordFailure('viewer-a').allowed, false);
  for (let count = 2; count <= 4; count += 1) {
    assert.equal(limiter.recordFailure('viewer-b').allowed, true);
  }
  assert.equal(limiter.recordFailure('viewer-b').allowed, false);
});
