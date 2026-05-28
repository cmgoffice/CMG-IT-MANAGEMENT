import { PDFDocument, PDFName } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

interface FormRecord {
  id: string;
  docNo?: string;
  requestDate?: string;
  attachments?: unknown[];
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

type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_IMAGE_RECT: PdfRect = { x: 50, y: 50, width: 300, height: 200 };

function sanitizeText(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[^\u0020-\u007E\u0E00-\u0E7F\n\r\t]/g, '');
}

function isChecked(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1;
}

async function loadPdfResources(templatePath: string) {
  const pdfBytes = await fetch(templatePath).then((res) => {
    if (!res.ok) {
      throw new Error(`PDF template not found: ${templatePath}`);
    }
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);

  let customFont: any = null;
  try {
    const fontBytes = await fetch('/Sarabun-Regular.ttf').then((res) => {
      if (!res.ok) {
        throw new Error('Font file not found on server');
      }
      return res.arrayBuffer();
    });
    customFont = await pdfDoc.embedFont(fontBytes);
  } catch (error) {
    console.warn('Could not load Thai font, using default', error);
  }

  return {
    pdfDoc,
    form: pdfDoc.getForm(),
    customFont,
  };
}

function setTextField(form: any, name: string, text: unknown) {
  try {
    const field = form.getTextField(name);
    field.setText(sanitizeText(text));
  } catch (error) {
    console.warn(`Field ${name} not found or error setting text`, error);
  }
}

function setCheckField(form: any, name: string, value: unknown) {
  if (isChecked(value)) {
    setTextField(form, name, 'X');
  }
}

function captureAndRemoveField(form: any, name: string, fallbackRect: PdfRect = DEFAULT_IMAGE_RECT): PdfRect {
  try {
    const field = form.getTextField(name);
    const widget = field.acroField.getWidgets()[0];
    const rect = widget?.getRectangle?.() || fallbackRect;
    form.removeField(field);
    return rect;
  } catch (error) {
    console.warn(`Could not process field ${name}`, error);
    return fallbackRect;
  }
}

function stripFieldBorders(form: any) {
  const fields = form.getFields();
  fields.forEach((field: any) => {
    field.acroField.getWidgets().forEach((widget: any) => {
      widget.dict.delete(PDFName.of('Border'));
      widget.dict.delete(PDFName.of('BS'));
      widget.dict.delete(PDFName.of('MK'));
    });
  });
}

async function blobToJpegBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(objUrl);
        reject(new Error('No canvas 2d context'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (newBlob) => {
          URL.revokeObjectURL(objUrl);
          if (!newBlob) {
            reject(new Error('toBlob failed'));
            return;
          }
          newBlob.arrayBuffer().then(resolve).catch(reject);
        },
        'image/jpeg',
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Failed to load image into canvas'));
    };

    img.src = objUrl;
  });
}

