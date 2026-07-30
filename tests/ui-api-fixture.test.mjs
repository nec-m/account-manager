import assert from 'node:assert/strict';
import test from 'node:test';
import { createUiApiFixtureController } from './support/ui-api-fixture.mjs';

test('UI API fixture keeps GET and POST data complete and server-authoritative', () => {
  const initialFixture = {
    accounts: [{ id: 'account-fixture', username: 'fixture@example.invalid' }],
    phones: [{ id: 'phone-fixture', boundAccountId: null }],
    phoneAccountHistory: [{
      phoneId: 'phone-fixture',
      accountId: 'account-fixture',
      siteSnapshot: 'Fixture',
      usernameSnapshot: 'fixture@example.invalid',
      firstBoundAt: '2026-07-27T01:00:00.000Z',
      lastBoundAt: '2026-07-27T01:00:00.000Z',
    }],
  };
  const controller = createUiApiFixtureController({ fixture: initialFixture, isAdmin: true });

  const initialGet = controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  });
  assert.equal(initialGet.status, 200);
  assert.deepEqual(JSON.parse(initialGet.body), initialFixture);

  const submittedData = {
    accounts: [{ id: 'account-saved', username: 'saved@example.invalid' }],
    phones: [{ id: 'phone-saved', boundAccountId: null }],
    phoneAccountHistory: [{
      phoneId: 'forged-phone',
      accountId: 'forged-account',
      siteSnapshot: 'Forged',
      usernameSnapshot: 'forged@example.invalid',
      firstBoundAt: '1900-01-01T00:00:00.000Z',
      lastBoundAt: '2999-01-01T00:00:00.000Z',
    }],
  };
  const post = controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'POST',
    postData: JSON.stringify(submittedData),
  });
  assert.equal(post.status, 200);
  assert.deepEqual(JSON.parse(post.body), {
    success: true,
    data: {
      accounts: submittedData.accounts,
      phones: submittedData.phones,
      phoneAccountHistory: initialFixture.phoneAccountHistory,
    },
  });

  const getAfterPost = controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  });
  assert.deepEqual(JSON.parse(getAfterPost.body), JSON.parse(post.body).data);
});

test('UI API fixture blocks anonymous data access until login establishes a session', () => {
  const controller = createUiApiFixtureController({
    fixture: { accounts: [], phones: [], phoneAccountHistory: [] },
    authenticated: false,
  });

  const anonymousSession = controller.handle({
    url: 'http://localhost:3000/api/auth/session',
    method: 'GET',
  });
  assert.equal(anonymousSession.status, 401);
  assert.deepEqual(JSON.parse(anonymousSession.body), {
    error: '请先登录',
    code: 'UNAUTHENTICATED',
  });
  assert.equal(controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  }).status, 401);

  const login = controller.handle({
      url: 'http://localhost:3000/api/auth/login',
      method: 'POST',
      postData: JSON.stringify({ username: 'viewer', password: 'viewer-pass-123' }),
  });
  assert.equal(login.status, 200);
  assert.deepEqual(JSON.parse(login.body).user, {
    id: 'fixture-viewer',
    username: 'viewer',
    role: 'viewer',
    status: 'active',
    mustChangePassword: false,
    lastLoginAt: null,
  });
  assert.equal(controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  }).status, 200);
});

test('UI API fixture enforces viewer and admin write permissions', () => {
  const fixture = {
    accounts: [{ id: 'account-fixture' }],
    phones: [],
    phoneAccountHistory: [],
  };
  const viewerController = createUiApiFixtureController({ fixture });
  assert.equal(viewerController.handle({
    url: 'http://localhost:3000/api/data',
    method: 'POST',
    postData: JSON.stringify(fixture),
  }).status, 403);

  const adminController = createUiApiFixtureController({ fixture, isAdmin: true });
  assert.equal(adminController.handle({
    url: 'http://localhost:3000/api/data',
    method: 'POST',
    postData: JSON.stringify(fixture),
  }).status, 200);
});

test('UI API fixture exposes password-change-required and logout session transitions', () => {
  const controller = createUiApiFixtureController({
    fixture: { accounts: [], phones: [], phoneAccountHistory: [] },
    authenticated: false,
  });

  const invalidLogin = controller.handle({
    url: 'http://localhost:3000/api/auth/login',
    method: 'POST',
    postData: JSON.stringify({ username: 'viewer', password: 'wrong-password' }),
  });
  assert.equal(invalidLogin.status, 401);
  assert.equal(JSON.parse(invalidLogin.body).code, 'INVALID_CREDENTIALS');

  const temporaryLogin = controller.handle({
    url: 'http://localhost:3000/api/auth/login',
    method: 'POST',
    postData: JSON.stringify({ username: 'temporary', password: 'temporary-pass-123' }),
  });
  assert.equal(JSON.parse(temporaryLogin.body).user.mustChangePassword, true);
  assert.equal(controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  }).status, 403);

  const changed = controller.handle({
    url: 'http://localhost:3000/api/auth/change-password',
    method: 'POST',
    postData: JSON.stringify({
      currentPassword: 'temporary-pass-123',
      newPassword: 'new-secure-pass-123',
    }),
  });
  assert.equal(changed.status, 200);
  assert.equal(JSON.parse(changed.body).user.mustChangePassword, false);

  assert.equal(controller.handle({
    url: 'http://localhost:3000/api/auth/logout',
    method: 'POST',
  }).status, 200);
  assert.equal(controller.handle({
    url: 'http://localhost:3000/api/auth/session',
    method: 'GET',
  }).status, 401);
});

