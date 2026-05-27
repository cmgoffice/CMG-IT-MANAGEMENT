import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

async function run() {
  const bytes = fs.readFileSync('public/FM001-lib.pdf');
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const fields = form.getFields();
  console.log('Fields:');
  fields.forEach(f => {
    console.log(`- Name: "${f.getName()}" Type: ${f.constructor.name}`);
  });
}

run();
