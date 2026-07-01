---
name: pr-screenshot-verify
description: After a front-end change is committed, pushed, and opened as a PR on the multifamily-security-deposits repo (Next.js App Router in app/ + components/), run a browser screenshot-verification pass and post the screenshots into the PR as a comment. Drives the running `next dev` server, seeds the app's localStorage session (there is no backend API), captures the surface the change touches, and comments on the PR via the stored git credential (no gh CLI). Use whenever a PR touches app/**, components/**, or context/** and a PR is already open. Triggers: "screenshot the PR", "verify the PR visually", "post screenshots to the PR", or after opening a front-end PR.
---

# PR Screenshot Verification

Turn a freshly opened PR into a visually-verified one: launch the app, drive the **real** UI in a headless browser with a seeded session, screenshot the surface your change touched, and post those screenshots as a PR comment.

**Prerequisite:** the change is already committed, pushed, and a PR exists (you have its number). This skill is the *verification* step, not the commit step.

**Surface check:** this is for things you can see — the dashboard, the return form, the review screen, badges/tags/banners under `app/` and `components/`. Backend-only or docs-only changes have no visual surface; skip it (or just note `npm run build` passed).

## How this app is driven (app notes)

- **No backend API.** All state lives in one `localStorage` key, `agm_deposit_session`, holding `{ propertyName, uploadDate, returns: TenantReturn[] }` (see `types/index.ts`). The driver **seeds** that key before the page loads instead of mocking a network layer.
- **Routes:** `/` (upload, needs no session), `/dashboard`, `/return/[id]`, `/review/[id]`. The `id` format is `"unit-index"`, e.g. `101-0`.
- **Redirect gotcha:** the data pages redirect to `/` when the session is null *during first render*, so a direct deep-link bounces before the seeded session loads. The driver therefore starts every shot at `/` and reaches the target screen via in-app clicks (see the helpers in `scenarios/_common.mjs`). Do not deep-link.
- **State flags to exercise:** `utilityData.utilityType` (`RUBS` | `flat_fee`), `tenantData.inspectionStatus` (`signed` | `missing`), `processingStatus` (`not_started` | `in_progress` | `complete`).

## Steps

1. **Ensure the browser driver is available** (kept out of `package.json`):
   ```bash
   [ -d node_modules/playwright-core ] || npm i --no-save playwright-core
   ```
   The scripts auto-detect a system Chrome or Edge; no browser download needed.

2. **Write a scenario** for the surface you changed. Copy `scenarios/example.mjs` to a working file (e.g. the scratchpad) and edit two things:
   - `session` — build it with `buildSession`/`buildReturn` from `_common.mjs`; override only the fields that put the UI in the state you need.
   - `shots` — one entry per screenshot: `{ name, caption, action? }`. `action(page)` is Playwright and runs from `/`; use the `resume`/`openReturn`/`gotoStep`/`openReview` helpers to click to the screen. Cover the happy path **and** at least one probe (a variant, empty state, or warning).

3. **Run the driver** — it starts `next dev`, seeds the session, runs your shots, captures console/page errors, and tears the server down:
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <scenario.mjs> .pr-shots
   ```
   Output: PNGs + `manifest.json` in `.pr-shots/`, plus an error count. **Look at the screenshots** (read each PNG) — that's the verification; the post is just delivery. If a shot shows the bug, fix it and re-run before posting.

4. **(optional) Intro file** — a short markdown blurb (verdict + what was exercised) prepended to the comment.

5. **Post to the PR:**
   ```bash
   node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs <prNumber> .pr-shots [intro.md]
   ```
   This commits the PNGs to an `assets/pr-<n>-shots` branch (not part of the code diff), then comments on the PR with each image embedded + a **view** link. Requires a clean working tree (`.pr-shots/` is gitignored) and restores your current branch afterward. Prints the comment URL.

6. **Report** the comment URL and the error count back to the user. If `manifest.errors` was non-empty, treat the PR as not-yet-verified and investigate.

## Gotchas

- **Run the scripts from the repo root** so `playwright-core` resolves from the repo-root `node_modules`.
- **Free port 3000 first** if a stale dev server from another session holds it, or the driver may screenshot the wrong app. The driver parses the actual `Local:` port from `next dev`, but falls back to 3000.
- **Re-posting accumulates, doesn't clobber.** `post-to-pr.mjs` writes each run under `verification/pr-<n>/<commit-sha>/`.

## Known limitation

Seeding the internal session bypasses the Excel parser (`lib/parser.ts`), so these screenshots verify **UI/rendering, not parsing**. Upload-based coverage is a deferred follow-up for when a real AppFolio workbook is available.
