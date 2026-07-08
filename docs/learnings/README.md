# Learnings index

Cross-session record of fixes and gotchas. **Before fixing in an area, grep its file for prior lessons; after fixing, add an entry** via the `learnings-log` skill (`scripts/log.mjs`). Full entries live in the per-area files; one line per entry below, newest first.

## ui
- [2026-07-08] ux — Fixed multi-column grids (dashboard table) and a fixed-width sidebar (return form) scrunch on narrow windows. Fix by branching layout at the md breakpoint. (ffd0c4b)
- [2026-07-08] gotcha — A single file input that accepts both images and PDFs must branch on file.type: images go through canvas compression, but PDFs (and other non-images) must be read with FileReader.readAsDataURL and stored as-is. (b1c34e4)
- [2026-07-08] ux — Reusable pattern for viewable thumbnails: click thumbnail opens a fixed full-size overlay; close on backdrop click and Escape keydown; a delete button nested inside the clickable thumbnail must not also trigger the open. (457db0c)
- [2026-07-08] ux — A literal space between </span> and following text can be trimmed by JSX whitespace handling, rendering words joined ('Photossection'). (02ba4e7)
- [2026-07-07] ux — The review/download screen only had 'Back to Dashboard' plus an easy-to-miss header link; add clear bottom back-buttons to both the form and the dashboard. (e010cfb)
- [2026-07-07] gotcha — Dashboard Move-Out and Due Date used different formats; unifying them requires parsing ISO dates safely so the displayed day doesn't shift. (3ed40fa)
- [2026-07-07] gotcha — A controlled <input type=number value={n} onChange={parseFloat||0}> forces a sticky 0 and can't display formatted 0.00 / thousands. (amount-input)
- [2026-07-07] bug — Gate the locked UI behind a checking flag so the pre-check state doesn't flash before the async session check resolves. (gate-flash)
- [2026-07-07] gotcha — New screens tend to drift from the token system (raw Tailwind sizes/colors, ad-hoc disabled states). A fast grep audit catches it. (f3bbafe)
- [2026-07-07] gotcha — Alternative to a redirect login: keep the target screen visible but locked, overlay a password card, and 'light up' the content once verified. (b692d86)
- [2026-07-07] gotcha — Pattern for a branded login/splash: accent-gradient brand panel beside the sign-in card, collapsing to one column on mobile, theme-aware via tokens. (e45dbc5)
- [2026-07-06] bug — Two near-simultaneous async uploads both computed next from the same stale `photos` closure, so the second write overwrote the first. (photos-race)
- [2026-07-06] gotcha — Calling updateReturn (SessionProvider setState) inside setPhotos(prev => ...) triggers a cross-component state update during render. (b1hp4c8bt)
- [2026-07-06] gotcha — Using the same vivid semantic color for both fills and text (e.g. text-danger on a light tint) fails WCAG AA contrast for small text. (98eb57f)
- [2026-07-06] bug — A pre-paint inline script adds the .dark class to <html>, but React stripped it on hydration because the JSX className didn't include it. (3ea2e35)
- [2026-07-06] gotcha — Semantic design tokens in globals.css remove per-element dark:bg-[#hex] duplication and centralize the palette. (2333f85)

## lib
- [2026-07-07] bug — Field-type detection via f.constructor.name === 'PDFTextField' returned 0 in prod because minification renames classes; dev worked. (minified-constructor-name)
- [2026-07-07] bug — Deriving the property from ledgerRows[0] returned empty because AppFolio exports put a blank filter row directly under the header, so the app fell back to the file name. (blank-filter-row)
- [2026-07-07] bug — The parser read the property from the first ledger row and applied its name + config to every tenant, so multi-property exports got wrong managers/NRC/utility. (multi-property)
- [2026-07-06] bug — The AGM template pre-prints a $ in each currency cell, so writing formatCurrency() (which adds $) produced $$0.00. (98eb57f-pdf)
- [2026-07-06] bug — Dashboard showed 0 tenants after uploading a real AppFolio Excel export because the parser misread the file structure. (2618a8f)

## infra
- [2026-07-08] gotcha — A static icon.svg placed in app/ becomes a Next metadata route (/icon.svg); next-on-pages requires every route to export edge runtime, which a .svg can't, so the Cloudflare Pages build fails. (0284487)
- [2026-07-08] gotcha — Naming a next/font CSS variable the same as a Tailwind v4 @theme font token creates a circular var() reference that silently breaks the font. (d2c29a2)
- [2026-07-06] gotcha — How to gate the whole app behind a shared password verified server-side, without leaking the secret to the browser. (affedc5)
- [2026-07-06] gotcha — next dev (Turbopack) kept serving pre-edit globals.css, so new design tokens / dark-mode vars were missing at runtime despite a passing build. (02d9381)
- [2026-07-06] gotcha — The pr-screenshot-verify CHROME_CANDIDATES list was missing the Linux Chromium path used in remote Claude Code containers. (53a077a)
- [2026-07-06] gotcha — app/page.tsx was overwritten by the sim demo PR to redirect to /sim. The real upload page and all downstream screens were unreachable from the root URL. (7a4a4e6)

## misc
_(none yet)_
