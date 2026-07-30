const WINDOW_MS = 15 * 60 * 1000;
const USERNAME_FAILURE_LIMIT = 5;
const GLOBAL_FAILURE_LIMIT = 30;

function normalizeUsername(username) {
  return String(username).trim().toLowerCase();
}

function pruneFailures(failures, now) {
  const windowStart = now - WINDOW_MS;
  return failures.filter((timestamp) => timestamp > windowStart);
}

function getRetryAfterSeconds(failures, now) {
  return Math.ceil((failures[0] + WINDOW_MS - now) / 1000);
}

export function createLoginRateLimiter({ now = () => Date.now() } = {}) {
  const usernameFailures = new Map();
  let globalFailures = [];

  function getActiveUsernameFailures(username, currentTime) {
    const normalizedUsername = normalizeUsername(username);
    const failures = pruneFailures(usernameFailures.get(normalizedUsername) ?? [], currentTime);
    if (failures.length === 0) {
      usernameFailures.delete(normalizedUsername);
    } else {
      usernameFailures.set(normalizedUsername, failures);
    }
    return { normalizedUsername, failures };
  }

  function checkAt(username, currentTime) {
    globalFailures = pruneFailures(globalFailures, currentTime);
    const { failures } = getActiveUsernameFailures(username, currentTime);

    if (failures.length >= USERNAME_FAILURE_LIMIT) {
      return { allowed: false, retryAfterSeconds: getRetryAfterSeconds(failures, currentTime) };
    }
    if (globalFailures.length >= GLOBAL_FAILURE_LIMIT) {
      return { allowed: false, retryAfterSeconds: getRetryAfterSeconds(globalFailures, currentTime) };
    }
    return { allowed: true };
  }

  function check(username) {
    return checkAt(username, now());
  }

  function recordFailure(username) {
    const currentTime = now();
    const existingResult = checkAt(username, currentTime);
    if (!existingResult.allowed) {
      return existingResult;
    }

    const { normalizedUsername, failures } = getActiveUsernameFailures(username, currentTime);
    const nextUsernameFailures = [...failures, currentTime];
    usernameFailures.set(normalizedUsername, nextUsernameFailures);
    globalFailures = [...globalFailures, currentTime];

    if (nextUsernameFailures.length >= USERNAME_FAILURE_LIMIT) {
      return { allowed: false, retryAfterSeconds: getRetryAfterSeconds(nextUsernameFailures, currentTime) };
    }
    if (globalFailures.length >= GLOBAL_FAILURE_LIMIT) {
      return { allowed: false, retryAfterSeconds: getRetryAfterSeconds(globalFailures, currentTime) };
    }
    return { allowed: true };
  }

  function recordSuccess(username) {
    usernameFailures.delete(normalizeUsername(username));
  }

  function reset() {
    usernameFailures.clear();
    globalFailures = [];
  }

  return { check, recordFailure, recordSuccess, reset };
}
