# Learnings index

Cross-session record of fixes and gotchas. **Before fixing in an area, grep its file for prior lessons; after fixing, add an entry** via the `learnings-log` skill (`scripts/log.mjs`). Full entries live in the per-area files; one line per entry below, newest first.

## ui
- [2026-07-06] bug — A pre-paint inline script adds the .dark class to <html>, but React stripped it on hydration because the JSX className didn't include it. (3ea2e35)
- [2026-07-06] gotcha — Semantic design tokens in globals.css remove per-element dark:bg-[#hex] duplication and centralize the palette. (2333f85)

## lib
- [2026-07-06] bug — Dashboard showed 0 tenants after uploading a real AppFolio Excel export because the parser misread the file structure. (2618a8f)

## infra
- [2026-07-06] gotcha — next dev (Turbopack) kept serving pre-edit globals.css, so new design tokens / dark-mode vars were missing at runtime despite a passing build. (02d9381)
- [2026-07-06] gotcha — The pr-screenshot-verify CHROME_CANDIDATES list was missing the Linux Chromium path used in remote Claude Code containers. (53a077a)
- [2026-07-06] gotcha — app/page.tsx was overwritten by the sim demo PR to redirect to /sim. The real upload page and all downstream screens were unreachable from the root URL. (7a4a4e6)

## misc
_(none yet)_
