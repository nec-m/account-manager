import { cookies } from 'next/headers';
import { authService } from '@/lib/auth/service';
import { createMemberRouteHandlers } from '@/lib/routeHandlers/members';

const handlers = createMemberRouteHandlers({ service: authService, getCookieStore: cookies });

export async function POST(request, { params }) {
  return handlers.resetViewerPassword(request, { params });
}
