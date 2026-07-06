# Infra — build / Cloudflare Pages / wrangler / tooling / git / devex — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

<!-- log-id: 7a4a4e6 :: PR #13 sim redirect hid the real Next.js app -->
### 2026-07-06 · infra · gotcha · PR #13 sim redirect hid the real Next.js app
- **Ref:** 7a4a4e6
- **Symptom:** Navigating to / showed the static HTML simulation instead of the Next.js upload page.
- **Root cause:** PR #13 shipped a page.tsx redirect to /sim as part of a Cloudflare preview demo and it was never reverted before merging to main.
- **Fix:** Restore app/page.tsx to the real UploadPage component (7a4a4e6). The /sim route and sim.html can stay for reference.
- **Lesson:** After merging a demo/preview branch, always verify app/page.tsx hasn't been replaced with a redirect. The real app entry point is easy to accidentally overwrite.

