const jsonResponse = (body, status = 200, headers) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
  ...(headers ? { headers } : {}),
});

const clone = (value) => structuredClone(value);

const normalizeData = (value = {}) => ({
  accounts: Array.isArray(value.accounts) ? clone(value.accounts) : [],
  phones: Array.isArray(value.phones) ? clone(value.phones) : [],
  phoneAccountHistory: Array.isArray(value.phoneAccountHistory)
    ? clone(value.phoneAccountHistory)
    : [],
});

const getPathname = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
};

const parsePostData = (postData) => {
  try {
    return JSON.parse(postData || '{}');
  } catch {
    return {};
  }
};

const fixtureUser = ({ username, role, mustChangePassword = false }) => ({
  id: `fixture-${username}`,
  username,
  role,
  status: 'active',
  mustChangePassword,
  lastLoginAt: null,
});

const FIXTURE_CREDENTIALS = new Map([
  ['owner', { password: 'owner-pass-123', role: 'admin', mustChangePassword: false }],
  ['viewer', { password: 'viewer-pass-123', role: 'viewer', mustChangePassword: false }],
  ['temporary', { password: 'temporary-pass-123', role: 'viewer', mustChangePassword: true }],
]);

const FIXTURE_MEMBER_NOW = '2026-07-28T00:00:00.000Z';
const FIXTURE_CREATED_PASSWORD = 'fixture-created-pass-123';
const FIXTURE_RESET_PASSWORD = 'fixture-reset-pass-123';
const SESSION_COOKIE = 'account_manager_session';
const sessionCookie = (value) => ({
  'Set-Cookie': `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict`,
});

const fixtureMember = ({
  id,
  username,
  role,
  status = 'active',
  mustChangePassword = false,
  createdAt = FIXTURE_MEMBER_NOW,
  lastLoginAt = null,
}) => ({
  id,
  username,
  role,
  status,
  mustChangePassword,
  createdAt,
  lastLoginAt,
});

const authError = (status, code, error) => jsonResponse({ error, code }, status);

export const SANITIZED_UI_FIXTURE = {
  accounts: [
    {
      id: 'fixture-active-account',
      site: 'Fixture Service',
      username: 'active@example.invalid',
      password: 'fixture-password',
      expireDate: '2099-12-31',
      twoFaUrl: 'https://auth.example.invalid/fixture',
      twoFaKey: 'FIXTURE2FAKEY',
      emailUrl: 'https://mail.example.invalid/fixture',
      emailKey: 'fixture-email-key',
      note: 'sanitized fixture account',
      status: 'active',
      archivedPhoneSnapshot: '',
    },
    {
      id: 'fixture-archived-account',
      site: 'Archived Fixture',
      username: 'archived@example.invalid',
      password: 'archived-fixture-password',
      expireDate: '2000-01-01',
      twoFaUrl: 'https://auth.example.invalid/archived',
      twoFaKey: 'ARCHIVEDFIXTUREKEY',
      emailUrl: 'https://mail.example.invalid/archived',
      emailKey: 'archived-email-key',
      note: 'sanitized archived fixture account',
      status: 'archived',
      archivedPhoneSnapshot: '',
    },
  ],
  phones: [
    {
      id: 'fixture-active-phone',
      number: '+1 202-555-0101',
      expireDate: '2099-12-31',
      smsUrl: 'https://sms.example.invalid/fixture',
      smsKey: 'fixture-sms-key',
      boundAccountId: 'fixture-active-account',
      note: 'sanitized fixture phone',
      status: 'active',
    },
    {
      id: 'fixture-archived-phone',
      number: '+1 202-555-0102',
      expireDate: '2000-01-01',
      smsUrl: 'https://sms.example.invalid/archived',
      smsKey: 'archived-fixture-sms-key',
      boundAccountId: null,
      note: 'sanitized archived fixture phone',
      status: 'archived',
    },
  ],
  phoneAccountHistory: [],
};

