# /test-fill

Generate a test-filled PDF using dummy data to verify field mapping is correct.
Output goes to `/tmp/test_fill.pdf`.

```bash
node -e "
const { PDFDocument, PDFTextField, PDFCheckBox } = require('./node_modules/pdf-lib');
const { readFileSync, writeFileSync } = require('fs');

async function main() {
  const bytes = readFileSync('public/AGM_template.pdf');
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const fields = form.getFields();
  
  // Fill every text field with its own name so you can see where each field lands
  for (const f of fields) {
    if (f.constructor.name === 'PDFTextField') {
      try { f.setText(f.getName().substring(0, 20)); } catch {}
    }
  }
  
  writeFileSync('/tmp/test_fill.pdf', await doc.save());
  console.log('Written: /tmp/test_fill.pdf — open and verify field placement');
}
main().catch(console.error);
"
```

Review the output PDF and compare field positions against `lib/fieldMap.ts`.
