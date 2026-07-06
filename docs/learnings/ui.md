# UI — App Router pages, React components, session/context — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

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

