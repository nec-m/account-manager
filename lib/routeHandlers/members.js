import {
  assertSameOrigin,
  jsonNoStore,
  readJsonObject,
  toAuthErrorResponse,
} from '../auth/http.js';
import { AuthError } from '../auth/service.js';
import { SESSION_COOKIE_NAME } from '../auth/session.js';

async function getToken(getCookieStore) {
  const cookieStore = await getCookieStore();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

async function requireAdmin(service, getCookieStore) {
  const token = await getToken(getCookieStore);
  await service.requireSession(token, { roles: ['admin'] });
  return token;
}

export function createMemberRouteHandlers({ service, getCookieStore }) {
  async function listMembers() {
    try {
      const token = await getToken(getCookieStore);
      return jsonNoStore({ members: await service.listMembers(token) });
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  async function createViewer(request) {
    try {
      assertSameOrigin(request);
      const token = await requireAdmin(service, getCookieStore);
      const body = await readJsonObject(request);
      const result = await service.createViewer(token, { username: body.username });
      return jsonNoStore(result, { status: 201 });
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  async function setViewerStatus(request, { params }) {
    try {
      assertSameOrigin(request);
      const token = await requireAdmin(service, getCookieStore);
      const body = await readJsonObject(request);
      const keys = Object.keys(body);
      if (
        keys.length !== 1
        || keys[0] !== 'status'
        || (body.status !== 'active' && body.status !== 'disabled')
      ) {
        throw new AuthError(400, 'INVALID_REQUEST', '请求内容无效');
      }
      const { id } = await params;
      const member = await service.setViewerStatus(token, { id, status: body.status });
      return jsonNoStore({ member });
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  async function resetViewerPassword(request, { params }) {
    try {
      assertSameOrigin(request);
      const { id } = await params;
      const token = await getToken(getCookieStore);
      return jsonNoStore(await service.resetViewerPassword(token, { id }));
    } catch (error) {
      return toAuthErrorResponse(error);
    }
  }

  return { listMembers, createViewer, setViewerStatus, resetViewerPassword };
}
