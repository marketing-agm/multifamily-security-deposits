# UI — App Router pages, React components, session/context — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

<!-- log-id: 2333f85 :: Dark mode via Tailwind v4 @theme inline + CSS-var flip (no dark: duplication) -->
### 2026-07-06 · ui · gotcha · Dark mode via Tailwind v4 @theme inline + CSS-var flip (no dark: duplication)
- **Ref:** 2333f85
- **Symptom:** Every component repeated hardcoded iOS hexes with a dark: variant, e.g. bg-white dark:bg-[#2c2c2e] border-[#e5e5ea] dark:border-[#38383a] — impossible to rebrand, easy to drift.
- **Root cause:** No design-token layer; colors were inlined as Tailwind arbitrary values in every file.
- **Fix:** Define light tokens in :root and dark overrides in .dark, then bridge with @theme inline (--color-surface: var(--surface)). Utilities like bg-surface/border-separator/text-secondary then auto-respond to the .dark class, so dark: variants disappear.
- **Lesson:** In Tailwind v4, pair CSS custom properties (flipped under .dark) with `@theme inline` to get theme-aware utility classes for free. Use semantic names (surface, separator, text-secondary, accent, danger), not raw hex, so screens say what a color is FOR.

