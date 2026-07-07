# Lib — Excel parsing, calculations, field mapping, PDF filling — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

<!-- log-id: blank-filter-row :: Property read from first row after header grabbed AppFolio's blank filter row -->
### 2026-07-07 · lib · bug · Property read from first row after header grabbed AppFolio's blank filter row
- **Ref:** blank-filter-row
- **Symptom:** Dashboard/PDF showed the uploaded file name ('...Appfolio Refresh - V1') instead of the real property ('NIWA APARTMENTS'), even though the sheet's Property column clearly said 'A416 - NIWA APARTMENTS ...'.
- **Root cause:** The row immediately after the detected header is AppFolio's empty filter row; ledgerRows[0].Property was '' → lookupProperty(null) → propertyName '' → app/page.tsx fell back to file.name.
- **Fix:** Resolve the property PER tenant row (inside the loop, after the blank-row skip) instead of from ledgerRows[0]; also fixes multi-property exports. Store per-return propertyName/propertyConfig; the parser summarizes distinct names for the session label.
- **Lesson:** Never derive file-level values from 'first data row' of an AppFolio export — the first row is a blank filter row. Read from real (non-blank) rows. Test parsers with a blank filter row present.


<!-- log-id: multi-property :: Parser assumed one property per upload; multi-property exports mis-tagged -->
### 2026-07-07 · lib · bug · Parser assumed one property per upload; multi-property exports mis-tagged
- **Ref:** multi-property
- **Symptom:** In an export spanning multiple properties, all tenants showed the first property's name and their PDFs carried the wrong site/property manager names, NRC defaults, and utility type.
- **Root cause:** lib/parser.ts resolved a single firstPropertyValue/propertyConfig before the row loop and reused it for all returns.
- **Fix:** Resolve property PER row (lookupProperty on each row's Property cell), seed that return's NRC/utility from its own config, and store propertyName + propertyConfig on each TenantReturn. Consumers (Review, PDF, ReturnForm, Dashboard grouping) use the per-return property, falling back to the session for older/demo data.
- **Lesson:** Don't derive a whole-file attribute from row 0 when the file can contain multiple values of it — resolve per row. AppFolio move-out exports can mix properties.


<!-- log-id: 98eb57f-pdf :: Double dollar sign in filled AGM PDF ($0.00) -->
### 2026-07-06 · lib · bug · Double dollar sign in filled AGM PDF ($0.00)
- **Ref:** 98eb57f-pdf
- **Symptom:** Generated Checkout Report showed '$0.00' / '- $0.00' in totals, credits, and balance cells.
- **Root cause:** pdfFiller used formatCurrency() (Intl currency style, includes $) for cells that already have a printed $ in the template.
- **Fix:** Add money() — Intl decimal format, 2 decimals, no symbol — and use it for every PDF currency cell; let the template supply the $.
- **Lesson:** When filling a pre-printed PDF form, match the template: never write a currency symbol into a cell that already prints one. Preview the actual filled PDF, don't assume.


<!-- log-id: 2618a8f :: AppFolio export has metadata rows before column headers -->
### 2026-07-06 · lib · bug · AppFolio export has metadata rows before column headers
- **Ref:** 2618a8f
- **Symptom:** Dashboard showed 0 of 0 complete after upload — no tenants populated.
- **Root cause:** XLSX.utils.sheet_to_json treats row 0 as the header row by default. The real AppFolio export prepends several metadata rows (report title, export date, filter labels) before the actual column header row, so all column lookups returned empty strings.
- **Fix:** Read with { header: 1 } to get raw arrays, scan for the first row containing sentinel columns (Unit, Tenant, Property), then slice data from that row onward. Also skip Transactions group-label rows (Current, Evict, Past, Notice, Future) that carry no tenant data.
- **Lesson:** Never assume sheet_to_json row-0-as-header works for third-party exports. Scan for headers dynamically when the export format is not fully controlled.

