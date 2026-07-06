# Infra — build / Cloudflare Pages / wrangler / tooling / git / devex — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

<!-- log-id: affedc5 :: Password-gating a next-on-pages app with a Cloudflare Secret -->
### 2026-07-06 · infra · gotcha · Password-gating a next-on-pages app with a Cloudflare Secret
- **Ref:** affedc5
- **Symptom:** Needed a login prompt on the site; a NEXT_PUBLIC_ var won't work — it ships to the client and anyone can read it in the bundle.
- **Root cause:** Secrets are only secret if checked on the server. On Cloudflare Pages (@cloudflare/next-on-pages) the secret lives on the edge request context, not process.env in the browser.
- **Fix:** Read SITE_PASSWORD via getRequestContext().env (fallback process.env). /api/login (edge) compares and sets an httpOnly+Secure cookie = SHA-256(secret). middleware.ts validates that cookie against the recomputed hash and redirects to /login otherwise. Matcher excludes /login, /api/login, _next static. Secret set via Dashboard (Type: Secret) or `wrangler pages secret put`; local dev via .dev.vars / .env.local (gitignored).
- **Lesson:** Gate with middleware + a server-verified cookie; never a NEXT_PUBLIC var. Cookie value = hash of the secret so it validates without storing plaintext and can't be forged. Fail OPEN when the secret is unset so a missing secret can't brick the site.


<!-- log-id: 02d9381 :: Turbopack dev serves stale CSS after globals.css token edits -->
### 2026-07-06 · infra · gotcha · Turbopack dev serves stale CSS after globals.css token edits
- **Ref:** 02d9381
- **Symptom:** After editing app/globals.css (adding :root/.dark CSS vars + @theme inline), dark mode rendered as light. getComputedStyle showed --bg empty and the served /_next/static/*.css had zero var(--bg) / --bg definitions — even though `next build` compiled them fine.
- **Root cause:** The running `next dev` server had a stale .next Turbopack cache from before the globals.css change and did not recompile the CSS layer.
- **Fix:** Stop dev, `rm -rf .next`, restart dev. Then the served CSS contains the tokens (var(--bg), --bg:, accent hex, focus-visible).
- **Lesson:** When CSS/token changes don't show up at runtime but `next build` is clean, suspect a stale dev cache — clear .next and restart before debugging the CSS itself. Verify by curling the linked /_next/static/*.css and grepping for your token.


<!-- log-id: 53a077a :: drive.mjs Chromium not found in remote Claude Code environments -->
### 2026-07-06 · infra · gotcha · drive.mjs Chromium not found in remote Claude Code environments
- **Ref:** 53a077a
- **Symptom:** node drive.mjs exits with 'No Chrome/Edge binary found' even though Chromium is installed at /opt/pw-browsers/chromium-1194/chrome-linux/chrome.
- **Root cause:** CHROME_CANDIDATES only listed Windows and macOS paths; the remote Linux environment uses a versioned path under /opt/pw-browsers/.
- **Fix:** Prepend /opt/pw-browsers/chromium-1194/chrome-linux/chrome to CHROME_CANDIDATES in drive.mjs.
- **Lesson:** When the screenshot driver can't find a browser, check /opt/pw-browsers/ first in remote Claude Code environments before attempting a browser download.


<!-- log-id: 7a4a4e6 :: PR #13 sim redirect hid the real Next.js app -->
### 2026-07-06 · infra · gotcha · PR #13 sim redirect hid the real Next.js app
- **Ref:** 7a4a4e6
- **Symptom:** Navigating to / showed the static HTML simulation instead of the Next.js upload page.
- **Root cause:** PR #13 shipped a page.tsx redirect to /sim as part of a Cloudflare preview demo and it was never reverted before merging to main.
- **Fix:** Restore app/page.tsx to the real UploadPage component (7a4a4e6). The /sim route and sim.html can stay for reference.
- **Lesson:** After merging a demo/preview branch, always verify app/page.tsx hasn't been replaced with a redirect. The real app entry point is easy to accidentally overwrite.

