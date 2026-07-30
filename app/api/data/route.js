import { readData, writeData } from '@/lib/db';
import { cookies } from 'next/headers';
import { assertSameOrigin } from '@/lib/auth/http';
import { authService } from '@/lib/auth/service';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { createDataRouteHandlers } from '@/lib/routeHandlers/data';

async function authorize(roles) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return authService.requireSession(token, { roles });
}

const handlers = createDataRouteHandlers({
  readData,
  writeData,
  authorize,
  verifyOrigin: assertSameOrigin,
});

export async function GET(request) {
  return handlers.GET(request);
}

export async function POST(request) {
  return handlers.POST(request);
}
