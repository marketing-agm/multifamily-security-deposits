// post-to-pr.mjs — host screenshots on an assets branch and post them to a PR comment.
//
// Usage:
//   node .claude/skills/pr-screenshot-verify/scripts/post-to-pr.mjs <prNumber> <shotsDir> [introFile]
//
// Why an assets branch: GitHub's image proxy (camo) cannot fetch raw images from a PRIVATE
// repo, so inline ![](raw) embeds won't render if the files live only in a normal branch the
// viewer isn't on. Committing them to a dedicated branch and linking the in-repo blob URL lets
// authenticated collaborators view them; we embed AND link so it degrades gracefully.
//
// Auth: no gh CLI / token env required — the GitHub token is read from the machine's stored git
// credential (`git credential fill`), the same one `git push` uses.
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const prNumber = process.argv[2];
const shotsDir = path.resolve(process.argv[3] || ".pr-shots");
const introFile = process.argv[4];
if (!prNumber || !/^\d+$/.test(prNumber)) { console.error("usage: post-to-pr.mjs <prNumber> <shotsDir> [introFile]"); process.exit(2); }

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: "utf8", ...opts }).trim();
const repoRoot = sh("git rev-parse --show-toplevel");

// owner/repo from the origin remote.
const remote = sh("git remote get-url origin");
const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
if (!m) { console.error("Could not parse owner/repo from: " + remote); process.exit(1); }
const owner = m[1], repo = m[2];

// Read the manifest for captions + error summary (written by drive.mjs).
const manifestPath = path.join(shotsDir, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { shots: [], errors: [] };
const shots = manifest.shots.length
  ? manifest.shots
  : readdirSync(shotsDir).filter((f) => f.endsWith(".png")).map((name) => ({ name, caption: "" }));
if (!shots.length) { console.error("No screenshots found in " + shotsDir); process.exit(1); }

// Token from the stored git credential (never printed).
const token = sh("git credential fill", { input: "protocol=https\nhost=github.com\n\n" })
  .split("\n").find((l) => l.startsWith("password="))?.slice("password=".length);
if (!token) { console.error("No GitHub token from `git credential fill`."); process.exit(2); }

const startBranch = sh("git rev-parse --abbrev-ref HEAD");
if (sh("git status --porcelain")) { console.error("Working tree is dirty — commit/stash before posting."); process.exit(1); }

// Per-commit subdir + accumulate on the existing assets branch, so posting again
// (a later commit, a follow-up comment) never clobbers screenshots that earlier
// PR comments still embed.
const runTag = sh("git rev-parse --short HEAD");
const assetsBranch = `assets/pr-${prNumber}-shots`;
const destRel = `verification/pr-${prNumber}/${runTag}`;
const remoteHasAssets = (() => { try { return !!sh(`git ls-remote --heads origin ${assetsBranch}`); } catch { return false; } })();
try {
  if (remoteHasAssets) {
    sh(`git fetch origin ${assetsBranch} --quiet`);
    sh(`git checkout -B ${assetsBranch} origin/${assetsBranch}`);
  } else {
    sh("git fetch origin main --quiet");
    sh(`git checkout -B ${assetsBranch} origin/main`);
  }
  const destAbs = path.join(repoRoot, destRel);
  mkdirSync(destAbs, { recursive: true });
  for (const s of shots) copyFileSync(path.join(shotsDir, s.name), path.join(destAbs, s.name));
  sh(`git add ${destRel}`);
  sh(`git commit -q -m "chore: PR #${prNumber} verification screenshots (${runTag})"`);
  sh(`git push -u origin ${assetsBranch}`);
} finally {
  sh(`git checkout ${startBranch}`);
}

// Build the comment.
const blob = (name) => `https://github.com/${owner}/${repo}/blob/${assetsBranch}/${destRel}/${name}`;
const intro = introFile && existsSync(introFile) ? readFileSync(introFile, "utf8").trim() + "\n\n" : "";
let md = `## 🧪 Runtime verification — screenshots\n\n${intro}`;
md += `Captured by driving the running app in a headless browser with a seeded session. `;
md += manifest.errors?.length
  ? `⚠️ **${manifest.errors.length} console/page error(s):** ${manifest.errors.slice(0, 5).map((e) => "`" + e.slice(0, 120) + "`").join("; ")}\n\n`
  : `**0 console/page errors.**\n\n`;
md += `> Screenshots live on the \`${assetsBranch}\` branch (kept out of the code diff). If an image doesn't render inline (GitHub proxies private-repo images), use the **view** link.\n\n`;
for (const s of shots) {
  md += `**${s.name.replace(/\.png$/, "")}**${s.caption ? " — " + s.caption : ""} &nbsp; <sub>([view](${blob(s.name)}))</sub>\n`;
  md += `![${s.name}](${blob(s.name)}?raw=true)\n\n`;
}

const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
  method: "POST",
  headers: { Authorization: "token " + token, Accept: "application/vnd.github+json", "User-Agent": "pr-screenshot-verify", "Content-Type": "application/json" },
  body: JSON.stringify({ body: md }),
});
const data = await res.json();
if (!res.ok) { console.error("HTTP " + res.status); console.error(JSON.stringify(data, null, 2)); process.exit(1); }
console.log("COMMENT_URL=" + data.html_url);
console.log("ASSETS_BRANCH=" + assetsBranch);
