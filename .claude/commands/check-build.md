# /check-build

Run TypeScript check and Next.js build to confirm nothing is broken before pushing.

```bash
npm run build
```

Check for:
- TypeScript errors (shown before static page generation)
- Missing imports or type mismatches in `lib/`, `components/`, `app/`
- Any route errors in the build output

If the build passes, all routes and types are clean.
