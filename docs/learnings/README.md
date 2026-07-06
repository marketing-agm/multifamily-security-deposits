# Learnings index

Cross-session record of fixes and gotchas. **Before fixing in an area, grep its file for prior lessons; after fixing, add an entry** via the `learnings-log` skill (`scripts/log.mjs`). Full entries live in the per-area files; one line per entry below, newest first.

## ui
_(none yet)_

## lib
_(none yet)_

## infra
- [2026-07-06] gotcha — app/page.tsx was overwritten by the sim demo PR to redirect to /sim. The real upload page and all downstream screens were unreachable from the root URL. (7a4a4e6)

## misc
_(none yet)_
