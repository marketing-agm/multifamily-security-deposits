# Design: pr-screenshot-verify skill for multifamily-security-deposits

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan

## Goal

Give this repo the same capability the Report Studio and AGM Corporate Library
repos have: after a front-end change is committed, pushed, and opened as a PR,
drive the real UI in a headless browser, screenshot the surface the change
touched, and post those screenshots back into the PR as a comment. This is the
repeatable, PR-level version of "did my UI change actually look right."

The skill is an adaptation of the existing `pr-screenshot-verify` skill, rebuilt
for this repo's stack.

## Context: why this is a rebuild, not a copy

The existing skill (both the dev-resources / Corp Library copy and the Report
Studio copy) is built for a **Vite + React app whose data comes from a network
`/api/*` surface**, which the driver mocks by intercepting requests.

This repo is different:

- **Next.js 16 + React 19 + TypeScript**, deployed to Cloudflare Pages. Dev
  server is `next dev` (default port 3000), not Vite (port 5173).
- **No `app/api/` and no route handlers.** There is nothing to mock at the
  network layer. All UI state comes from a single client-side store.

So two parts of the driver must be rewritten (dev-server launch and data
seeding), while the rest of the skill ports over cleanly.

## Key facts about the target app (load-bearing)

- **Single source of state:** `context/SessionContext.tsx` reads and writes one
  `localStorage` key, `agm_deposit_session`, holding a `SessionState`:
  `{ propertyName, uploadDate, returns: TenantReturn[] }`. There is no server
  state and no URL-param state.
- **Routes and data resolution:**
  - `/` (`app/page.tsx`) renders the file-upload UI; needs no session. Shows a
    "resume session" affordance if a session exists.
  - `/dashboard` renders a table of `session.returns`; **redirects to `/` if the
    session is missing.**
  - `/return/[id]` renders the 6-step return form for the return whose `id`
    matches; a missing id silently renders nothing.
  - `/review/[id]` renders the final review + PDF screen; **redirects to `/` if
    the id is not found.**
- **`id` format:** `"${unit}-${index}"`, e.g. `101-0` (from `lib/parser.ts`).
- **Internal data shape (`TenantReturn`, `types/index.ts`):** the parsed object
  every screen reads from. Fields include `tenantData`, `depositData`,
  `utilityData` (`utilityType` is `RUBS` or `flat_fee`), `ledgerData`,
  `manualCharges`, `calculatedCharges`, `processingStatus`
  (`not_started | in_progress | complete`), `complianceChecked`, `pdfGenerated`,
  and `tenantData.inspectionStatus` (`signed | missing`).
- **Form steps (`components/ReturnForm`):** `Tenant, Lease, Utility, Charges,
  Review, Submit`.
- **Dev server:** `npm run dev` = `next dev`, port 3000, no env vars required.

## Chosen approach: seed the internal session

Instead of mocking a network layer (there is none) or driving a real Excel
upload (the real workbook layout is not yet known), the driver **seeds the
`agm_deposit_session` localStorage key with a prebuilt `SessionState` before the
page loads**, then navigates to any route in any state.

Why this is the right seam:

- It seeds at the app's **internal, code-defined** data shape (`TenantReturn`),
  which is stable and version-controlled, not the **external, still-unknown**
  Excel layout.
- It is deterministic, fast, reaches every screen and state, and uses zero real
  tenant data.
- The fixture we build doubles as a written specimen of the expected parser
  output, useful while the input format is still being pinned down.

**Rejected alternatives:**

