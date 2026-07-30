import { cookies } from 'next/headers';
import { authService } from '@/lib/auth/service';
import { createAuthRouteHandlers } from '@/lib/routeHandlers/auth';

const handlers = createAuthRouteHandlers({ service: authService, getCookieStore: cookies });

export async function GET(request) {
  return handlers.session(request);
}