async function fetchAttachmentBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Direct fetch returned ${response.status}`);
    }
    return await response.blob();
  } catch (directError) {
    console.warn('Direct fetch failed (likely CORS). Trying proxy...', directError);
    const proxyResponse = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (!proxyResponse.ok) {
      throw new Error(`Proxy fetch failed: ${proxyResponse.status}`);
    }
    return await proxyResponse.blob();
  }
}

async function embedAttachments(pdfDoc: any, attachments: unknown, targetRect: PdfRect) {
  if (!Array.isArray(attachments)) return;

  let isFirstImage = true;
  for (const url of attachments) {
    if (typeof url !== 'string') continue;

    try {
      const blob = await fetchAttachmentBlob(url);
      const cleanBytes = await blobToJpegBytes(blob);
      const image = await pdfDoc.embedJpg(cleanBytes);

      if (isFirstImage) {
        const firstPage = pdfDoc.getPages()[0];
        const padding = 10;
        const dims = image.scaleToFit(targetRect.width - padding, targetRect.height - padding);

        firstPage.drawImage(image, {
          x: targetRect.x + targetRect.width / 2 - dims.width / 2,
          y: targetRect.y + targetRect.height / 2 - dims.height / 2,
          width: dims.width,
          height: dims.height,
        });

        isFirstImage = false;
        continue;
      }

      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const padding = 40;
      const dims = image.scaleToFit(width - padding * 2, height - padding * 2);

      page.drawImage(image, {
        x: width / 2 - dims.width / 2,
        y: height / 2 - dims.height / 2,
        width: dims.width,
        height: dims.height,
      });
    } catch (error) {
      console.warn('Failed to embed image:', url, error);
    }
  }
}

function downloadPdf(pdfBytes: ArrayBuffer | Uint8Array, filename: string) {
  const blobPart = pdfBytes instanceof Uint8Array ? pdfBytes.slice().buffer : pdfBytes;
  const blob = new Blob([blobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportFM001(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM001-lib.pdf');

    setTextField(form, 'à¹€à¸¥à¸‚à¸—à¸µà¹ˆ WR', record.docNo || '');
    setTextField(form, 'à¸§à¸±à¸™à¸—à¸µà¹ˆ', record.requestDate || '');

    const reporter = record.reporter || {};
    setTextField(form, 'à¸œà¸¹à¹‰à¹à¸ˆà¹‰à¸‡à¸‹à¹ˆà¸­à¸¡', reporter.name || '');
    setTextField(form, 'à¸à¹ˆà¸²à¸¢', reporter.department || '');
    setTextField(form, 'JOB', reporter.jobTitle || '');
    setTextField(form, 'à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£', reporter.phone || '');

    const equipment = record.equipmentCategory || {};
    setCheckField(form, 'à¸„à¸­à¸¡à¸žà¸´à¸§à¹€à¸•à¸­à¸£à¹Œ/à¹‚à¸™à¹Šà¸•à¸šà¸¸à¹Šà¸„', equipment.computer);
    setCheckField(form, 'à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸žà¸´à¸¡à¸žà¹Œ/à¸–à¹ˆà¸²à¸¢à¹€à¸­à¸à¸ªà¸²à¸£', equipment.printer);
    setCheckField(form, 'à¸§à¸´à¸—à¸¢à¸¸à¸ªà¸·à¹ˆà¸­à¸ªà¸²à¸£', equipment.radio);
    setCheckField(form, 'à¸à¸¥à¹‰à¸­à¸‡à¸§à¸‡à¸ˆà¸£à¸›à¸´à¸”', equipment.cctv);
    if (equipment.other) {
      setTextField(form, 'Text7', equipment.otherText || 'X');
    }

    const symptom = record.issueDescription || {};
    setCheckField(form, 'à¹€à¸›à¸´à¸”à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¹„à¸¡à¹ˆà¸•à¸´à¸”', symptom.wontTurnOn);
    setCheckField(form, 'Text13', symptom.slow);
    setCheckField(form, 'Text14', symptom.noPower);
    setCheckField(form, 'Text15', symptom.broken);
    setCheckField(form, 'Text16', symptom.other);
    setTextField(form, 'reason', symptom.detailedDescription || '');

    const pictureRect = captureAndRemoveField(form, 'picture');

    const asset = record.asset || {};
    setTextField(form, 'à¹€à¸¥à¸‚à¸—à¸°à¹€à¸šà¸µà¸¢à¸™à¸›à¸£à¸°à¸ˆà¸³à¸•à¸±à¸§à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡', asset.assetId || '');
    setTextField(form, 'Text18', asset.brand || '');
    setTextField(form, 'Text19', asset.model || '');
    setTextField(form, 'Text20', asset.purchaseDate || '');
    setTextField(form, 'Text21', asset.serialNumber || '');
    setTextField(form, 'Text22', asset.repairCount || '');
    setTextField(form, 'Text23', asset.receiveDate || '');
    setTextField(form, 'Text24', asset.caretaker || '');

    setTextField(form, 'Text26', record.requestDate || '');
    setTextField(form, 'Text27', reporter.name || '');

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();
    await embedAttachments(pdfDoc, record.attachments, pictureRect);

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${record.docNo || 'FM-IT-001'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM002(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM002-lib.pdf');

    const applicantName =
      record.applicantName || record.reporter?.name || record.reporterName || record.name || record.requester || record.submittedBy || '';
    const department =
      record.department || record.reporter?.department || record.reporterDepartment || '';
    const jobTitle =
      record.jobTitle || record.reporter?.jobTitle || record.position || record.reporterJobTitle || '';
    const phone =
      record.phone || record.reporter?.phone || record.telephone || record.reporterPhone || '';
    const docNo = record.wrNumber || record.docNo || record.id || '';
    const requestDate = record.requestDate || record.appointmentDate || '';

    setTextField(form, 'Text1', docNo);
    setTextField(form, 'Text2', requestDate);
    setTextField(form, 'Text3', applicantName);
    setTextField(form, 'Text4', department);
    setTextField(form, 'Text5', jobTitle);
    setTextField(form, 'Text6', phone);
    setTextField(form, 'Text7', record.appointmentDate || '');
    setTextField(form, 'Text8', record.appointmentTime || '');
    setTextField(form, 'Text9', record.location || '');
    setTextField(form, 'Text10', record.jobDetails || '');

    setCheckField(form, 'Text11', record.prepareTools);
    setCheckField(form, 'Text12', record.assessEquipment);
    setCheckField(form, 'Text13', record.toolsPrepared);

    const pictureRect = captureAndRemoveField(form, 'Text14', {
      x: 27.012505,
      y: 178.976562,
      width: 535.24781,
      height: 167.97799700000002,
    });

    setTextField(form, 'Text15', applicantName);
    setTextField(form, 'Text16', requestDate);

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();
    await embedAttachments(pdfDoc, record.attachments, pictureRect);

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-002'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM003(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM003-lib.pdf');

    const docNo = record.wrNumber || record.docNo || record.id || '';
    const requestDate = record.requestDate || record.dateOfUse || '';
    const applicantName = record.applicantName || record.reporter?.name || '';
    const department = record.department || record.reporter?.department || '';
    const position = record.jobTitle || record.reporter?.jobTitle || '';
    const jobName = record.jobName || '';
    const phone = record.phone || record.reporter?.phone || '';

    setTextField(form, 'Text1', docNo);
    setTextField(form, 'Text2', requestDate);

    setCheckField(form, 'Text3', record.reqType_new);
    setCheckField(form, 'Text4', record.reqType_change);

    setTextField(form, 'Text5', applicantName);
    setTextField(form, 'Text6', department);
    setTextField(form, 'Text7', position);
    setTextField(form, 'Text8', jobName);
    setTextField(form, 'Text9', phone);
    setTextField(form, 'Text10', record.dateOfUse || '');
    setTextField(form, 'Text11', record.reason || '');

    // Equipment section follows the PDF layout: left/right columns, top to bottom.
    setCheckField(form, 'Text12', record.eqComputer);
    setCheckField(form, 'Text14', record.eqPrinter);
    setCheckField(form, 'Text13', record.eqCctv);
    setCheckField(form, 'Text15', record.eqRadio);
    setCheckField(form, 'Text16', record.eqMonitor);
    setCheckField(form, 'Text17', record.eqOther);
    setTextField(form, 'Text18', record.eqQuantity || '');

    setTextField(form, 'Text19', record.assetId || '');
    setTextField(form, 'Text20', record.model || '');
    setTextField(form, 'Text21', record.serialNumber || '');
    setTextField(form, 'Text22', record.previousUser || '');
    setTextField(form, 'Text23', record.previousPosition || '');
    setTextField(form, 'Text24', record.previousJob || '');
    setTextField(form, 'Text25', record.changeReason || '');

    // Fill only the requester-side signature info; approval/receiving fields stay blank unless data exists.
    setTextField(form, 'Text26', applicantName);
    setTextField(form, 'Text28', requestDate);
    setTextField(form, 'Text30', record.receiveAssetId || '');

    if (record.senderName || record.handoverBy) {
      setTextField(form, 'Text31', record.senderName || record.handoverBy || '');
    }
    if (record.receiverName || record.receivedBy) {
      setTextField(form, 'Text32', record.receiverName || record.receivedBy || '');
    }
    if (record.senderDate || record.handoverDate) {
      setTextField(form, 'Text34', record.senderDate || record.handoverDate || '');
    }
    if (record.receiverDate || record.receivedDate) {
      setTextField(form, 'Text33', record.receiverDate || record.receivedDate || '');
    }

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-003'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM004(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM004-lib.pdf');

    const docNo = record.wrNumber || record.docNo || record.id || '';
    const requestDate = record.requestDate || record.returnDate || '';

    setTextField(form, 'Text1', docNo);
    setTextField(form, 'Text2', requestDate);

    setTextField(form, 'Text3', record.returnerName || record.reporter?.name || '');
    setTextField(form, 'Text4', record.department || record.reporter?.department || '');
    setTextField(form, 'Text5', record.jobTitle || record.reporter?.jobTitle || '');
    setTextField(form, 'Text6', record.jobName || '');
    setTextField(form, 'Text7', record.phone || record.reporter?.phone || '');
    setTextField(form, 'Text8', record.returnDate || '');
    setTextField(form, 'Text9', record.reason || '');
    setTextField(form, 'Text10', record.assetId || '');

    // Equipment section follows the same left/right checkbox pattern as FM-IT-003.
    setCheckField(form, 'Text11', record.eqComputer);
    setCheckField(form, 'Text14', record.eqPrinter);
    setCheckField(form, 'Text12', record.eqCctv);
    setCheckField(form, 'Text15', record.eqRadio);
    setCheckField(form, 'Text13', record.eqMonitor);
    setCheckField(form, 'Text16', record.eqOther);
    setTextField(form, 'Text17', record.eqOtherText || '');
    setTextField(form, 'Text18', record.eqQuantity || '');

    setTextField(form, 'Text19', record.cancelAssetId || '');
    setTextField(form, 'Text20', record.cancelUser || '');
    setTextField(form, 'Text21', record.cancelDepartment || '');
    setTextField(form, 'Text22', record.cancelPosition || '');
    setTextField(form, 'Text23', record.cancelJob || '');
    setTextField(form, 'Text24', record.cancelPhone || '');
    setTextField(form, 'Text25', record.cancelReason || '');

    setTextField(form, 'Text26', record.returnerName || record.reporter?.name || '');
    setTextField(form, 'Text28', requestDate);
    setTextField(form, 'Text30', record.receivedAssetId || '');

    if (record.approverName) {
      setTextField(form, 'Text27', record.approverName);
    }
    if (record.approverDate) {
      setTextField(form, 'Text29', record.approverDate);
    }
    if (record.returnSenderName || record.senderName) {
      setTextField(form, 'Text31', record.returnSenderName || record.senderName || '');
    }
    if (record.returnSenderDate || record.senderDate) {
      setTextField(form, 'Text32', record.returnSenderDate || record.senderDate || '');
    }
    if (record.returnReceiverName || record.receiverName) {
      setTextField(form, 'Text33', record.returnReceiverName || record.receiverName || '');
    }
    if (record.returnReceiverDate || record.receiverDate) {
      setTextField(form, 'Text34', record.returnReceiverDate || record.receiverDate || '');
    }

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-004'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM005(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM005-lib.pdf');

    const docNo = record.wrNumber || record.docNo || record.id || '';
    const requestDate = record.requestDate || '';
    const applicantName = record.applicantName || record.reporter?.name || '';

    setTextField(form, 'Text1', docNo);
    setTextField(form, 'Text2', requestDate);

    setCheckField(form, 'Text3', record.reqType_new);
    setCheckField(form, 'Text4', record.reqType_renew);

    setCheckField(form, 'Text5', record.sw_office);
    setCheckField(form, 'Text6', record.sw_sketchup);
    setCheckField(form, 'Text7', record.sw_autodesk);
    setCheckField(form, 'Text8', record.sw_other);
    setCheckField(form, 'Text9', record.sw_adobe);

    setTextField(form, 'Text10', applicantName);
    setTextField(form, 'Text11', record.jobTitle || record.reporter?.jobTitle || '');
    setTextField(form, 'Text12', record.department || record.reporter?.department || '');
    setTextField(form, 'Text13', record.jobName || '');
    setTextField(form, 'Text14', record.phone || record.reporter?.phone || '');
    setTextField(form, 'Text15', record.reason || record.sw_otherText || '');

    setTextField(form, 'Text16', record.requesterName || applicantName);
    setTextField(form, 'Text18', record.requesterDate || requestDate);

    if (record.approverName) {
      setTextField(form, 'Text17', record.approverName);
    }
    if (record.approverDate) {
      setTextField(form, 'Text19', record.approverDate);
    }

    setTextField(form, 'Text20', record.it_registeredProgram || '');
    setTextField(form, 'Text21', record.it_packetDetails || '');
    setTextField(form, 'Text22', record.it_startDate || '');
    setTextField(form, 'Text23', record.it_expireDate || '');

    if (record.it_operatorName || record.itStaffName) {
      setTextField(form, 'Text24', record.it_operatorName || record.itStaffName || '');
    }
    if (record.it_operatorDate || record.it_processedDate) {
      setTextField(form, 'Text25', record.it_operatorDate || record.it_processedDate || '');
    }

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-005'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM006(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM006-lib.pdf');

    const docNo = record.wrNumber || record.docNo || record.id || '';
    const requestDate = record.requestDate || record.dateOfUse || '';
    const applicantName = record.applicantName || record.reporter?.name || '';

    setTextField(form, 'Text1', docNo);
    setTextField(form, 'Text2', requestDate);

    setCheckField(form, 'Text3', record.req_email);
    setCheckField(form, 'Text4', record.req_storage);
    setCheckField(form, 'Text5', record.req_cctv);

    setTextField(form, 'Text6', applicantName);
    setTextField(form, 'Text7', record.jobTitle || record.reporter?.jobTitle || '');
    setTextField(form, 'Text8', record.department || record.reporter?.department || '');
    setTextField(form, 'Text9', record.jobName || '');
    setTextField(form, 'Text10', record.phone || record.reporter?.phone || '');
    setTextField(form, 'Text11', record.dateOfUse || '');
    setTextField(form, 'Text12', record.reason || '');
    setTextField(form, 'Text13', record.email || record.reporter?.email || '');
    setTextField(
      form,
      'Text14',
      [record.dataAccessDetails, record.dataAccessDetails_2].filter(Boolean).join(' '),
    );

    setTextField(form, 'Text15', record.requesterName || applicantName);
    setTextField(form, 'Text16', record.requesterDate || requestDate);

    if (record.approverName) {
      setTextField(form, 'Text17', record.approverName);
    }
    if (record.approverDate) {
      setTextField(form, 'Text18', record.approverDate);
    }

    setTextField(form, 'Text19', record.it_actionDone || '');
    setTextField(form, 'Text20', record.it_username || '');
    setTextField(form, 'Text21', record.it_password || '');

    if (record.it_operatorName || record.itStaffName) {
      setTextField(form, 'Text22', record.it_operatorName || record.itStaffName || '');
    }
    if (record.it_operatorDate || record.it_processedDate) {
      setTextField(form, 'Text23', record.it_operatorDate || record.it_processedDate || '');
    }

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-006'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM007(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM007-lib.pdf');

    const docNo = record.wrNumber || record.docNo || record.id || '';
    const requestDate = record.requestDate || '';
    const applicantName = record.applicantName || record.reporter?.name || '';

    setTextField(form, 'Text1', docNo);
    setTextField(form, 'Text2', requestDate);

    setCheckField(form, 'Text3', record.eq_computer);
    setCheckField(form, 'Text4', record.eq_printer);
    setCheckField(form, 'Text5', record.eq_radio);
    setCheckField(form, 'Text6', record.eq_cctv);
    setCheckField(form, 'Text7', record.eq_other);

    setTextField(form, 'Text8', applicantName);
    setTextField(form, 'Text9', record.department || record.reporter?.department || '');
    setTextField(form, 'Text10', record.jobName || '');
    setTextField(form, 'Text11', record.phone || record.reporter?.phone || '');

    setCheckField(form, 'Text12', record.symp_slow);
    setCheckField(form, 'Text13', record.symp_software);
    setCheckField(form, 'Text14', record.symp_check);
    setCheckField(form, 'Text15', record.symp_support);
    setCheckField(form, 'Text16', record.symp_other);

    setTextField(
      form,
      'Text17',
      [record.requirements, record.requirements_2, record.requirements_3].filter(Boolean).join('\n'),
    );
    setTextField(form, 'Text18', record.remoteProgram || '');
    setTextField(form, 'Text19', record.remoteId || '');
    setTextField(form, 'Text20', record.appointmentTime || '');

    setTextField(form, 'Text21', record.requesterName || applicantName);
    setTextField(form, 'Text22', record.requesterDate || requestDate);

    if (record.receiverName || record.itStaffName || record.it_operatorName) {
      setTextField(form, 'Text23', record.receiverName || record.itStaffName || record.it_operatorName || '');
    }
    if (record.receiverDate || record.it_processedDate || record.it_operatorDate) {
      setTextField(form, 'Text24', record.receiverDate || record.it_processedDate || record.it_operatorDate || '');
    }

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-007'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM001Thai(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM001-lib.pdf');

    const docNo = record.docNo || record.wrNumber || record.id || '';
    const requestDate = record.requestDate || '';
    const reporter = record.reporter || {};
    const equipment = record.equipmentCategory || {};
    const symptom = record.issueDescription || {};
    const asset = record.asset || {};

    setTextField(form, 'เลขที่ WR', docNo);
    setTextField(form, 'วันที่', requestDate);

    setTextField(form, 'ผู้แจ้งซ่อม', reporter.name || '');
    setTextField(form, 'ฝ่าย', reporter.department || '');
    setTextField(form, 'JOB', reporter.jobTitle || '');
    setTextField(form, 'เบอร์โทร', reporter.phone || '');

    setCheckField(form, 'คอมพิวเตอร์/โน๊ตบุ๊ค', equipment.computer);
    setCheckField(form, 'เครื่องพิมพ์/ถ่ายเอกสาร', equipment.printer);
    setCheckField(form, 'วิทยุสื่อสาร', equipment.radio);
    setCheckField(form, 'กล้องวงจรปิด', equipment.cctv);
    setCheckField(form, 'Text7', equipment.other);

    setCheckField(form, 'เปิดเครื่องไม่ติด', symptom.wontTurnOn);
    setCheckField(form, 'Text13', symptom.slow);
    setCheckField(form, 'Text14', symptom.noPower);
    setCheckField(form, 'Text15', symptom.broken);
    setCheckField(form, 'Text16', symptom.other);
    setTextField(form, 'reason', symptom.detailedDescription || '');

    const pictureRect = captureAndRemoveField(form, 'picture');

    setTextField(form, 'เลขทะเบียนประจำตัวเครื่อง', asset.assetId || '');
    setTextField(form, 'Text18', asset.brand || '');
    setTextField(form, 'Text19', asset.model || '');
    setTextField(form, 'Text20', asset.purchaseDate || '');
    setTextField(form, 'Text21', asset.serialNumber || '');
    setTextField(form, 'Text22', asset.repairCount || '');
    setTextField(form, 'Text23', asset.receiveDate || '');
    setTextField(form, 'Text24', asset.caretaker || '');

    setTextField(form, 'Text26', requestDate);
    setTextField(form, 'Text27', reporter.name || '');

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();
    await embedAttachments(pdfDoc, record.attachments, pictureRect);

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-001'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}

export async function exportFM001Unified(record: FormRecord) {
  try {
    const { pdfDoc, form, customFont } = await loadPdfResources('/FM001-lib.pdf');

    const docNo = record.docNo || record.wrNumber || record.id || '';
    const requestDate = record.requestDate || record.dateOfUse || '';
    const reporter = typeof record.reporter === 'object' && record.reporter ? record.reporter : {};
    const equipment = typeof record.equipmentCategory === 'object' && record.equipmentCategory ? record.equipmentCategory : {};
    const symptom = typeof record.issueDescription === 'object' && record.issueDescription ? record.issueDescription : {};
    const asset = typeof record.asset === 'object' && record.asset ? record.asset : {};
    const equipmentText = typeof record.equipmentCategory === 'string' ? record.equipmentCategory : '';
    const symptomText =
      typeof record.issueDescription === 'string'
        ? record.issueDescription
        : typeof record.symptoms === 'string'
          ? record.symptoms
          : '';

    const hasValue = (...values: unknown[]) => values.some((value) => isChecked(value));
    const textIncludes = (value: string, needle: string) => value.toLowerCase().includes(needle.toLowerCase());

    const reporterName =
      reporter.name || record.reporterName || record.applicantName || record.name || record.submittedBy || '';
    const reporterDepartment = reporter.department || record.department || record.reporterDepartment || '';
    const reporterJobTitle = reporter.jobTitle || record.jobTitle || record.position || record.reporterJobTitle || '';
    const reporterPhone = reporter.phone || record.phone || record.telephone || record.reporterPhone || '';

    const eqComputer = hasValue(equipment.computer, (equipment as any)['คอมพิวเตอร์/โน๊ตบุ๊ค'], record.eqComputer, record.eq_computer)
      || textIncludes(equipmentText, 'คอมพิวเตอร์');
    const eqPrinter = hasValue(equipment.printer, (equipment as any)['เครื่องพิมพ์/ถ่ายเอกสาร'], record.eqPrinter, record.eq_printer)
      || textIncludes(equipmentText, 'เครื่องพิมพ์');
    const eqRadio = hasValue(equipment.radio, (equipment as any)['วิทยุสื่อสาร'], record.eqRadio, record.eq_radio)
      || textIncludes(equipmentText, 'วิทยุ');
    const eqCctv = hasValue(equipment.cctv, (equipment as any)['กล้องวงจรปิด'], record.eqCctv, record.eq_cctv)
      || textIncludes(equipmentText, 'กล้องวงจรปิด');
    const eqOther = hasValue(equipment.other, (equipment as any)['อื่นๆ'], record.eqOther, record.eq_other)
      || textIncludes(equipmentText, 'อื่น');

    const sympWontTurnOn = hasValue(symptom.wontTurnOn, (symptom as any)['เปิดเครื่องไม่ติด'], record.symptomWontTurnOn)
      || textIncludes(symptomText, 'เปิดเครื่องไม่ติด');
    const sympSlow = hasValue(symptom.slow, (symptom as any)['เครื่องช้า/กระตุก'], record.symptomSlow, record.symp_slow)
      || textIncludes(symptomText, 'ช้า')
      || textIncludes(symptomText, 'กระตุก');
    const sympNoPower = hasValue(symptom.noPower, (symptom as any)['ไฟไม่เข้า'], record.symptomNoPower)
      || textIncludes(symptomText, 'ไฟไม่เข้า');
    const sympBroken = hasValue(symptom.broken, (symptom as any)['แตก/หัก'], record.symptomBroken)
      || textIncludes(symptomText, 'แตก')
      || textIncludes(symptomText, 'หัก');
    const sympOther = hasValue(symptom.other, (symptom as any)['อื่นๆ'], record.symptomOther, record.symp_other)
      || textIncludes(symptomText, 'อื่น');

    const assetId = asset.assetId || record.assetId || record.assetNumber || record.registrationNumber || record.assetCode || '';
    const assetBrand = asset.brand || record.brand || record.assetBrand || '';
    const assetModel = asset.model || record.model || record.assetModel || '';
    const assetSerial = asset.serialNumber || record.serialNumber || record.assetSerial || record.sn || '';
    const assetPurchaseDate = asset.purchaseDate || record.purchaseDate || record.assetPurchaseDate || '';
    const assetRepairCount = asset.repairCount || record.repairCount || '';
    const assetReceiveDate = asset.receiveDate || record.receiveDate || record.assetReceiveDate || '';
    const assetCaretaker = asset.caretaker || record.caretaker || record.assetCaretaker || '';

    setTextField(form, '\u0e40\u0e25\u0e02\u0e17\u0e35\u0e48 WR', docNo);
    setTextField(form, '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48', requestDate);

    setTextField(form, '\u0e1c\u0e39\u0e49\u0e41\u0e08\u0e49\u0e07\u0e0b\u0e48\u0e2d\u0e21', reporterName);
    setTextField(form, '\u0e1d\u0e48\u0e32\u0e22', reporterDepartment);
    setTextField(form, 'JOB', reporterJobTitle);
    setTextField(form, '\u0e40\u0e1a\u0e2d\u0e23\u0e4c\u0e42\u0e17\u0e23', reporterPhone);

    setCheckField(form, '\u0e04\u0e2d\u0e21\u0e1e\u0e34\u0e27\u0e40\u0e15\u0e2d\u0e23\u0e4c/\u0e42\u0e19\u0e4a\u0e15\u0e1a\u0e38\u0e4a\u0e04', eqComputer);
    setCheckField(form, '\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e1e\u0e34\u0e21\u0e1e\u0e4c/\u0e16\u0e48\u0e32\u0e22\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23', eqPrinter);
    setCheckField(form, '\u0e27\u0e34\u0e17\u0e22\u0e38\u0e2a\u0e37\u0e48\u0e2d\u0e2a\u0e32\u0e23', eqRadio);
    setCheckField(form, '\u0e01\u0e25\u0e49\u0e2d\u0e07\u0e27\u0e07\u0e08\u0e23\u0e1b\u0e34\u0e14', eqCctv);
    setCheckField(form, 'Text7', eqOther);

    setCheckField(form, '\u0e40\u0e1b\u0e34\u0e14\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e44\u0e21\u0e48\u0e15\u0e34\u0e14', sympWontTurnOn);
    setCheckField(form, 'Text13', sympSlow);
    setCheckField(form, 'Text14', sympNoPower);
    setCheckField(form, 'Text15', sympBroken);
    setCheckField(form, 'Text16', sympOther);
    setTextField(form, 'reason', symptom.detailedDescription || record.detailedDescription || symptomText || '');

    const pictureRect = captureAndRemoveField(form, 'picture');

    setTextField(form, '\u0e40\u0e25\u0e02\u0e17\u0e30\u0e40\u0e1a\u0e35\u0e22\u0e19\u0e1b\u0e23\u0e30\u0e08\u0e33\u0e15\u0e31\u0e27\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07', assetId);
    setTextField(form, 'Text18', assetBrand);
    setTextField(form, 'Text19', assetModel);
    setTextField(form, 'Text20', assetPurchaseDate);
    setTextField(form, 'Text21', assetSerial);
    setTextField(form, 'Text22', assetRepairCount);
    setTextField(form, 'Text23', assetReceiveDate);
    setTextField(form, 'Text24', assetCaretaker);

    setTextField(form, 'Text26', requestDate);
    setTextField(form, 'Text27', reporterName);

    stripFieldBorders(form);

    if (customFont) {
      try {
        form.updateFieldAppearances(customFont);
      } catch (error) {
        console.warn('Failed to update appearances with custom font:', error);
      }
    }

    form.flatten();
    await embedAttachments(pdfDoc, record.attachments, pictureRect);

    const pdfBytesModified = await pdfDoc.save();
    downloadPdf(pdfBytesModified, `${docNo || 'FM-IT-001'}.pdf`);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Error: ' + (error?.message || error));
  }
}
