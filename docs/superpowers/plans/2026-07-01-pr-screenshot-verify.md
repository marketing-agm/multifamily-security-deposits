# pr-screenshot-verify Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `pr-screenshot-verify` skill to the multifamily-security-deposits repo that drives the running Next.js app in a headless browser, screenshots the surface a PR touches, and posts those screenshots into the PR as a comment.

**Architecture:** Reuse the generic delivery script (`post-to-pr.mjs`) verbatim. Rebuild the capture script (`drive.mjs`) to launch `next dev` and seed the app's `localStorage` session instead of mocking a network API (there is none). A scenario file supplies a seeded `session` plus a list of `shots`; a `_common.mjs` helper builds valid `TenantReturn` fixtures and drives the real UI via clicks.

**Tech Stack:** Node (ESM `.mjs`, built-in test runner), `playwright-core` (installed on demand, not in `package.json`), Next.js 16 dev server, system Chrome/Edge.

## Global Constraints

- Node built-in test runner only; **zero** added runtime dependencies. `playwright-core` is installed on demand with `npm i --no-save playwright-core` (never added to `package.json`).
- On Windows/Node 24, `node --test <dir>` is broken — always pass the shell-expanded glob: `node --test <path>/*.test.mjs`.
- **No app-code changes.** Everything is additive under `.claude/skills/` and `docs/`. Do not edit `app/`, `components/`, `context/`, or `lib/`.
- The app's single state store is `localStorage['agm_deposit_session']` holding a `SessionState` = `{ propertyName, uploadDate, returns: TenantReturn[] }` (see `types/index.ts`).
- Data pages redirect to `/` when the session is null **during first render**, so the driver must start at `/` and navigate via in-app clicks, never deep-link.
- Repo is **public**; GitHub renders inline PR-comment images.
- Dev server: `npm run dev` = `next dev`, prints `- Local: http://localhost:PORT` (default 3000).
- Branch: `add-pr-screenshot-verify` (already created off fresh `main`). Commit messages are descriptive; end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

---

### Task 1: Scaffold skill + reuse the delivery script

**Files:**
- Create: `.claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs` (copied from `report-studio`)
- Modify: `.gitignore` (append `.pr-shots/`)

**Interfaces:**
- Produces: `post-to-pr.mjs`, invoked as `node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs <prNumber> <shotsDir> [introFile]`. Reads `<shotsDir>/manifest.json`, pushes PNGs to branch `assets/pr-<n>-shots`, posts a PR comment, prints `COMMENT_URL=...`.

- [ ] **Step 1: Copy the generic delivery script verbatim**

```bash
mkdir -p .claude/skills/pr-screenshot-verify/scripts
cp "../report-studio/.claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs" \
   .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs
```

