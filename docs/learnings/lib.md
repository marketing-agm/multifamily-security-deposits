# Lib — Excel parsing, calculations, field mapping, PDF filling — learnings

Fixes and gotchas for this area, newest first. Index: [README.md](./README.md).

<!-- newest first -->

<!-- log-id: 2618a8f :: AppFolio export has metadata rows before column headers -->
### 2026-07-06 · lib · bug · AppFolio export has metadata rows before column headers
- **Ref:** 2618a8f
- **Symptom:** Dashboard showed 0 of 0 complete after upload — no tenants populated.
- **Root cause:** XLSX.utils.sheet_to_json treats row 0 as the header row by default. The real AppFolio export prepends several metadata rows (report title, export date, filter labels) before the actual column header row, so all column lookups returned empty strings.
- **Fix:** Read with { header: 1 } to get raw arrays, scan for the first row containing sentinel columns (Unit, Tenant, Property), then slice data from that row onward. Also skip Transactions group-label rows (Current, Evict, Past, Notice, Future) that carry no tenant data.
- **Lesson:** Never assume sheet_to_json row-0-as-header works for third-party exports. Scan for headers dynamically when the export format is not fully controlled.

