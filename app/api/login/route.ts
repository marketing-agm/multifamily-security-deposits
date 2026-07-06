export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, SESSION_MAX_AGE, getSitePassword, expectedToken } from '@/lib/auth';

// POST /api/login  { password }  → sets the auth cookie on a correct password.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  const secret = await getSitePassword();

  // Gate not configured yet — don't lock anyone out.
  if (!secret) {
    return NextResponse.json({ ok: true, unconfigured: true });
  }

  if (password !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(secret), {
    httpOnly: true,          // JS in the browser can't read it
    secure: true,            // only sent over HTTPS
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
