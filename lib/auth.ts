// Site password gate — shared helpers used by both the login API route and the
// middleware. The password itself (SITE_PASSWORD) is a Cloudflare **Secret**; it
// is only ever read on the server and is never sent to the browser.

export const AUTH_COOKIE = 'agm_auth';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

// Read the SITE_PASSWORD secret from the runtime.
// On Cloudflare (production / `wrangler pages dev`) it lives on the request
// context; under plain `next dev` it may come from process.env / .env. Returns
// undefined when it isn't configured — callers treat that as "gate disabled".
export async function getSitePassword(): Promise<string | undefined> {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const env = getRequestContext().env as { SITE_PASSWORD?: string };
    if (env?.SITE_PASSWORD) return env.SITE_PASSWORD;
  } catch {
    // Not running on the Cloudflare runtime (e.g. `next dev` / build) — fall through.
  }
  return process.env.SITE_PASSWORD;
}

// The value we store in the auth cookie: a SHA-256 hash of the secret. This lets
// middleware verify a session without keeping the plaintext around, and it can't
// be forged without knowing the secret. (Uses Web Crypto, available at the edge.)
export async function expectedToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode('agm-gate:v1:' + secret);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