test('UI API fixture can expire a loaded session for unauthorized UI regressions', () => {
  const controller = createUiApiFixtureController();
  assert.equal(controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  }).status, 200);

  controller.expireSession();

  assert.equal(controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  }).status, 401);
});

test('UI API fixture can replace authoritative data between simulated sessions', () => {
  const controller = createUiApiFixtureController({
    fixture: {
      accounts: [{ id: 'old-session-account' }],
      phones: [],
      phoneAccountHistory: [],
    },
  });

  controller.replaceData({ accounts: [], phones: [], phoneAccountHistory: [] });

  assert.deepEqual(JSON.parse(controller.handle({
    url: 'http://localhost:3000/api/data',
    method: 'GET',
  }).body), { accounts: [], phones: [], phoneAccountHistory: [] });
});

test('UI API fixture keeps member state and returns temporary passwords only from mutations', () => {
  const controller = createUiApiFixtureController({ isAdmin: true });

  const initialList = controller.handle({
    url: 'http://localhost:3000/api/members',
    method: 'GET',
  });
  assert.equal(initialList.status, 200);
  assert.equal('temporaryPassword' in JSON.parse(initialList.body), false);

  const created = controller.handle({
    url: 'http://localhost:3000/api/members',
    method: 'POST',
    postData: JSON.stringify({ username: 'reader-two' }),
  });
  assert.equal(created.status, 201);
  assert.equal(JSON.parse(created.body).temporaryPassword, 'fixture-created-pass-123');
  const createdMember = JSON.parse(created.body).member;
  assert.deepEqual(createdMember, {
    id: 'fixture-member-reader-two',
    username: 'reader-two',
    role: 'viewer',
    status: 'active',
    mustChangePassword: true,
    createdAt: '2026-07-28T00:00:00.000Z',
    lastLoginAt: null,
  });

  const listAfterCreate = JSON.parse(controller.handle({
    url: 'http://localhost:3000/api/members',
    method: 'GET',
  }).body);
  assert.equal('temporaryPassword' in listAfterCreate, false);
  assert.equal(listAfterCreate.members.some((member) => (
    member.id === createdMember.id && 'temporaryPassword' in member
  )), false);

  const disabled = controller.handle({
    url: `http://localhost:3000/api/members/${createdMember.id}`,
    method: 'PATCH',
    postData: JSON.stringify({ status: 'disabled' }),
  });
  assert.equal(disabled.status, 200);
  assert.equal(JSON.parse(disabled.body).member.status, 'disabled');

  const reset = controller.handle({
    url: `http://localhost:3000/api/members/${createdMember.id}/reset-password`,
    method: 'POST',
    postData: '{}',
  });
  assert.equal(reset.status, 200);
  assert.equal(JSON.parse(reset.body).temporaryPassword, 'fixture-reset-pass-123');
  assert.equal(JSON.parse(reset.body).member.mustChangePassword, true);

  const listAfterReset = JSON.parse(controller.handle({
    url: 'http://localhost:3000/api/members',
    method: 'GET',
  }).body);
  assert.equal('temporaryPassword' in listAfterReset, false);
  assert.equal(JSON.stringify(listAfterReset).includes('fixture-reset-pass-123'), false);
});

test('UI API fixture rejects every member endpoint for viewers', () => {
  const controller = createUiApiFixtureController();
  const calls = [
    { url: 'http://localhost:3000/api/members', method: 'GET' },
    {
      url: 'http://localhost:3000/api/members',
      method: 'POST',
      postData: JSON.stringify({ username: 'forbidden' }),
    },
    {
      url: 'http://localhost:3000/api/members/fixture-viewer',
      method: 'PATCH',
      postData: JSON.stringify({ status: 'disabled' }),
    },
    {
      url: 'http://localhost:3000/api/members/fixture-viewer/reset-password',
      method: 'POST',
      postData: '{}',
    },
  ];

  for (const request of calls) {
    const response = controller.handle(request);
    assert.equal(response.status, 403);
    assert.deepEqual(JSON.parse(response.body), {
      error: '无权执行此操作',
      code: 'FORBIDDEN',
    });
  }
});
