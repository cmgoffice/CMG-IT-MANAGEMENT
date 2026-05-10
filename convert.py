import re
import os

files = [
    ('temp_form_001.html', 'FM-IT-001', 'RepairRequest'),
    ('temp_form_002.html', 'FM-IT-002', 'Appointment'),
    ('temp_form_003.html', 'FM-IT-003', 'AssetRequest'),
    ('temp_form_004.html', 'FM-IT-004', 'AssetReturn'),
    ('temp_form_005.html', 'FM-IT-005', 'LicenseRequest'),
    ('temp_form_006.html', 'FM-IT-006', 'UserRegistration'),
    ('temp_form_007.html', 'FM-IT-007', 'RemoteSupport')
]

for html_file, form_id, comp_name in files:
    if not os.path.exists(html_file): continue
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract main content
    main_match = re.search(r'<main[^>]*>(.*?)</main>', content, re.DOTALL)
    if not main_match: continue
    main_content = main_match.group(1)
    
    # Clean up some common things
    main_content = main_content.replace('class=', 'className=')
    main_content = main_content.replace('for=', 'htmlFor=')
    main_content = main_content.replace('tabindex=', 'tabIndex=')
    main_content = main_content.replace('stroke-width=', 'strokeWidth=')
    main_content = main_content.replace('stroke-linecap=', 'strokeLinecap=')
    main_content = main_content.replace('stroke-linejoin=', 'strokeLinejoin=')
    main_content = main_content.replace('clip-rule=', 'clipRule=')
    main_content = main_content.replace('fill-rule=', 'fillRule=')
    
    main_content = re.sub(r'<input([^>]*?)>', lambda m: '<input' + m.group(1) + ('/>' if not m.group(1).endswith('/') else '>'), main_content)
    main_content = re.sub(r'<img([^>]*?)>', lambda m: '<img' + m.group(1) + ('/>' if not m.group(1).endswith('/') else '>'), main_content)
    main_content = re.sub(r'<hr([^>]*?)>', lambda m: '<hr' + m.group(1) + ('/>' if not m.group(1).endswith('/') else '>'), main_content)
    main_content = re.sub(r'<br([^>]*?)>', lambda m: '<br' + m.group(1) + ('/>' if not m.group(1).endswith('/') else '>'), main_content)
    
    # Simple style replacements
    main_content = main_content.replace('style="animation-delay: -7s;"', 'style={{ animationDelay: \'-7s\' }}')
    main_content = main_content.replace('style="animation-delay: -2s;"', 'style={{ animationDelay: \'-2s\' }}')
    main_content = main_content.replace('style="animation-delay: -5s;"', 'style={{ animationDelay: \'-5s\' }}')
    main_content = main_content.replace('style="font-variation-settings: \'FILL\' 1;"', 'style={{ fontVariationSettings: "\'FILL\' 1" }}')
    main_content = main_content.replace('style="font-variation-settings: \'FILL\' 0;"', 'style={{ fontVariationSettings: "\'FILL\' 0" }}')
    main_content = main_content.replace('style="--tw-blur: blur(80px);"', 'style={{ filter: "blur(80px)" }}')
    main_content = main_content.replace('style="width: 25%;"', 'style={{ width: "25%" }}')
    main_content = main_content.replace('style="width: 50%;"', 'style={{ width: "50%" }}')
    main_content = main_content.replace('style="width: 75%;"', 'style={{ width: "75%" }}')
    main_content = main_content.replace('style="width: 100%;"', 'style={{ width: "100%" }}')
    
    # remove HTML comments
    main_content = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', main_content, flags=re.DOTALL)
    
    # Fix multiple inputs getting messed up by regex if they already had self closing (e.g., `<input ... />>`)
    main_content = main_content.replace('//>', '/>')
    main_content = main_content.replace('/>>', '/>')
    
    # Write TSX
    tsx_content = f'''import React from "react";

const {comp_name} = () => {{
  return (
    <>
{main_content}
    </>
  );
}};

export default {comp_name};
'''
    with open(f'src/pages/forms/{comp_name}.tsx', 'w', encoding='utf-8') as f:
        f.write(tsx_content)
