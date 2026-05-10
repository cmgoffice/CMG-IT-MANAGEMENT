const fs = require('fs');
const path = require('path');

const files = [
    { html: 'temp_form_001.html', id: 'FM-IT-001', comp: 'RepairRequest' },
    { html: 'temp_form_002.html', id: 'FM-IT-002', comp: 'Appointment' },
    { html: 'temp_form_003.html', id: 'FM-IT-003', comp: 'AssetRequest' },
    { html: 'temp_form_004.html', id: 'FM-IT-004', comp: 'AssetReturn' },
    { html: 'temp_form_005.html', id: 'FM-IT-005', comp: 'LicenseRequest' },
    { html: 'temp_form_006.html', id: 'FM-IT-006', comp: 'UserRegistration' },
    { html: 'temp_form_007.html', id: 'FM-IT-007', comp: 'RemoteSupport' }
];

for (const { html, id, comp } of files) {
    if (!fs.existsSync(html)) continue;
    
    let content = fs.readFileSync(html, 'utf-8');
    
    // extract main
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    if (!mainMatch) continue;
    let mainContent = mainMatch[1];
    
    // React specific replacements
    mainContent = mainContent.replace(/class=/g, 'className=');
    mainContent = mainContent.replace(/for=/g, 'htmlFor=');
    mainContent = mainContent.replace(/tabindex=/g, 'tabIndex=');
    mainContent = mainContent.replace(/stroke-width=/g, 'strokeWidth=');
    mainContent = mainContent.replace(/stroke-linecap=/g, 'strokeLinecap=');
    mainContent = mainContent.replace(/stroke-linejoin=/g, 'strokeLinejoin=');
    mainContent = mainContent.replace(/clip-rule=/g, 'clipRule=');
    mainContent = mainContent.replace(/fill-rule=/g, 'fillRule=');
    mainContent = mainContent.replace(/autocomplete=/g, 'autoComplete=');
    mainContent = mainContent.replace(/maxlength=/g, 'maxLength=');
    
    // Self close tags
    mainContent = mainContent.replace(/<input([^>]*?)>/g, (match, p1) => {
        if (p1.trim().endsWith('/')) return match;
        return `<input${p1}/>`;
    });
    mainContent = mainContent.replace(/<img([^>]*?)>/g, (match, p1) => {
        if (p1.trim().endsWith('/')) return match;
        return `<img${p1}/>`;
    });
    mainContent = mainContent.replace(/<hr([^>]*?)>/g, (match, p1) => {
        if (p1.trim().endsWith('/')) return match;
        return `<hr${p1}/>`;
    });
    mainContent = mainContent.replace(/<br([^>]*?)>/g, (match, p1) => {
        if (p1.trim().endsWith('/')) return match;
        return `<br${p1}/>`;
    });
    
    // Clean up double slashes if any
    mainContent = mainContent.replace(/\/\/>/g, '/>');
    
    // Simple style replacements
    mainContent = mainContent.replace(/style="animation-delay:\s*-7s;"/g, 'style={{ animationDelay: \'-7s\' }}');
    mainContent = mainContent.replace(/style="animation-delay:\s*-2s;"/g, 'style={{ animationDelay: \'-2s\' }}');
    mainContent = mainContent.replace(/style="animation-delay:\s*-5s;"/g, 'style={{ animationDelay: \'-5s\' }}');
    mainContent = mainContent.replace(/style="font-variation-settings:\s*'FILL'\s*1;"/g, 'style={{ fontVariationSettings: "\'FILL\' 1" }}');
    mainContent = mainContent.replace(/style="font-variation-settings:\s*'FILL'\s*0;"/g, 'style={{ fontVariationSettings: "\'FILL\' 0" }}');
    mainContent = mainContent.replace(/style="--tw-blur:\s*blur\(80px\);"/g, 'style={{ filter: "blur(80px)" }}');
    mainContent = mainContent.replace(/style="width:\s*25%;"/g, 'style={{ width: "25%" }}');
    mainContent = mainContent.replace(/style="width:\s*50%;"/g, 'style={{ width: "50%" }}');
    mainContent = mainContent.replace(/style="width:\s*75%;"/g, 'style={{ width: "75%" }}');
    mainContent = mainContent.replace(/style="width:\s*100%;"/g, 'style={{ width: "100%" }}');
    
    // Comments
    mainContent = mainContent.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
    
    const tsxContent = `import React from "react";\n\nconst ${comp} = () => {\n  return (\n    <>\n${mainContent}\n    </>\n  );\n};\n\nexport default ${comp};\n`;
    
    fs.writeFileSync(`src/pages/forms/${comp}.tsx`, tsxContent, 'utf-8');
    console.log(`Created ${comp}.tsx`);
}
