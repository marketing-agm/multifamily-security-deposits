# /parse-sample

Test the AppFolio Excel parser against a sample file.
Drop a sample `.xlsx` at `docs/sample-export.xlsx` then run:

```bash
node -e "
const XLSX = require('./node_modules/xlsx');
const { readFileSync } = require('fs');

const buf = readFileSync('docs/sample-export.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
  if (rows.length > 0) {
    console.log('\n--- ' + name + ' ---');
    console.log('Columns:', Object.keys(rows[0]));
    console.log('Row 1:', JSON.stringify(rows[0], null, 2));
  }
}
"
```

Use the output to update column name aliases in `lib/parser.ts` → the `pick()` calls for each field.