(If the relative path differs on your machine, copy from the report-studio repo's `.claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs`.)

- [ ] **Step 2: Fix the one app-specific caption line for accuracy**

The copied script hardcodes a line claiming `/api/*` was mocked, which is false for this app. In `.claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs`, replace:

```js
md += `Captured by driving the running app in a headless browser with \`/api/*\` mocked. `;
```

with:

```js
md += `Captured by driving the running app in a headless browser with a seeded session. `;
```

- [ ] **Step 3: Gitignore the shots output directory**

Append to `.gitignore`:

```
# pr-screenshot-verify output (kept out of the code diff)
.pr-shots/
```

`.pr-shots/` MUST be ignored so `post-to-pr.mjs`'s clean-tree check passes while shots exist on disk.

- [ ] **Step 4: Verify the script loads and shows usage**

Run: `node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs`
Expected: prints `usage: post-to-pr.mjs <prNumber> <shotsDir> [introFile]` and exits non-zero (no crash, no stack trace).

- [ ] **Step 5: Verify .gitignore works**

Run: `mkdir -p .pr-shots && touch .pr-shots/x.png && git status --porcelain .pr-shots`
Expected: **no output** (the directory is ignored). Then `rm -rf .pr-shots`.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs .gitignore
git commit -m "Add pr-screenshot-verify delivery script + gitignore shots"
```

---

### Task 2: Fixture helpers with a shape test (TDD)

**Files:**
- Create: `.claude/skills/pr-screenshot-verify/scenarios/_common.mjs`
- Test: `.claude/skills/pr-screenshot-verify/test/common.test.mjs`

**Interfaces:**
- Produces:
  - `buildReturn(overrides = {}) -> TenantReturn` — complete valid object; deep-merges the known sub-objects (`tenantData` incl. `forwardingAddress`, `depositData`, `utilityData`, `ledgerData`, `manualCharges`, `calculatedCharges`) so callers override only what differs.
  - `buildSession({ propertyName?, uploadDate?, returns? } = {}) -> SessionState`.
  - `resume(page)`, `openReturn(page, tenantName)`, `gotoStep(page, label)`, `openReview(page)` — Playwright click helpers (added in this task, exercised in Task 4).

- [ ] **Step 1: Write the failing test**

Create `.claude/skills/pr-screenshot-verify/test/common.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReturn, buildSession } from "../scenarios/_common.mjs";

const TENANT_RETURN_KEYS = [
  "id", "tenantData", "depositData", "utilityData", "ledgerData",
  "manualCharges", "calculatedCharges", "rubsManualInput",
  "processingStatus", "complianceChecked", "pdfGenerated",
];

test("buildReturn returns a complete TenantReturn with all keys", () => {
  const r = buildReturn();
  for (const k of TENANT_RETURN_KEYS) assert.ok(k in r, `missing key: ${k}`);
  assert.equal(r.id, "101-0");
  assert.equal(r.utilityData.utilityType, "RUBS");
  assert.equal(typeof r.tenantData.forwardingAddress.zip, "string");
});

test("buildReturn deep-merges overrides without dropping sibling fields", () => {
  const r = buildReturn({
    id: "102-0",
    tenantData: { tenantName: "Marcus Lee", inspectionStatus: "missing" },
    utilityData: { utilityType: "flat_fee", flatFeeRate: 45 },
  });
  assert.equal(r.id, "102-0");
  assert.equal(r.tenantData.tenantName, "Marcus Lee");
  assert.equal(r.tenantData.inspectionStatus, "missing");
  // sibling fields survive the merge:
  assert.equal(typeof r.tenantData.unit, "string");
  assert.equal(r.utilityData.utilityType, "flat_fee");
  assert.equal(r.utilityData.flatFeeRate, 45);
  assert.equal(typeof r.utilityData.rubsBuildingTotal, "number");
});

test("buildSession wraps returns into a SessionState", () => {
  const s = buildSession({ returns: [buildReturn(), buildReturn({ id: "102-0" })] });
  assert.ok(typeof s.propertyName === "string");
  assert.ok(typeof s.uploadDate === "string");
  assert.equal(s.returns.length, 2);
  assert.equal(s.returns[1].id, "102-0");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test .claude/skills/pr-screenshot-verify/test/*.test.mjs`
Expected: FAIL — cannot find module `../scenarios/_common.mjs`.

- [ ] **Step 3: Write `_common.mjs`**

Create `.claude/skills/pr-screenshot-verify/scenarios/_common.mjs`:

```js
// _common.mjs — fixture builders + UI-navigation helpers for pr-screenshot-verify.
//
// buildReturn/buildSession produce a valid in-memory session matching types/index.ts,
// which the driver seeds into localStorage['agm_deposit_session']. This is also the
// single place to update if the app's internal TenantReturn shape changes.

// A complete, valid TenantReturn with sensible defaults.
export function buildReturn(overrides = {}) {
  const base = {
    id: "101-0",
    tenantData: {
      tenantName: "Jane Tenant", coTenant: "", unit: "101", monthlyRent: 1800,
      moveInDate: "2023-06-01", moveOutDate: "2026-06-15", paidThroughDate: "2026-06-15",
      noticeDate: "2026-05-10", leaseEndDate: "2026-06-30", leaseBreak: false,
      newTenantMoveInDate: null,
      forwardingAddress: { street: "742 Evergreen Terrace", city: "Springfield", state: "OR", zip: "97477" },
      inspectionStatus: "signed",
    },
    depositData: { securityDeposit: 1800, petDeposit: 300, keyDeposit: 0, garageOpenerDeposit: 0, nrcCleaningFee: 150, nrcPetFee: 0 },
    utilityData: { utilityType: "RUBS", flatFeeRate: 0, flatFeeBillingMethod: "included_in_rent", rubsBuildingTotal: 2400, rubsUnitRatio: 0.08 },
    ledgerData: { outstandingBalances: 0, lateFees: 0, credits: 0, partialPayments: 0, priorCharges: 0 },
    manualCharges: { generalCleaning: 0, blindDrapeCleaning: 0, windowCoveringReplacement: 0, carpetShampooing: 0, flooringRestoration: 0, painting: 0, other1Label: "Other", other1: 0, other2Label: "Other", other2: 0, legalCourtCosts: 0 },
    calculatedCharges: { rentDue: 0, rentDueDateRange: "", utilityCharge: 0 },
    rubsManualInput: { buildingTotal: 2400, unitRatio: 0.08 },
    processingStatus: "in_progress",
    complianceChecked: false,
    pdfGenerated: false,
  };
  const o = overrides;
  return {
    ...base, ...o,
    tenantData: {
      ...base.tenantData, ...(o.tenantData || {}),
      forwardingAddress: { ...base.tenantData.forwardingAddress, ...((o.tenantData || {}).forwardingAddress || {}) },
    },
    depositData: { ...base.depositData, ...(o.depositData || {}) },
    utilityData: { ...base.utilityData, ...(o.utilityData || {}) },
    ledgerData: { ...base.ledgerData, ...(o.ledgerData || {}) },
    manualCharges: { ...base.manualCharges, ...(o.manualCharges || {}) },
    calculatedCharges: { ...base.calculatedCharges, ...(o.calculatedCharges || {}) },
  };
}

export function buildSession({ propertyName = "Maple Grove Apartments", uploadDate = "7/1/2026", returns } = {}) {
  return { propertyName, uploadDate, returns: returns || [buildReturn()] };
}

// --- UI navigation helpers (Playwright) ---------------------------------------
// The driver starts each shot at "/", so these click through the real app.

// From "/", click the resume affordance -> land on the dashboard.
export async function resume(page) {
  await page.getByRole("button", { name: /Resume session/ }).click();
  await page.getByRole("button", { name: "Start new upload" }).waitFor();
}

// From the dashboard, open a tenant's return form by clicking their row.
export async function openReturn(page, tenantName) {
  await page.getByText(tenantName).first().click();
  await page.getByRole("button", { name: "Tenant" }).waitFor(); // step bar present
}

// In the return form, jump to a step tab by its label (e.g. "Utility", "Submit").
export async function gotoStep(page, label) {
  await page.getByRole("button", { name: label, exact: false }).first().click();
}

// From the return form, go to the review screen (via the Submit step's button).
export async function openReview(page) {
  await gotoStep(page, "Submit");
  await page.getByRole("button", { name: /Go to Review/ }).click();
  await page.waitForURL(/\/review\//);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test .claude/skills/pr-screenshot-verify/test/*.test.mjs`
Expected: PASS — 3 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/pr-screenshot-verify/scenarios/_common.mjs .claude/skills/pr-screenshot-verify/test/common.test.mjs
git commit -m "Add fixture builders + UI helpers for pr-screenshot-verify"
```

---

### Task 3: Example scenario (template)

**Files:**
- Create: `.claude/skills/pr-screenshot-verify/scenarios/example.mjs`

**Interfaces:**
- Consumes: `buildSession`, `buildReturn`, `resume`, `openReturn`, `gotoStep`, `openReview` from `_common.mjs`.
- Produces: a default export `{ viewport, session, shots }` consumed by `drive.mjs` (Task 4). Each shot: `{ name, caption, path?, action? }`.

- [ ] **Step 1: Write the example scenario**

Create `.claude/skills/pr-screenshot-verify/scenarios/example.mjs`:

```js
// example.mjs — template scenario. Copy this to the scratchpad, edit `session`
// and `shots` for the surface your PR touches, then run drive.mjs against it.
//
// The driver seeds `session` into localStorage before each shot and starts every
// shot at "/". Each shot's `action(page)` drives the real UI via clicks.
import { buildSession, buildReturn, resume, openReturn, gotoStep, openReview } from "./_common.mjs";

export default {
  viewport: { width: 1280, height: 900 },
  // Three returns so a single dashboard shot shows both utility tags, both
  // inspection states, and mixed processing statuses.
  session: buildSession({
    propertyName: "Maple Grove Apartments",
    returns: [
      buildReturn({ id: "101-0", tenantData: { tenantName: "Jane Tenant", unit: "101", inspectionStatus: "signed" }, utilityData: { utilityType: "RUBS" }, processingStatus: "in_progress" }),
      buildReturn({ id: "102-0", tenantData: { tenantName: "Marcus Lee", unit: "102", inspectionStatus: "missing" }, utilityData: { utilityType: "flat_fee", flatFeeRate: 45 }, rubsManualInput: null, processingStatus: "not_started" }),
      buildReturn({ id: "103-0", tenantData: { tenantName: "Nia Okafor", unit: "103", inspectionStatus: "signed" }, utilityData: { utilityType: "RUBS" }, processingStatus: "complete" }),
    ],
  }),
  shots: [
    { name: "01-upload", caption: "Upload screen (resume affordance shown)" },
    { name: "02-dashboard", caption: "Dashboard: 3 returns, RUBS + Flat Fee tags, mixed statuses", action: resume },
    { name: "03-form-utility", caption: "Return form, Utility step (RUBS inputs)",
      action: async (page) => { await resume(page); await openReturn(page, "Jane Tenant"); await gotoStep(page, "Utility"); } },
    { name: "04-review-missing-inspection", caption: "Review screen, inspection-missing warning",
      action: async (page) => { await resume(page); await openReturn(page, "Marcus Lee"); await openReview(page); } },
  ],
};
```

- [ ] **Step 2: Verify it imports and has the expected shape**

Run:
```bash
node -e "import('./.claude/skills/pr-screenshot-verify/scenarios/example.mjs').then(m => { const s = m.default; console.log('shots:', s.shots.length, '| returns:', s.session.returns.length, '| ok:', s.shots.every(x => x.name)); })"
```
Expected: `shots: 4 | returns: 3 | ok: true`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/pr-screenshot-verify/scenarios/example.mjs
git commit -m "Add example scenario template for pr-screenshot-verify"
```

---

### Task 4: Driver script + local capture verification

**Files:**
- Create: `.claude/skills/pr-screenshot-verify/scripts/drive.mjs`

**Interfaces:**
- Consumes: a scenario module (`example.mjs`) default export `{ viewport?, session?, shots[] }`.
- Produces: `drive.mjs`, invoked as `node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <scenario.mjs> [outDir]`. Writes PNGs + `manifest.json` (`{ base, shots:[{name,caption}], errors:[] }`) to `outDir` (default `.pr-shots`).

- [ ] **Step 1: Write `drive.mjs`**

Create `.claude/skills/pr-screenshot-verify/scripts/drive.mjs`:

```js
// drive.mjs — launch the Next.js dev server, seed the app's localStorage session,
// drive the real UI to each shot, and capture screenshots.
//
// Usage:
//   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <scenario.mjs> [outDir]
//
// Scenario default export:
//   { viewport?: {width,height},            // default 1280x900
//     session?:  SessionState,              // seeded into localStorage['agm_deposit_session']
//     shots: [ { name, caption?, path?, action? } ] }
//
// Notes:
//   - Data pages redirect to "/" when the session is null on first render, so every
//     shot starts at "/" (never redirects) and its action() navigates via clicks.
//   - playwright-core is resolved from the repo-root node_modules (single-package repo);
//     install it once with:  npm i --no-save playwright-core
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const require = createRequire(path.join(repoRoot, "package.json"));
const { chromium } = require("playwright-core");

const scenarioArg = process.argv[2];
const outDir = path.resolve(process.argv[3] || path.join(repoRoot, ".pr-shots"));
if (!scenarioArg) { console.error("usage: drive.mjs <scenario.mjs> [outDir]"); process.exit(2); }

const chrome = CHROME_CANDIDATES.find(existsSync);
if (!chrome) { console.error("No Chrome/Edge binary found. Edit CHROME_CANDIDATES in drive.mjs."); process.exit(2); }

const get = (url) => new Promise((res) => {
  const req = http.get(url, (r) => { r.resume(); res(r.statusCode || 0); });
  req.on("error", () => res(0));
  req.setTimeout(1500, () => { req.destroy(); res(0); });
});
async function waitForUrl(url, tries = 60) {
  for (let i = 0; i < tries; i++) { if (await get(url) === 200) return true; await new Promise((r) => setTimeout(r, 500)); }
  return false;
}

async function main() {
  const scenario = (await import(pathToFileURL(path.resolve(scenarioArg)).href)).default;
  mkdirSync(outDir, { recursive: true });

  // 1) Start `next dev`; it prints "- Local: http://localhost:PORT".
  const dev = spawn("npm", ["run", "dev"], { cwd: repoRoot, shell: true });
  let base = "";
  dev.stdout.on("data", (b) => {
    const m = String(b).match(/Local:\s+(http:\/\/localhost:\d+)/);
    if (m) base = m[1];
  });
  dev.stderr.on("data", () => {});
  for (let i = 0; i < 60 && !base; i++) await new Promise((r) => setTimeout(r, 250));
  if (!base) base = "http://localhost:3000";
  console.log("dev server URL:", base);

  const ok = await waitForUrl(base + "/");
  if (!ok) { console.error("dev server never became ready at " + base); dev.kill(); process.exit(1); }
  console.log("dev server ready");

  // 2) Launch the browser; seed the session before any page script runs.
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const ctx = await browser.newContext({ viewport: scenario.viewport || { width: 1280, height: 900 } });
  if (scenario.session) {
    await ctx.addInitScript(
      (json) => localStorage.setItem("agm_deposit_session", json),
      JSON.stringify(scenario.session),
    );
  }

  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

  // 3) Each shot: start at "/" (or the shot's path), run its action, screenshot.
  const manifest = { base, shots: [], errors };
  for (const s of scenario.shots || []) {
    try {
      await page.goto(base + (s.path || "/"), { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(400);
      if (s.action) await s.action(page);
      await page.waitForTimeout(400);
      const file = s.name.endsWith(".png") ? s.name : s.name + ".png";
      await page.screenshot({ path: path.join(outDir, file), fullPage: true });
      manifest.shots.push({ name: file, caption: s.caption || "" });
      console.log("shot:", file);
    } catch (e) {
      console.error("shot FAILED:", s.name, "-", e.message);
      manifest.errors.push("SHOT " + s.name + ": " + e.message);
    }
  }

  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await browser.close();
  dev.kill();
  console.log("\nconsole/page errors:", errors.length);
  for (const e of errors) console.log("  -", e);
  console.log("manifest:", path.join(outDir, "manifest.json"));
  setTimeout(() => process.exit(0), 300);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
```

- [ ] **Step 2: Install the browser driver (on demand, not saved)**

Run: `[ -d node_modules/playwright-core ] || npm i --no-save playwright-core`
Expected: `playwright-core` present in `node_modules` (it will NOT appear in `package.json`).

- [ ] **Step 3: Free port 3000 if a stale dev server holds it**

Run: `netstat -ano | grep 3000` — if a `LISTENING` line exists, confirm it is a stale `node` and stop it (`Stop-Process -Id <pid> -Force` in PowerShell). A stale server would make the driver screenshot the wrong app.

- [ ] **Step 4: Run the driver against the example scenario**

Run: `node .claude/skills/pr-screenshot-verify/scripts/drive.mjs .claude/skills/pr-screenshot-verify/scenarios/example.mjs .pr-shots`
Expected: prints `dev server ready`, then `shot: 01-upload.png` ... `shot: 04-review-missing-inspection.png`, then `console/page errors: 0`. Four PNGs + `manifest.json` in `.pr-shots/`.

- [ ] **Step 5: Look at every screenshot (this is the real verification)**

Read each PNG in `.pr-shots/` and confirm:
- `01-upload` — the upload page with the "Resume session" button.
- `02-dashboard` — a table with Jane/Marcus/Nia, a RUBS tag and a Flat Fee tag, a "missing" inspection badge, and mixed status badges.
- `03-form-utility` — the return form on the Utility step showing RUBS inputs.
- `04-review-missing-inspection` — the review screen with the inspection-missing warning banner.

If a shot is wrong or a selector missed (e.g. the row click or a step label), fix the selector in `_common.mjs` (or the scenario), re-run Step 4, and re-check. Do not proceed until all four are correct with 0 console errors.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/pr-screenshot-verify/scripts/drive.mjs
git commit -m "Add drive.mjs: next dev launch + localStorage session seeding"
```

(If Step 5 required selector fixes, `git add` the changed `_common.mjs`/`example.mjs` in the same commit.)

---

### Task 5: SKILL.md

**Files:**
- Create: `.claude/skills/pr-screenshot-verify/SKILL.md`

**Interfaces:**
- Produces: the skill entry point Claude loads. Must have YAML front matter with `name` and `description`.

- [ ] **Step 1: Write SKILL.md**

Create `.claude/skills/pr-screenshot-verify/SKILL.md`:

````markdown
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
````

- [ ] **Step 2: Verify front matter parses**

Run: `node -e "const t=require('fs').readFileSync('.claude/skills/pr-screenshot-verify/SKILL.md','utf8'); const m=t.match(/^---([\s\S]*?)---/); console.log('has name:', /name:\s*pr-screenshot-verify/.test(m[1]), '| has description:', /description:/.test(m[1]));"`
Expected: `has name: true | has description: true`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/pr-screenshot-verify/SKILL.md
git commit -m "Add SKILL.md for pr-screenshot-verify (Next.js app notes)"
```

---

### Task 6: Open the PR and verify delivery end to end

**Files:** none (uses the committed skill + a real PR).

**Interfaces:**
- Consumes: `drive.mjs` output in `.pr-shots/` (from Task 4) and `post-to-pr.mjs`.
- Produces: a PR targeting `main` and a screenshot comment on it (proves the delivery half works).

- [ ] **Step 1: Push the branch**

```bash
git push -u origin add-pr-screenshot-verify
```

- [ ] **Step 2: Open the PR targeting main**

```bash
gh pr create --base main --head add-pr-screenshot-verify \
  --title "Add pr-screenshot-verify skill (Next.js rebuild)" \
  --body "Adapts pr-screenshot-verify to this repo's Next.js stack: seeds the app's localStorage session instead of mocking an API, reuses post-to-pr.mjs, rebuilds drive.mjs for next dev. See docs/superpowers/specs/2026-07-01-pr-screenshot-verify-design.md. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Record the PR number it prints.

- [ ] **Step 3: Confirm the base branch is main**

Run: `gh pr view <prNumber> --json baseRefName --jq .baseRefName`
Expected: `main`. If not, `gh pr edit <prNumber> --base main`.

- [ ] **Step 4: Ensure shots exist and the tree is clean**

If `.pr-shots/` is empty (e.g. new session), re-run Task 4 Step 4. Then run `git status --porcelain` — expected: **empty** (`.pr-shots/` is ignored, all code committed).

- [ ] **Step 5: Post the screenshots to the PR**

Run: `node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs <prNumber> .pr-shots`
Expected: prints `COMMENT_URL=https://github.com/marketing-agm/multifamily-security-deposits/pull/<n>#issuecomment-...` and `ASSETS_BRANCH=assets/pr-<n>-shots`.

- [ ] **Step 6: Verify the comment renders**

Open the `COMMENT_URL` (or `gh pr view <prNumber> --web`) and confirm the four images render inline (repo is public) with their captions. Report the URL and the 0-error result to the user.

---

## Self-Review

- **Spec coverage:** post-to-pr reuse (Task 1) ✓; drive.mjs rebuild — dev-server launch + localStorage seeding (Task 4) ✓; `_common.mjs` fixture helpers (Task 2) ✓; example scenario with happy path + RUBS/flat-fee/inspection-missing variants (Task 3) ✓; SKILL.md with app notes (Task 5) ✓; capture + delivery verification (Tasks 4, 6) ✓; gitignore `.pr-shots/` (Task 1) ✓; known-limitation documented (Task 5) ✓; branch→PR→main flow (Task 6) ✓.
- **Placeholder scan:** no TBD/TODO; every code and command step is complete.
- **Type consistency:** `buildReturn`/`buildSession` signatures and the helper names (`resume`, `openReturn`, `gotoStep`, `openReview`) are defined in Task 2 and consumed identically in Tasks 3–4. The scenario shape `{ viewport, session, shots:[{name,caption,path?,action?}] }` matches what `drive.mjs` reads.
