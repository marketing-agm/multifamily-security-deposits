import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, getSitePassword, expectedToken } from '@/lib/auth';

// Run on every route EXCEPT the login page, the login API, and Next's static
// assets (which the login page itself needs to load).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/login).*)'],
};

export async function middleware(req: NextRequest) {
  const secret = await getSitePassword();

  // No secret configured → gate is disabled (fail-open so the site isn't bricked
  // before SITE_PASSWORD is set). Setting the secret turns the gate on.
  if (!secret) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken(secret))) {
    return NextResponse.next();
  }

  // Not authenticated → send to the login page, remembering where they wanted to go.
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}
