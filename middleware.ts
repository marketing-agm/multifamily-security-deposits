import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, getSitePassword, expectedToken } from '@/lib/auth';

// Run on everything except Next's static assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public: the home page (the unlock gate lives here) and the auth endpoints.
  if (pathname === '/' || pathname.startsWith('/api/login') || pathname.startsWith('/api/session')) {
    return NextResponse.next();
  }

  const secret = await getSitePassword();
  // No secret configured → gate disabled (fail-open) so the site isn't bricked.
  if (!secret) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken(secret))) {
    return NextResponse.next();
  }

  // Not unlocked → send back to the home page to enter the password.
  const url = req.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url);
}
