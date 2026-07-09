export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, getSitePassword, expectedToken } from '@/lib/auth';

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
    // No maxAge/expires → a SESSION cookie: the browser drops it when the browser
    // session ends, so auth never outlives the browser. Per-tab re-prompting is
    // handled client-side by the sessionStorage flag (see app/page.tsx).
  });
  return res;
}
