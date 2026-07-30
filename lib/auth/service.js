import { getDb } from '../db.js';
import {
  assertValidPassword,
  generateTemporaryPassword,
  verifyPassword,
} from './password.js';
import { createLoginRateLimiter } from './rateLimit.js';
import {
  createLoginSession,
  createViewerRecord,
  deleteSession,
  findSessionUser,
  findUserByUsername,
  listMemberRecords,
  MemberRepositoryError,
  PasswordReplacementError,
  replacePasswordAndSession,
  resetViewerPasswordAndRevokeSessions,
  setViewerStatusAndRevokeSessions,
} from './repository.js';

const DUMMY_PASSWORD_HASH = 'scrypt$1$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$qwYWt-MeIKf-Xc4lTEF_XDWYBiHfot_gDnMI6-1T87xB2xLVRmAo2WW2oe2OIFRHyzwstVR4od3Qs0QbEaX6Wg';

export class AuthError extends Error {
  constructor(status, code, message, headers) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
    if (headers !== undefined) this.headers = headers;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt,
  };
}

function memberDto(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function memberRepositoryError(error) {
  if (!(error instanceof MemberRepositoryError)) return error;
  if (error.code === 'USERNAME_EXISTS') {
    return new AuthError(409, 'USERNAME_EXISTS', '用户名已存在');
  }
  if (error.code === 'USER_LIMIT_REACHED') {
    return new AuthError(409, 'USER_LIMIT_REACHED', '成员数量已达上限');
  }
  return new AuthError(409, 'VIEWER_OPERATION_FORBIDDEN', '只能操作查看成员');
}

function toIsoTimestamp(value) {
  const current = value();
  if (current instanceof Date) return current.toISOString();
  if (typeof current === 'number') return new Date(current).toISOString();
  return current;
}

function rateLimitError(result) {
  return new AuthError(429, 'RATE_LIMITED', '登录尝试过于频繁，请稍后再试', {
    'Retry-After': String(result.retryAfterSeconds),
  });
}

export function createAuthService({
  getDb: getDatabase,
  rateLimiter,
  now = () => new Date(),
  verifyPassword: verifyCredential = verifyPassword,
}) {
  async function requireSessionRecord(token, {
    roles,
    allowPasswordChangeRequired = false,
  } = {}) {
    if (typeof token !== 'string' || token === '') {
      throw new AuthError(401, 'UNAUTHENTICATED', '请先登录');
    }

    const db = await getDatabase();
    const user = await findSessionUser(db, token, { now: toIsoTimestamp(now) });
    if (!user) {
      throw new AuthError(401, 'UNAUTHENTICATED', '请先登录');
    }
    if (user.mustChangePassword && !allowPasswordChangeRequired) {
      throw new AuthError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改临时密码');
    }

    let allowedRoles;
    if (roles !== undefined) {
      const roleList = Array.isArray(roles) ? roles : [roles];
      allowedRoles = new Set(roleList);
    }
    if (allowedRoles && !allowedRoles.has(user.role)) {
      throw new AuthError(403, 'FORBIDDEN', '无权执行此操作');
    }

    return { db, user };
  }

  async function requireSession(token, options) {
    const { user } = await requireSessionRecord(token, options);
    return { user: publicUser(user), expiresAt: user.sessionExpiresAt };
  }

  async function login({ username, password } = {}) {
    const checkedUsername = typeof username === 'string' ? username.trim() : String(username ?? '');
    const initialLimit = rateLimiter.check(checkedUsername);
    if (!initialLimit.allowed) throw rateLimitError(initialLimit);

    const db = await getDatabase();
    const user = await findUserByUsername(db, checkedUsername);
    const passwordMatches = await verifyCredential(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || user.status !== 'active' || !passwordMatches) {
      const failureLimit = rateLimiter.recordFailure(checkedUsername);
      if (!failureLimit.allowed) throw rateLimitError(failureLimit);
      throw new AuthError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确');
    }

    rateLimiter.recordSuccess(checkedUsername);
    const session = await createLoginSession(db, {
      userId: user.id,
      now: toIsoTimestamp(now),
    });
    return { token: session.token, expiresAt: session.expiresAt, user: publicUser(user) };
  }

  function getSession(token) {
    return requireSession(token, { allowPasswordChangeRequired: true });
  }

  async function logout(token) {
    if (typeof token === 'string' && token !== '') {
      const db = await getDatabase();
      await deleteSession(db, token);
    }
    return { success: true };
  }

  async function changePassword({ token, currentPassword, newPassword } = {}) {
    const { db, user } = await requireSessionRecord(
      token,
      { allowPasswordChangeRequired: true },
    );
    if (typeof currentPassword !== 'string' || currentPassword === '') {
      throw new AuthError(400, 'INVALID_CURRENT_PASSWORD', '请输入当前密码');
    }
    try {
      assertValidPassword(newPassword);
    } catch (error) {
      throw new AuthError(400, 'INVALID_PASSWORD', error.message);
    }
    if (!(await verifyCredential(currentPassword, user.passwordHash))) {
      throw new AuthError(401, 'INVALID_CURRENT_PASSWORD', '当前密码不正确');
    }

    let replacementSession;
    try {
      replacementSession = await replacePasswordAndSession(db, {
        userId: user.id,
        sessionToken: token,
        expectedPasswordHash: user.passwordHash,
        password: newPassword,
        now: toIsoTimestamp(now),
      });
    } catch (error) {
      if (error instanceof PasswordReplacementError && error.code === 'STALE_SESSION') {
        throw new AuthError(401, 'UNAUTHENTICATED', '登录状态已失效，请重新登录');
      }
      throw error;
    }
    return {
      token: replacementSession.token,
      expiresAt: replacementSession.expiresAt,
      user: { ...publicUser(user), mustChangePassword: false },
    };
  }

  async function listMembers(token) {
    await requireSession(token, { roles: ['admin'] });
    const db = await getDatabase();
    return (await listMemberRecords(db)).map(memberDto);
  }

  async function createViewer(token, { username } = {}) {
    await requireSession(token, { roles: ['admin'] });
    const checkedUsername = typeof username === 'string' ? username.trim() : '';
    if (checkedUsername === '') {
      throw new AuthError(400, 'INVALID_USERNAME', '用户名不能为空');
    }

    const temporaryPassword = generateTemporaryPassword();
    try {
      const db = await getDatabase();
      const member = await createViewerRecord(db, {
        username: checkedUsername,
        password: temporaryPassword,
        now: toIsoTimestamp(now),
      });
      return { member: memberDto(member), temporaryPassword };
    } catch (error) {
      throw memberRepositoryError(error);
    }
  }

  async function setViewerStatus(token, { id, status } = {}) {
    await requireSession(token, { roles: ['admin'] });
    if (typeof id !== 'string' || id === '') {
      throw new AuthError(400, 'INVALID_MEMBER_ID', '成员 ID 无效');
    }
    if (status !== 'active' && status !== 'disabled') {
      throw new AuthError(400, 'INVALID_STATUS', '成员状态无效');
    }

    try {
      const db = await getDatabase();
      const member = await setViewerStatusAndRevokeSessions(db, {
        id,
        status,
        now: toIsoTimestamp(now),
      });
      return memberDto(member);
    } catch (error) {
      throw memberRepositoryError(error);
    }
  }

  async function resetViewerPassword(token, { id } = {}) {
    await requireSession(token, { roles: ['admin'] });
    if (typeof id !== 'string' || id === '') {
      throw new AuthError(400, 'INVALID_MEMBER_ID', '成员 ID 无效');
    }

    const temporaryPassword = generateTemporaryPassword();
    try {
      const db = await getDatabase();
      const member = await resetViewerPasswordAndRevokeSessions(db, {
        id,
        password: temporaryPassword,
        now: toIsoTimestamp(now),
      });
      return { member: memberDto(member), temporaryPassword };
    } catch (error) {
      throw memberRepositoryError(error);
    }
  }

  return {
    login,
    getSession,
    requireSession,
    logout,
    changePassword,
    listMembers,
    createViewer,
    setViewerStatus,
    resetViewerPassword,
  };
}

export const authService = createAuthService({
  getDb,
  rateLimiter: createLoginRateLimiter(),
});
