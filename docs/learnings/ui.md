# UI — App Router pages, React components, session/context — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

<!-- log-id: b692d86 :: Inline unlock gate: dim/blur content until a server session check passes -->
### 2026-07-07 · ui · gotcha · Inline unlock gate: dim/blur content until a server session check passes
- **Ref:** b692d86
- **Symptom:** Wanted the upload UI visible but unusable until a site password is entered — no separate /login redirect.
- **Root cause:** N/A — UX pattern for gating a client-rendered page while still verifying the password server-side.
- **Fix:** Render the content wrapped in `opacity-40 blur-[2px] pointer-events-none` while locked; absolutely-position a password card over it. On mount GET /api/session (reads httpOnly cookie server-side) to auto-unlock returning users / unconfigured gate. Unlock POSTs /api/login (sets cookie) then flips client state. Middleware keeps '/' public but protects deeper routes via the same cookie.
- **Lesson:** For a client-rendered app, a visible-but-locked overlay + /api/session check is a friendlier gate than a redirect — but still verify the password server-side and protect deep routes with the cookie, or the 'lock' is cosmetic.


<!-- log-id: e45dbc5 :: Responsive two-panel auth splash on design tokens -->
### 2026-07-07 · ui · gotcha · Responsive two-panel auth splash on design tokens
- **Ref:** e45dbc5
- **Symptom:** A bare centered password box felt unfinished for the first screen users see.
- **Root cause:** N/A — design improvement, captured as a reusable layout pattern.
- **Fix:** flex md:flex-row: left <aside> uses bg-gradient-to-br from-accent to-accent-hover + text-on-accent with blurred bg-white/10 glows for depth; right <main> centers the form. All colors from tokens so light/dark just work. Keep the login POST/cookie logic untouched.
- **Lesson:** For auth/splash pages, drive the brand panel with the accent token gradient (theme-agnostic colored panel + on-accent text) and let the form side use surface/app-text tokens; stack to single column below md. Reuse this shape for any future gated entry screen.


<!-- log-id: photos-race :: Simultaneous uploads clobber state when handler reads closure, not prev -->
### 2026-07-06 · ui · bug · Simultaneous uploads clobber state when handler reads closure, not prev
- **Ref:** photos-race
- **Symptom:** Uploading a move-in and a move-out photo back-to-back left only the last one; the other silently vanished.
- **Root cause:** addPhotos computed `{...photos, [k]:...}` from the closure captured at call time; both calls fired before a re-render, so both saw the initial empty value.
- **Fix:** Use functional setState (setPhotos(prev => ({...prev,[k]:[...prev[k],...]}))) so each update builds on the latest state; persist via an effect on the value.
- **Lesson:** Any state update derived from previous state — especially in async handlers that can overlap — must use the functional updater form, not a value read from the render closure.


<!-- log-id: b1hp4c8bt :: Don't call another component's setState inside a setState updater -->
### 2026-07-06 · ui · gotcha · Don't call another component's setState inside a setState updater
- **Ref:** b1hp4c8bt
- **Symptom:** React warning: 'Cannot update a component (SessionProvider) while rendering a different component (ReturnForm)' when uploading photos.
- **Root cause:** The updater function passed to a useState setter runs during React's render phase; calling another component's setter there is a setState-in-render.
- **Fix:** Compute the next value from current state in the event handler, then call setPhotos(next) and updateReturn(...) side by side — not inside the updater.
- **Lesson:** State-updater callbacks must be pure. Persist/side-effects (like updating a parent/provider store) belong in the handler body or an effect, never inside setX(prev => ...).


<!-- log-id: 98eb57f :: Vivid status colors fail WCAG as text — need separate -fg tokens -->
### 2026-07-06 · ui · gotcha · Vivid status colors fail WCAG as text — need separate -fg tokens
- **Ref:** 98eb57f
- **Symptom:** iOS-style vivid status colors (danger #ff3b30 ~3.4:1, warning #ff9500 worse) read fine as dots/progress fills but are too low-contrast as small label text on white/light-tint backgrounds.
- **Root cause:** One token was doing double duty (fill + text). Vivid tones are tuned for saturation, not text contrast.
- **Fix:** Add darker foreground tokens (success-fg/warning-fg/danger-fg) for TEXT (~5-6:1 on white), keep the vivid tokens for FILLS (dots, progress, tint backgrounds). Convention: bg-{sem}/10-12 tint + text-{sem}-fg label. In dark mode the vivid tones already pass, so -fg == vivid there.
- **Lesson:** When defining semantic status colors, split 'fill' from 'foreground/label' like iOS does. Never use a vivid brand/status color as small text on a light background without checking contrast (target 4.5:1).


<!-- log-id: 3ea2e35 :: Flash of light mode on dark reload — <html> missing suppressHydrationWarning -->
### 2026-07-06 · ui · bug · Flash of light mode on dark reload — <html> missing suppressHydrationWarning
- **Ref:** 3ea2e35
- **Symptom:** On a reload with theme=dark stored, the page briefly (or persistently in some renders) showed light mode; dev console logged an <html> className hydration mismatch (server 'h-full antialiased' vs client '...dark').
- **Root cause:** layout.tsx <html> lacked suppressHydrationWarning. React saw the imperatively-added .dark class as a server/client mismatch and reconciled it away.
- **Fix:** Add suppressHydrationWarning to the <html> element in app/layout.tsx.
- **Lesson:** Any element mutated by a pre-hydration inline script (theme class, lang, etc.) must carry suppressHydrationWarning, or React will strip the change on hydration. Verify with a seeded dark reload: body bg should be #1c1c1e with zero hydration console errors.


<!-- log-id: 2333f85 :: Dark mode via Tailwind v4 @theme inline + CSS-var flip (no dark: duplication) -->
### 2026-07-06 · ui · gotcha · Dark mode via Tailwind v4 @theme inline + CSS-var flip (no dark: duplication)
- **Ref:** 2333f85
- **Symptom:** Every component repeated hardcoded iOS hexes with a dark: variant, e.g. bg-white dark:bg-[#2c2c2e] border-[#e5e5ea] dark:border-[#38383a] — impossible to rebrand, easy to drift.
- **Root cause:** No design-token layer; colors were inlined as Tailwind arbitrary values in every file.
- **Fix:** Define light tokens in :root and dark overrides in .dark, then bridge with @theme inline (--color-surface: var(--surface)). Utilities like bg-surface/border-separator/text-secondary then auto-respond to the .dark class, so dark: variants disappear.
- **Lesson:** In Tailwind v4, pair CSS custom properties (flipped under .dark) with `@theme inline` to get theme-aware utility classes for free. Use semantic names (surface, separator, text-secondary, accent, danger), not raw hex, so screens say what a color is FOR.

