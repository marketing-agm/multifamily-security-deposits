# Infra — build / Cloudflare Pages / wrangler / tooling / git / devex — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

<!-- log-id: 1354ff2 :: pr-screenshot-verify needs /opt/pw-browsers Chromium path in CHROME_CANDIDATES -->
### 2026-07-02 · infra · gotcha · pr-screenshot-verify needs /opt/pw-browsers Chromium path in CHROME_CANDIDATES
- **Ref:** 1354ff2
- **Symptom:** drive.mjs exits with 'No Chrome/Edge binary found' even though Chromium is installed.
- **Root cause:** PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers is set in the remote env, but drive.mjs hard-codes a fixed list of candidate paths that didn't include the pw-browsers location.
- **Fix:** Added /opt/pw-browsers/chromium-1194/chrome-linux/chrome as the first entry in CHROME_CANDIDATES in drive.mjs.
- **Lesson:** When adding new Chrome candidate paths to drive.mjs for a new environment, put the remote-env path first so it wins without affecting local dev paths.

