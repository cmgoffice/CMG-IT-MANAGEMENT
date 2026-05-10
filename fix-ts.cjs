const fs = require('fs');
const path = require('path');

const dir = 'src/pages/forms';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.tsx')) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/import React from ["']react["'];?\n?/g, '');
    content = content.replace(/readonly="[^"]*"/gi, 'readOnly={true}');
    content = content.replace(/ readonly /gi, ' readOnly ');
    content = content.replace(/rows="(\d+)"/g, 'rows={$1}');
    content = content.replace(/disabled="[^"]*"/gi, 'disabled={true}');
    content = content.replace(/checked="[^"]*"/gi, 'checked={true}');
    content = content.replace(/required="[^"]*"/gi, 'required={true}');
    fs.writeFileSync(fullPath, content);
  }
});

let itforms = fs.readFileSync('src/pages/ITForms.tsx', 'utf8');
itforms = itforms.replace(/import React from ["']react["'];?\n?/g, '');
fs.writeFileSync('src/pages/ITForms.tsx', itforms);
