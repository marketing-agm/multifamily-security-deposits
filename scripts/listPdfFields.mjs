// Run: node scripts/listPdfFields.mjs
// Lists all form field names in AGM_template.pdf so they can be verified against fieldMap.ts
import { readFileSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

const bytes = readFileSync('public/AGM_template.pdf');
const pdfDoc = await PDFDocument.load(bytes);
const form = pdfDoc.getForm();
const fields = form.getFields();

console.log(`Found ${fields.length} fields:\n`);
for (const field of fields) {
  console.log(`  ${field.constructor.name.padEnd(16)} ${field.getName()}`);
}