- *`/api` mocking* (the current skill's mechanism): not applicable, there is no
  API.
- *Real Excel upload:* deferred. It would require inventing a sample `.xlsx`
  against an unknown layout that would be thrown away once a real export exists.
  Add this as a follow-up when a confirmed workbook is available.

## Architecture: reuse vs rebuild

Skill lives at `.claude/skills/pr-screenshot-verify/` (directory-based, alongside
the repo's existing flat single-file skills):

```
.claude/skills/pr-screenshot-verify/
  SKILL.md                 rewritten with this app's notes
  scripts/
    drive.mjs              rebuilt dev-server launch + localStorage seeding;
                           reused browser/shot/error/teardown guts
    post-to-pr.mjs         copied verbatim (fully generic)
  scenarios/
    _common.mjs            NEW: buildReturn()/buildSession() fixture helpers +
                           small navigation helpers
    example.mjs            template scenario (happy path + variants)
```

### post-to-pr.mjs — reuse verbatim

The delivery script is app-agnostic: it derives owner/repo from the git remote,
pushes PNGs to an `assets/pr-<n>-shots` branch, and comments on the PR using the
stored git credential (no `gh` CLI). Copied unchanged. This repo is **public**,
so GitHub renders the inline images (the private-repo view-link fallback still
applies harmlessly).

### drive.mjs — rebuilt parts

- **Dev server launch:** spawn `npm run dev`, parse the `Local:
  http://localhost:PORT` line from Next's output, fall back to port 3000, then
  HTTP-poll the URL until it responds. Allow generous first-navigation timeouts
  because Next compiles routes on first request.
- **Data seeding:** use Playwright's `context.addInitScript` to set
  `localStorage['agm_deposit_session']` to `JSON.stringify(scenario.session)`
  before any page script runs, on every navigation.

### drive.mjs — reused parts

- System Chrome/Edge detection and headless launch via `playwright-core`
  (installed on demand with `npm i --no-save playwright-core`, kept out of
  `package.json`).
- The shot loop, PNG capture, `manifest.json` writing, console/page-error
  capture, and process teardown.

## Scenario + fixture conventions

A scenario exports the seeded `session` and the list of `shots`:

```js
export default {
  viewport: { width: 1280, height: 900 },
  session: buildSession({ returns: [ buildReturn({ id: "101-0" /* overrides */ }) ] }),
  shots: [
    { name: "dashboard", caption: "Dashboard with 3 returns", path: "/dashboard" },
    { name: "form-utility", caption: "Return form, Utility step", path: "/return/101-0",
      action: async (page) => { /* click through to the Utility step */ } },
  ],
}
```

- **Shot shape:** `{ name, caption, path, action? }`. The driver navigates to
  `path`, runs `action(page)` if present, then screenshots.
- **`_common.mjs`:** `buildReturn(overrides)` returns a complete valid
  `TenantReturn` with sensible defaults so scenarios specify only what differs;
  `buildSession({ propertyName?, returns })` wraps them into a `SessionState`.
  This is the single place to update if the internal shape changes.

### example.mjs coverage (happy path + variants)

- **Upload screen** (`/`): empty entry state, needs no data.
- **Dashboard** (`/dashboard`): one session seeded with three returns so a single
  shot shows both utility badges (RUBS vs Flat Fee) and the inspection-missing
  state, plus the progress header.
- **Return form** (`/return/101-0`): a shot on the Utility step (shows the RUBS
  inputs) reached via `action`.
- **Review** (`/review/<id>`): the review screen, including the inspection-missing
  warning banner variant.

## SKILL.md contents

Rewritten steps mirroring the existing skill (ensure playwright-core, write a
scenario, run drive.mjs, look at the PNGs, optional intro, post-to-pr, report
back), plus an "App notes" section documenting: the `agm_deposit_session` shape,
the routes and `id` format, the redirect-if-no-session gotcha, and the
`RUBS | flat_fee` / `signed | missing` state flags.

## Verification plan

No front-end PR is open right now, so:

1. **Capture half:** run `drive.mjs` against `example.mjs` and visually inspect
   each PNG to confirm the app renders the intended states, with zero console
   errors. This is the real verification.
2. **Delivery half:** run `post-to-pr.mjs` against this skill's own PR (the script
   only needs a PR number, not a visual diff) to confirm a real screenshot
   comment lands and images render.

## Non-goals / known limitations

- **Does not verify the Excel parser.** Seeding internal state bypasses
  `lib/parser.ts`. A parser bug will not appear in these screenshots. Upload-based
  coverage is a deferred follow-up for when a real workbook exists.
- **Does not add playwright-core to `package.json`.** It is installed on demand,
  matching the existing skill.
- No changes to app code; this is purely additive tooling under `.claude/` and a
  spec under `docs/`.

## Process

Normal branch to PR to `main` flow. Branch: `add-pr-screenshot-verify`, off fresh
`main`.
