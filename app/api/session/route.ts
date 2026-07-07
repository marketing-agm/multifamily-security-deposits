export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, getSitePassword, expectedToken } from '@/lib/auth';

// GET /api/session → { authed } so the home page knows whether uploads are
// already unlocked (returning visitor with a valid cookie) without re-prompting.
export async function GET(req: NextRequest) {
  const secret = await getSitePassword();

  // Gate not configured → everything is open.
  if (!secret) return NextResponse.json({ authed: true, unconfigured: true });

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const authed = !!token && token === (await expectedToken(secret));
  return NextResponse.json({ authed });
}
