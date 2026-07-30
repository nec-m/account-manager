import { TOTP } from 'otplib';
import { cookies } from 'next/headers';
import { authService } from '@/lib/auth/service';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { createFetchCodePostHandler } from '@/lib/routeHandlers/fetchCode';

async function authorize(roles) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return authService.requireSession(token, { roles });
}

export const POST = createFetchCodePostHandler({
  authorize,
  generateTotp: (options) => new TOTP().generate(options),
});
