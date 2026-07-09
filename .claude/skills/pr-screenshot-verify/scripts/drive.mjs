// drive.mjs — launch the Next.js dev server, seed the app's sessionStorage session,
// drive the real UI to each shot, and capture screenshots.
//
// Usage:
//   node .claude/skills/pr-screenshot-verify/scripts/drive.mjs <scenario.mjs> [outDir]
//
// Scenario default export:
//   { viewport?: {width,height},            // default 1280x900
//     session?:  SessionState,              // seeded into sessionStorage['agm_deposit_session']
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
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
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
      (json) => sessionStorage.setItem("agm_deposit_session", json),
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
