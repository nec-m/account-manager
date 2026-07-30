import {
  assertSameOrigin,
  jsonNoStore,
  readJsonObject,
  toAuthErrorResponse,
} from '../auth/http.js';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '../auth/session.js';

export function createAuthRouteHandlers({ service, getCookieStore }) {
  async function login(request) {
    try {
      assertSameOrigin(request);
      const credentials = await readJsonObject(request);
      const result = await service.login(credentials);
      const cookieStore = await getCookieStore();
      cookieStore.set(SESSION_COOKIE_NAME, result.token, getSessionCookieOptions());
      return jsonNoStore({ user: result.user, expiresAt: result.expiresAt });
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  async function session() {
    try {
      const cookieStore = await getCookieStore();
      const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      return jsonNoStore(await service.getSession(token));
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  async function logout(request) {
    try {
      assertSameOrigin(request);
      const cookieStore = await getCookieStore();
      const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      await service.logout(token);
      cookieStore.delete(SESSION_COOKIE_NAME);
      return jsonNoStore({ success: true });
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  async function changePassword(request) {
    try {
      assertSameOrigin(request);
      const cookieStore = await getCookieStore();
      const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      await service.requireSession(token, { allowPasswordChangeRequired: true });
      const body = await readJsonObject(request);
      const result = await service.changePassword({
        token,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
      cookieStore.set(SESSION_COOKIE_NAME, result.token, getSessionCookieOptions());
      return jsonNoStore({ user: result.user, expiresAt: result.expiresAt });
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  return { login, session, logout, changePassword };
}