export function createUiApiFixtureController({
  fixture = SANITIZED_UI_FIXTURE,
  isAdmin = false,
  authenticated = true,
  mustChangePassword = false,
  onDataPost,
  sessionExpiresInMs = 12 * 60 * 60 * 1000,
} = {}) {
  const credentialsByUsername = new Map(
    [...FIXTURE_CREDENTIALS].map(([username, credentials]) => [
      username,
      { ...credentials, status: 'active' },
    ]),
  );
  let members = [
    fixtureMember({ id: 'fixture-owner', username: 'owner', role: 'admin' }),
    fixtureMember({ id: 'fixture-viewer', username: 'viewer', role: 'viewer' }),
    fixtureMember({
      id: 'fixture-temporary',
      username: 'temporary',
      role: 'viewer',
      mustChangePassword: true,
    }),
  ];
  let currentUser = authenticated
    ? fixtureUser({
      username: mustChangePassword ? 'temporary' : (isAdmin ? 'owner' : 'viewer'),
      role: isAdmin ? 'admin' : 'viewer',
      mustChangePassword,
    })
    : null;
  let expiresAt = new Date(Date.now() + sessionExpiresInMs).toISOString();
  let authoritativeData = normalizeData(fixture);

  const getCurrentUser = () => {
    if (currentUser && Date.parse(expiresAt) <= Date.now()) currentUser = null;
    return currentUser;
  };

  return {
    expireSession() {
      currentUser = null;
    },
    replaceData(nextData) {
      authoritativeData = normalizeData(nextData);
    },
    handle({ url, method = 'GET', postData }) {
      const pathname = getPathname(url);
      const normalizedMethod = method.toUpperCase();

      if (pathname === '/api/auth/login' && normalizedMethod === 'POST') {
        const payload = parsePostData(postData);
        const normalizedUsername = typeof payload.username === 'string'
          ? payload.username.toLowerCase()
          : '';
        const credentials = credentialsByUsername.get(normalizedUsername);
        if (
          !credentials
          || credentials.status !== 'active'
          || credentials.password !== payload.password
        ) {
          return authError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确');
        }
        currentUser = fixtureUser({ username: normalizedUsername, ...credentials });
        expiresAt = new Date(Date.now() + sessionExpiresInMs).toISOString();
        return jsonResponse(
          { user: clone(currentUser), expiresAt },
          200,
          sessionCookie('fixture-login-session'),
        );
      }

      if (pathname === '/api/auth/session' && normalizedMethod === 'GET') {
        if (!getCurrentUser()) return authError(401, 'UNAUTHENTICATED', '请先登录');
        return jsonResponse({ user: clone(currentUser), expiresAt });
      }

      if (pathname === '/api/auth/logout' && normalizedMethod === 'POST') {
        currentUser = null;
        return jsonResponse(
          { success: true },
          200,
          { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` },
        );
      }

      if (pathname === '/api/auth/change-password' && normalizedMethod === 'POST') {
        if (!getCurrentUser()) return authError(401, 'UNAUTHENTICATED', '请先登录');
        const payload = parsePostData(postData);
        const credentials = credentialsByUsername.get(currentUser.username);
        if (typeof payload.currentPassword !== 'string' || payload.currentPassword === '') {
          return authError(400, 'INVALID_CURRENT_PASSWORD', '请输入当前密码');
        }
        if (!credentials || credentials.password !== payload.currentPassword) {
          return authError(401, 'INVALID_CURRENT_PASSWORD', '当前密码不正确');
        }
        currentUser = { ...currentUser, mustChangePassword: false };
        if (credentials) {
          credentials.password = payload.newPassword;
          credentials.mustChangePassword = false;
        }
        members = members.map((member) => (
          member.username === currentUser.username
            ? { ...member, mustChangePassword: false }
            : member
        ));
        expiresAt = new Date(Date.now() + sessionExpiresInMs).toISOString();
        return jsonResponse(
          { user: clone(currentUser), expiresAt },
          200,
          sessionCookie('fixture-change-session'),
        );
      }

      if (pathname === '/api/members' || pathname.startsWith('/api/members/')) {
        if (!getCurrentUser()) return authError(401, 'UNAUTHENTICATED', '请先登录');
        if (currentUser.role !== 'admin') {
          return authError(403, 'FORBIDDEN', '无权执行此操作');
        }
        if (currentUser.mustChangePassword) {
          return authError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改临时密码');
        }

        if (pathname === '/api/members' && normalizedMethod === 'GET') {
          return jsonResponse({ members: clone(members) });
        }

        if (pathname === '/api/members' && normalizedMethod === 'POST') {
          const payload = parsePostData(postData);
          const username = typeof payload.username === 'string' ? payload.username.trim() : '';
          if (username === '') return authError(400, 'INVALID_USERNAME', '用户名不能为空');
          if (members.some((member) => member.username.toLowerCase() === username.toLowerCase())) {
            return authError(409, 'USERNAME_EXISTS', '用户名已存在');
          }
          if (members.length >= 5) return authError(409, 'MEMBER_LIMIT', '成员数量已达上限');

          const member = fixtureMember({
            id: `fixture-member-${username.toLowerCase()}`,
            username,
            role: 'viewer',
            mustChangePassword: true,
          });
          members = [...members, member];
          credentialsByUsername.set(username.toLowerCase(), {
            password: FIXTURE_CREATED_PASSWORD,
            role: 'viewer',
            status: 'active',
            mustChangePassword: true,
          });
          return jsonResponse({
            member: clone(member),
            temporaryPassword: FIXTURE_CREATED_PASSWORD,
          }, 201);
        }

        const resetMatch = pathname.match(/^\/api\/members\/([^/]+)\/reset-password$/);
        if (resetMatch && normalizedMethod === 'POST') {
          const member = members.find((candidate) => candidate.id === resetMatch[1]);
          if (!member) return authError(404, 'MEMBER_NOT_FOUND', '成员不存在');
          if (member.role === 'admin') return authError(409, 'ADMIN_PROTECTED', '不能操作管理员账号');
          const updatedMember = { ...member, mustChangePassword: true };
          members = members.map((candidate) => (
            candidate.id === updatedMember.id ? updatedMember : candidate
          ));
          credentialsByUsername.set(member.username.toLowerCase(), {
            password: FIXTURE_RESET_PASSWORD,
            role: member.role,
            status: member.status,
            mustChangePassword: true,
          });
          return jsonResponse({
            member: clone(updatedMember),
            temporaryPassword: FIXTURE_RESET_PASSWORD,
          });
        }

        const memberMatch = pathname.match(/^\/api\/members\/([^/]+)$/);
        if (memberMatch && normalizedMethod === 'PATCH') {
          const payload = parsePostData(postData);
          if (payload.status !== 'active' && payload.status !== 'disabled') {
            return authError(400, 'INVALID_REQUEST', '请求内容无效');
          }
          const member = members.find((candidate) => candidate.id === memberMatch[1]);
          if (!member) return authError(404, 'MEMBER_NOT_FOUND', '成员不存在');
          if (member.role === 'admin') return authError(409, 'ADMIN_PROTECTED', '不能操作管理员账号');
          const updatedMember = { ...member, status: payload.status };
          members = members.map((candidate) => (
            candidate.id === updatedMember.id ? updatedMember : candidate
          ));
          const credentials = credentialsByUsername.get(member.username.toLowerCase());
          if (credentials) credentials.status = payload.status;
          return jsonResponse({ member: clone(updatedMember) });
        }

        return authError(404, 'NOT_FOUND', '接口不存在');
      }

      if (pathname !== '/api/data') return null;
      if (!getCurrentUser()) return authError(401, 'UNAUTHENTICATED', '请先登录');
      if (currentUser.mustChangePassword) {
        return authError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改临时密码');
      }
      if (normalizedMethod === 'POST') {
        if (currentUser.role !== 'admin') {
          return authError(403, 'FORBIDDEN', '无权执行此操作');
        }
        const submittedData = parsePostData(postData);
        authoritativeData = normalizeData({
          accounts: submittedData.accounts,
          phones: submittedData.phones,
          phoneAccountHistory: authoritativeData.phoneAccountHistory,
        });
        onDataPost?.(clone(submittedData), clone(authoritativeData));
        return jsonResponse({ success: true, data: clone(authoritativeData) });
      }

      return jsonResponse(clone(authoritativeData));
    },
  };
}
