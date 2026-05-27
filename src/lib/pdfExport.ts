import { PDFDocument, PDFName } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Interface matching the FormRecord used in FormBackend
interface FormRecord {
  id: string;
  docNo?: string;
  requestDate?: string;
  equipmentCategory?: {
    computer?: boolean;
    printer?: boolean;
    radio?: boolean;
    cctv?: boolean;
    other?: boolean;
    otherText?: string;
  };
  reporter?: {
    name?: string;
    department?: string;
    jobTitle?: string;
    phone?: string;
    email?: string;
  };
  issueDescription?: {
    wontTurnOn?: boolean;
    slow?: boolean;
    noPower?: boolean;
    broken?: boolean;
    other?: boolean;
    detailedDescription?: string;
  };
  asset?: {
    assetId?: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    purchaseDate?: string;
    caretaker?: string;
    receiveDate?: string;
    repairCount?: string;
  };
  [key: string]: any;
}

export async function exportFM001(record: FormRecord) {
  try {
    // 1. Fetch PDF Template
    const pdfBytes = await fetch('/FM001-lib.pdf').then(res => {
      if (!res.ok) throw new Error('PDF template not found');
      return res.arrayBuffer();
    });
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // 2. Register fontkit and embed Thai font
    pdfDoc.registerFontkit(fontkit);
    const fontUrl = '/Sarabun-Regular.ttf';
    let customFont = null;
    try {
      const fontBytes = await fetch(fontUrl).then(res => {
        if (!res.ok) throw new Error('Font file not found on server');
        return res.arrayBuffer();
      });
      customFont = await pdfDoc.embedFont(fontBytes);
    } catch (e) {
      console.warn("Could not load Thai font, using default", e);
    }
    
    const form = pdfDoc.getForm();

    const sanitizeText = (text: string) => {
      if (!text) return '';
      // Keep Thai, English, numbers, standard punctuation, and newlines. Remove emojis.
      return String(text).replace(/[^\u0020-\u007E\u0E00-\u0E7F\n\r\t]/g, '');
    };

    const setText = (name: string, text: string) => {
      try {
        const field = form.getTextField(name);
        if (field) {
          field.setText(sanitizeText(text));
        }
      } catch (e) {
        console.warn(`Field ${name} not found or error setting text`);
      }
    };

    // Make a checkmark for CheckBox disguised as TextField
    const setCheck = (name: string, value: boolean | undefined) => {
      if (value) {
        setText(name, 'X');
      }
    };

    // Header
    setText('เลขที่ WR', record.docNo || '');
    setText('วันที่', record.requestDate || '');
    
    // Reporter
    const rep = record.reporter || {};
    setText('ผู้แจ้งซ่อม', rep.name || '');
    setText('ฝ่าย', rep.department || '');
    setText('JOB', rep.jobTitle || '');
    setText('เบอร์โทร', rep.phone || '');

    // Equipment Category
    const eq = record.equipmentCategory || {};
    setCheck('คอมพิวเตอร์/โน๊ตบุ๊ค', eq.computer);
    setCheck('เครื่องพิมพ์/ถ่ายเอกสาร', eq.printer);
    setCheck('วิทยุสื่อสาร', eq.radio);
    setCheck('กล้องวงจรปิด', eq.cctv);
    
    if (eq.other) {
      setText('Text7', eq.otherText || 'X'); // Text7 is likely "Other" in category
    }

    // Symptom
    const sym = record.issueDescription || {};
    setCheck('เปิดเครื่องไม่ติด', sym.wontTurnOn);
    setCheck('Text13', sym.slow); // เครื่องช้า/กระตุก
    setCheck('Text14', sym.noPower); // ไฟไม่เข้า
    setCheck('Text15', sym.broken); // แตก/หัก
    setCheck('Text16', sym.other); // อื่นๆ
    
    setText('reason', sym.detailedDescription || '');
    
    // We'll save the 'picture' field rect for the image and then remove the field.
    const pictureField = form.getTextField('picture');
    let pictureRect = { x: 50, y: 50, width: 300, height: 200 };
    try {
      const widget = pictureField.acroField.getWidgets()[0];
      if (widget) {
        pictureRect = widget.getRectangle();
      }
      form.removeField(pictureField);
    } catch (e) {
      console.warn("Could not process picture field", e);
    }

    // Asset
    const ast = record.asset || {};
    setText('เลขทะเบียนประจำตัวเครื่อง', ast.assetId || '');
    setText('Text18', ast.brand || '');
    setText('Text19', ast.model || '');
    setText('Text20', ast.purchaseDate || '');
    setText('Text21', ast.serialNumber || '');
    setText('Text22', ast.repairCount || '');
    setText('Text23', ast.receiveDate || '');
    setText('Text24', ast.caretaker || '');

    // Signatures
    setText('Text26', record.requestDate || '');
    setText('Text27', rep.name || '');
    
    // Remove borders from all fields before generating appearances
    const fields = form.getFields();
    fields.forEach(f => {
      f.acroField.getWidgets().forEach(w => {
        w.dict.delete(PDFName.of('Border'));
        w.dict.delete(PDFName.of('BS'));
        w.dict.delete(PDFName.of('MK')); // MK holds Border Color (BC) and Background Color (BG)
      });
    });

    // Save PDF
    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (e) {
        console.warn('Failed to update appearances with custom font:', e);
      }
    }

    // Flatten the form to remove blue interactive field backgrounds
    form.flatten();
    
    // Embed attachments (images)
    if (record.attachments && Array.isArray(record.attachments)) {
      let isFirstImage = true;
      for (const url of record.attachments) {
        if (typeof url !== 'string') continue;
        try {
          let res;
          let blob;
          try {
            res = await fetch(url);
            if (!res.ok) throw new Error('Direct fetch returned ' + res.status);
            blob = await res.blob();
          } catch (fetchErr) {
            console.warn('Direct fetch failed (likely CORS). Trying proxy...', fetchErr);
            // Fallback to a CORS proxy to bypass Firebase Storage CORS restrictions
            res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            if (!res.ok) {
               console.warn('Proxy fetch also failed:', res.status);
               continue;
            }
            blob = await res.blob();
          }
          
          const cleanBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
            const img = new Image();
            const objUrl = URL.createObjectURL(blob);
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                URL.revokeObjectURL(objUrl);
                return reject(new Error('No canvas 2d context'));
              }
              ctx.drawImage(img, 0, 0);
              canvas.toBlob((newBlob) => {
                URL.revokeObjectURL(objUrl);
                if (!newBlob) return reject(new Error('toBlob failed'));
                newBlob.arrayBuffer().then(resolve).catch(reject);
              }, 'image/jpeg', 0.85);
            };
            img.onerror = () => {
              URL.revokeObjectURL(objUrl);
              reject(new Error('Failed to load image into canvas'));
            };
            img.src = objUrl;
          });
          
          const imgObj = await pdfDoc.embedJpg(cleanBytes);
          
          if (imgObj) {
            if (isFirstImage) {
              // Draw first image inside picture area on the first page
              const firstPage = pdfDoc.getPages()[0];
              const padding = 10;
              const imgDims = imgObj.scaleToFit(pictureRect.width - padding, pictureRect.height - padding);
              
              firstPage.drawImage(imgObj, {
                x: pictureRect.x + (pictureRect.width / 2) - (imgDims.width / 2),
                y: pictureRect.y + (pictureRect.height / 2) - (imgDims.height / 2),
                width: imgDims.width,
                height: imgDims.height,
              });
              isFirstImage = false;
            } else {
              // Draw subsequent images on new pages
              const page = pdfDoc.addPage();
              const { width, height } = page.getSize();
              const padding = 40;
              const imgDims = imgObj.scaleToFit(width - padding * 2, height - padding * 2);
              
              page.drawImage(imgObj, {
                x: width / 2 - imgDims.width / 2,
                y: height / 2 - imgDims.height / 2,
                width: imgDims.width,
                height: imgDims.height,
              });
            }
          }
        } catch (err) {
          console.warn('Failed to embed image:', url, err);
        }
      }
    }
    
    const pdfBytesModified = await pdfDoc.save();
    const blob = new Blob([pdfBytesModified as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.docNo || 'FM-IT-001'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}
