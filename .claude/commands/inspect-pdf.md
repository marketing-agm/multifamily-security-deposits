# /inspect-pdf

List all form field names, types, and coordinates from the AGM PDF template.
Use this after replacing `public/AGM_template.pdf` to verify field names and update `lib/fieldMap.ts`.

```bash
node scripts/listPdfFields.mjs
```

Then cross-reference with the coordinate map in `lib/fieldMap.ts` and update any field names that have changed.
