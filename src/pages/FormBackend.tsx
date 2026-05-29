import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, onSnapshot, Timestamp, doc, setDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { exportFM001Unified, exportFM002, exportFM003, exportFM004, exportFM005, exportFM006, exportFM007 } from '../lib/pdfExport';

const APP_NAME = 'CMG-IT-MANAGEMENT';

interface FormRecord {
  id: string;
  [key: string]: unknown;
}

interface EvaluationRecord {
  id: string;
  projectId: string;
  projectName?: string;
  evaluatorEmail?: string;
  evaluatorName: string;
  ratings: { q1: number; q2: number; q3: number; q4: number; q5: number };
  comment: string;
  submittedAt: string;
}

interface ProjectRef {
  id: string;
  name: string;
}

const formTabs = [
  { id: '001', label: 'FM-IT-001', collection: 'repairRequests' },
  { id: '002', label: 'FM-IT-002', collection: 'appointments' },
  { id: '003', label: 'FM-IT-003', collection: 'assetRequests' },
  { id: '004', label: 'FM-IT-004', collection: 'assetReturns' },
  { id: '005', label: 'FM-IT-005', collection: 'licenseRequests' },
  { id: '006', label: 'FM-IT-006', collection: 'userRegistrations' },
  { id: '007', label: 'FM-IT-007', collection: 'remoteSupports' },
  { id: 'evaluation', label: 'Evaluation', collection: '' },
];

const tabColumnsConfig: Record<string, { id: string; label: string }[]> = {
  '001': [
    { id: 'docNo', label: 'Doc No' },
    { id: 'requestDate', label: 'Request Date' },
    { id: 'reporterName', label: 'Reporter Name' },
    { id: 'department', label: 'Department' },
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'phone', label: 'Phone' },
    { id: 'email', label: 'Email' },
    { id: 'equipmentCategory', label: 'Equipment Category' },
    { id: 'symptoms', label: 'Symptoms' },
    { id: 'detailedDescription', label: 'Detailed Description' },
    { id: 'assetId', label: 'Asset ID' },
    { id: 'brand', label: 'Brand' },
    { id: 'model', label: 'Model' },
    { id: 'sn', label: 'S/N' },
    { id: 'purchaseDate', label: 'Purchase Date' },
    { id: 'caretaker', label: 'Caretaker' },
    { id: 'receiveDate', label: 'Receive Date' },
    { id: 'repairCount', label: 'Repair Count' },
  ],
  '002': [
    { id: 'wrNumber', label: 'WR Number' },
    { id: 'requestDate', label: 'Request Date' },
    { id: 'reporterName', label: 'Reporter Name' },
    { id: 'department', label: 'Department' },
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'phone', label: 'Phone' },
    { id: 'appointmentDate', label: 'Appointment Date' },
    { id: 'time', label: 'Time' },
    { id: 'location', label: 'Location' },
    { id: 'jobDetails', label: 'Job Details' },
    { id: 'prepareTools', label: 'Prepare Tools' },
    { id: 'assessEquip', label: 'Assess Equip' },
    { id: 'toolsPrepared', label: 'Tools Prepared' },
  ],
  '003': [
    { id: 'wrNumber', label: 'WR Number' },
    { id: 'requestDate', label: 'Request Date' },
    { id: 'type', label: 'Type' },
    { id: 'applicantName', label: 'Applicant Name' },
    { id: 'department', label: 'Department' },
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'phone', label: 'Phone' },
    { id: 'dateOfUse', label: 'Date of Use' },
    { id: 'reason', label: 'Reason' },
    { id: 'eqDetails', label: 'Eq Details' },
    { id: 'changeAssetId', label: 'Change: Asset ID' },
    { id: 'changeSn', label: 'Change: S/N' },
    { id: 'changePrevUser', label: 'Change: Prev User' },
  ],
  '004': [
    { id: 'wrNumber', label: 'WR Number' },
    { id: 'requestDate', label: 'Request Date' },
    { id: 'returnerName', label: 'Returner Name' },
    { id: 'department', label: 'Department' },
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'phone', label: 'Phone' },
    { id: 'returnDate', label: 'Return Date' },
    { id: 'reason', label: 'Reason' },
    { id: 'assetId', label: 'Asset ID' },
    { id: 'eqDetails', label: 'Eq Details' },
    { id: 'cancelUsageAssetId', label: 'Cancel Usage: Asset ID' },
    { id: 'cancelUsageReason', label: 'Cancel Usage: Reason' },
  ],
  '005': [
    { id: 'wrNumber', label: 'WR Number' },
    { id: 'requestDate', label: 'Request Date' },
    { id: 'requestType', label: 'Request Type' },
    { id: 'software', label: 'Software' },
    { id: 'applicantName', label: 'Applicant Name' },
    { id: 'department', label: 'Department' },
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'phone', label: 'Phone' },
    { id: 'reason', label: 'Reason' },
    { id: 'itRegisteredProg', label: 'IT: Registered Prog' },
    { id: 'itPacketDetails', label: 'IT: Packet Details' },
    { id: 'itStartDate', label: 'IT: Start Date' },
    { id: 'itExpireDate', label: 'IT: Expire Date' },
  ],
  '006': [
    { id: 'wrNumber', label: 'WR Number' },
    { id: 'requestDate', label: 'Request Date' },
    { id: 'requestType', label: 'Request Type' },
    { id: 'applicantName', label: 'Applicant Name' },
    { id: 'department', label: 'Department' },
    { id: 'jobTitle', label: 'Job Title' },
    { id: 'phone', label: 'Phone' },
    { id: 'dateOfUse', label: 'Date of Use' },
    { id: 'reason', label: 'Reason' },
    { id: 'email', label: 'Email' },
    { id: 'dataAccessDetails', label: 'Data Access Details' },
    { id: 'itActionDone', label: 'IT: Action Done' },
    { id: 'itUsername', label: 'IT: Username' },
    { id: 'itPassword', label: 'IT: Password' },
  ],
  '007': [
    { id: 'wrNumber', label: 'WR Number' },
    { id: 'requestDate', label: 'Request Date' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'applicantName', label: 'Applicant Name' },
    { id: 'department', label: 'Department' },
    { id: 'job', label: 'JOB' },
    { id: 'phone', label: 'Phone' },
    { id: 'symptoms', label: 'Symptoms' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'remoteProgram', label: 'Remote Program' },
    { id: 'remoteId', label: 'Remote ID' },
    { id: 'appointmentTime', label: 'Appointment Time' },
  ],
  'fallback': [
    { id: 'reporter', label: 'Reporter / Submitter' },
    { id: 'detail', label: 'Detail' },
  ]
};

function formatDate(ts: unknown): string {
  if (!ts) return '-';
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleString('th-TH');
  }
  if (typeof ts === 'string') {
    return new Date(ts).toLocaleString('th-TH');
  }
  return '-';
}

function getReporterName(data: FormRecord): string {
  if (typeof data.reporter === 'object' && data.reporter !== null) {
    const r = data.reporter as Record<string, string>;
    if (r.name) return `${r.name || ''}`.trim() || '-';
  }
  if (typeof data.reporterName === 'string') return data.reporterName;
  if (typeof data.applicantName === 'string') return data.applicantName;
  if (typeof data.returnerName === 'string') return data.returnerName;
  if (typeof data.requester === 'string') return data.requester;
  if (typeof data.submittedBy === 'string') return data.submittedBy;
  if (typeof data.name === 'string') return data.name;
  return '-';
}

function getDetailText(tabId: string, data: FormRecord): string {
  switch (tabId) {
    case '001': {
      if (typeof data.equipmentCategory === 'string') return data.equipmentCategory;
      const eq = data.equipmentCategory as Record<string, boolean | string> | undefined;
      if (eq) {
        const items = Object.entries(eq)
          .filter(([k, v]) => v === true && k !== 'otherText')
          .map(([k]) => k);
        if (eq.otherText && typeof eq.otherText === 'string') items.push(eq.otherText);
        return items.length > 0 ? items.join(', ') : '-';
      }
      return '-';
    }
    case '002': {
      return (data.appointmentDate as string) || (data.date as string) || (data.purpose as string) || '-';
    }
    case '003': {
      if (typeof data.equipmentCategory === 'string') return data.equipmentCategory;
      const eq = data.equipmentCategory as Record<string, boolean | string> | undefined;
      if (eq) {
        const items = Object.entries(eq)
          .filter(([k, v]) => v === true && k !== 'otherText')
          .map(([k]) => k);
        if (eq.otherText && typeof eq.otherText === 'string') items.push(eq.otherText);
        return items.length > 0 ? items.join(', ') : '-';
      }
      return (data.assetId as string) || '-';
    }
    case '004': {
      return (data.assetId as string) || (data.returnReason as string) || '-';
    }
    case '005': {
      return (data.softwareName as string) || (data.licenseType as string) || '-';
    }
    case '006': {
      return (data.newUserName as string) || (data.systemAccess as string) || '-';
    }
    case '007': {
      return (data.issueType as string) || (data.softwareName as string) || (data.supportType as string) || '-';
    }
    default:
      return '-';
  }
}

function getAttachments(data: FormRecord): string[] {
  const attachments = data.attachments;
  if (Array.isArray(attachments)) {
    return attachments.filter((a): a is string => typeof a === 'string');
  }
  return [];
}

function getEquipmentCategoryText(eq: unknown): string {
  if (!eq) return '-';
  if (typeof eq === 'string') return eq;
  if (typeof eq !== 'object') return '-';
  const rec = eq as Record<string, boolean | string>;
  const items = Object.entries(rec)
    .filter(([k, v]) => v === true && k !== 'otherText')
    .map(([k]) => k);
  if (rec.otherText && typeof rec.otherText === 'string') items.push(rec.otherText);
  return items.length > 0 ? items.join(', ') : '-';
}

function getSymptomsText(issue: unknown): string {
  if (!issue) return '-';
  if (typeof issue === 'string') return issue;
  if (typeof issue !== 'object') return '-';
  const rec = issue as Record<string, boolean | string>;
  const items = Object.entries(rec)
    .filter(([k, v]) => v === true && k !== 'detailedDescription')
    .map(([k]) => k);
  return items.length > 0 ? items.join(', ') : '-';
}

function renderCellContent(colId: string, record: any, activeTab: string): string {
  switch (colId) {
    case 'docNo': return String(record.docNo || '-');
    case 'requestDate': return String(record.requestDate || '-');
    case 'reporterName':
      return activeTab === '001' ? String(record.reporter?.name || record.reporterName || '-') : String(record.applicantName || record.reporterName || '-');
    case 'applicantName':
      return String(record.applicantName || record.reporter?.name || record.reporterName || '-');
    case 'department':
      return activeTab === '001' ? String(record.reporter?.department || record.department || '-') : String(record.department || '-');
    case 'jobTitle':
      return activeTab === '001' ? String(record.reporter?.jobTitle || record.jobTitle || '-') : String(record.jobTitle || '-');
    case 'phone':
      return activeTab === '001' ? String(record.reporter?.phone || record.phone || '-') : String(record.phone || '-');
    case 'email':
      return activeTab === '001' ? String(record.reporter?.email || record.email || '-') : String(record.email || '-');
    case 'equipmentCategory': return getEquipmentCategoryText(record.equipmentCategory);
    case 'symptoms': {
      if (activeTab === '001') return getSymptomsText(record.issueDescription || record.symptoms);
      const sympStr = [
        (record.symp_slow === 'true' || record.symp_slow === true) && 'Slow/Laggy', 
        (record.symp_software === 'true' || record.symp_software === true) && 'Install/Fix Software', 
        (record.symp_check === 'true' || record.symp_check === true) && 'Basic Check', 
        (record.symp_support === 'true' || record.symp_support === true) && 'Usage Support', 
        (record.symp_other === 'true' || record.symp_other === true) && 'Other'
      ].filter(Boolean).join(', ');
      return sympStr || String(record.symptoms || '-');
    }
    case 'detailedDescription': return String(record.issueDescription?.detailedDescription || record.detailedDescription || '-');
    case 'assetId':
      return activeTab === '001' ? String(record.asset?.assetId || record.assetId || '-') : String(record.assetId || '-');
    case 'brand': return String(record.asset?.brand || record.brand || '-');
    case 'model': return String(record.asset?.model || record.model || '-');
    case 'sn':
      return activeTab === '001' ? String(record.asset?.serialNumber || record.sn || record.serialNumber || '-') : String(record.serialNumber || record.sn || '-');
    case 'purchaseDate': return String(record.asset?.purchaseDate || record.purchaseDate || '-');
    case 'caretaker': return String(record.asset?.caretaker || record.caretaker || '-');
    case 'receiveDate': return String(record.asset?.receiveDate || record.receiveDate || '-');
    case 'repairCount': return String(record.asset?.repairCount || record.repairCount || '-');
    case 'wrNumber': return String(record.wrNumber || '-');
    case 'appointmentDate': return String(record.appointmentDate || '-');
    case 'time': return String(record.appointmentTime || record.time || '-');
    case 'location': return String(record.location || '-');
    case 'jobDetails': return String(record.jobDetails || '-');
    case 'prepareTools': return (record.prepareTools === 'true' || record.prepareTools === true || record.prepareTools === 'Yes') ? 'Yes' : record.prepareTools === 'false' || record.prepareTools === false || record.prepareTools === 'No' ? 'No' : String(record.prepareTools || 'No');
    case 'assessEquip': return (record.assessEquipment === 'true' || record.assessEquipment === true || record.assessEquip === 'true' || record.assessEquip === true || record.assessEquipment === 'Yes') ? 'Yes' : record.assessEquipment === 'false' || record.assessEquipment === false || record.assessEquip === 'false' || record.assessEquip === false || record.assessEquipment === 'No' ? 'No' : String(record.assessEquip || record.assessEquipment || 'No');
    case 'toolsPrepared': return (record.toolsPrepared === 'true' || record.toolsPrepared === true || record.toolsPrepared === 'Yes') ? 'Yes' : record.toolsPrepared === 'false' || record.toolsPrepared === false || record.toolsPrepared === 'No' ? 'No' : String(record.toolsPrepared || 'No');
    case 'type': 
      if (record.type) return String(record.type);
      return (record.reqType_new === 'true' || record.reqType_new === true) ? 'New Equipment' : (record.reqType_change === 'true' || record.reqType_change === true) ? 'Change User' : '-';
    case 'dateOfUse': return String(record.dateOfUse || '-');
    case 'reason': return String(record.reason || '-');
    case 'eqDetails': {
      if (typeof record.eqDetails === 'string' && record.eqDetails.trim() !== '') return record.eqDetails;
      const eqStr = [
        (record.eqComputer === 'true' || record.eqComputer === true) && (activeTab === '007' ? 'Computer/Notebook' : 'Computer'),
        (record.eqPrinter === 'true' || record.eqPrinter === true) && (activeTab === '007' ? 'Printer/Copier' : 'Printer'),
        (record.eqCctv === 'true' || record.eqCctv === true) && 'CCTV',
        (record.eqRadio === 'true' || record.eqRadio === true) && (activeTab === '007' ? 'Radio Comm' : 'Radio'),
        (record.eqMonitor === 'true' || record.eqMonitor === true) && 'Monitor',
        (record.eqOther === 'true' || record.eqOther === true) && (activeTab === '004' ? `Other (${record.eqOtherText || ''})` : 'Other')
      ].filter(Boolean).join(', ') || '-';
      const finalEqStr = eqStr || '-';
      return (activeTab === '003' || activeTab === '004') && record.eqQuantity ? finalEqStr + ` (Qty: ${record.eqQuantity})` : finalEqStr;
    }
    case 'changeAssetId': return String(record.changeAssetId || record.assetId || '-');
    case 'changeSn': return String(record.changeSn || record.serialNumber || '-');
    case 'changePrevUser': return String(record.changePrevUser || record.previousUser || '-');
    case 'returnerName': return String(record.returnerName || record.applicantName || '-');
    case 'returnDate': return String(record.returnDate || '-');
    case 'cancelUsageAssetId': return String(record.cancelUsageAssetId || record.cancelAssetId || '-');
    case 'cancelUsageReason': return String(record.cancelUsageReason || record.cancelReason || '-');
    case 'requestType':
      if (record.requestType) return String(record.requestType);
      if (activeTab === '005') return (record.reqType_new === 'true' || record.reqType_new === true) ? 'New License' : (record.reqType_renew === 'true' || record.reqType_renew === true) ? 'Renew License' : '-';
      return [
        (record.req_email === 'true' || record.req_email === true) && 'Email', 
        (record.req_storage === 'true' || record.req_storage === true) && 'Central Storage', 
        (record.req_cctv === 'true' || record.req_cctv === true) && 'CCTV Online'
      ].filter(Boolean).join(', ') || '-';
    case 'software':
      if (record.software) return String(record.software);
      return [(record.sw_office === 'true' || record.sw_office === true) && 'Office 365+', (record.sw_sketchup === 'true' || record.sw_sketchup === true) && 'Sketchup 3D', (record.sw_autodesk === 'true' || record.sw_autodesk === true) && 'Autodesk', (record.sw_adobe === 'true' || record.sw_adobe === true) && 'Adobe', (record.sw_other === 'true' || record.sw_other === true) && `Other (${record.sw_otherText || ''})`].filter(Boolean).join(', ') || '-';
    case 'itRegisteredProg': return String(record.itRegisteredProg || record.it_registeredProgram || '-');
    case 'itPacketDetails': return String(record.itPacketDetails || record.it_packetDetails || '-');
    case 'itStartDate': return String(record.itStartDate || record.it_startDate || '-');
    case 'itExpireDate': return String(record.itExpireDate || record.it_expireDate || '-');
    case 'dataAccessDetails': return String(record.dataAccessDetails || `${record.dataAccessDetails || ''} ${record.dataAccessDetails_2 || ''}`.trim() || '-');
    case 'itActionDone': return String(record.itActionDone || record.it_actionDone || '-');
    case 'itUsername': return String(record.itUsername || record.it_username || '-');
    case 'itPassword': return (record.itPassword || record.it_password) ? '********' : '-';
    case 'equipment':
      if (record.equipment) return String(record.equipment); 
      return [(record.eq_computer === 'true' || record.eq_computer === true) && 'Computer/Notebook', (record.eq_printer === 'true' || record.eq_printer === true) && 'Printer/Copier', (record.eq_radio === 'true' || record.eq_radio === true) && 'Radio Comm', (record.eq_cctv === 'true' || record.eq_cctv === true) && 'CCTV', (record.eq_other === 'true' || record.eq_other === true) && 'Other'].filter(Boolean).join(', ') || '-';
    case 'job': return String(record.job || record.jobName || '-');
    case 'requirements': return String(record.requirements || `${record.requirements || ''} ${record.requirements_2 || ''} ${record.requirements_3 || ''}`.trim() || '-');
    case 'remoteProgram': return String(record.remoteProgram || '-');
    case 'remoteId': return String(record.remoteId || '-');
    case 'appointmentTime': return String(record.appointmentTime || '-');
    case 'reporter': return getReporterName(record as FormRecord);
    case 'detail': return getDetailText(activeTab, record as FormRecord);
    default: return '-';
  }
}

async function handleExportPDF(record: FormRecord, formLabel: string) {
  if (formLabel.includes('FM-IT-001')) {
    await exportFM001Unified(record);
    return;
  }

  if (formLabel.includes('FM-IT-002')) {
    await exportFM002(record);
    return;
  }

  if (formLabel.includes('FM-IT-003')) {
    await exportFM003(record);
    return;
  }

  if (formLabel.includes('FM-IT-004')) {
    await exportFM004(record);
    return;
  }

  if (formLabel.includes('FM-IT-005')) {
    await exportFM005(record);
    return;
  }

  if (formLabel.includes('FM-IT-006')) {
    await exportFM006(record);
    return;
  }

  if (formLabel.includes('FM-IT-007')) {
    await exportFM007(record);
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate PDF.');
    return;
  }

  // กรองฟิลด์ที่ไม่ต้องการให้แสดงในเนื้อหาหลักออก
  const excludeKeys = ['id', 'createdAt', 'attachments', 'status', 'reporter'];
  
  const renderValue = (val: unknown): string => {
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'object' && val !== null) {
      if ('seconds' in val && 'nanoseconds' in val) return formatDate(val); // จัดการ Timestamp
      return Object.entries(val as Record<string, unknown>)
        .filter(([_, v]) => v === true || (typeof v === 'string' && v.trim() !== ''))
        .map(([k, v]) => {
          const formattedKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          return typeof v === 'boolean' ? formattedKey : String(v);
        })
        .join(', ');
    }
    return String(val || '-');
  };

  // วนลูปข้อมูลมาสร้างเป็นบรรทัด
  const dataRows = Object.entries(record)
    .filter(([key]) => !excludeKeys.includes(key))
    .map(([key, value]) => `
      <div class="row">
        <div class="label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
        <div class="value">${renderValue(value)}</div>
      </div>
    `).join('');

  const reporterName = getReporterName(record);
  const submitDate = formatDate(record.createdAt);

  // โครงสร้าง HTML สำหรับสร้างเอกสาร PDF
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${formLabel} - ${record.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap');
    body { font-family: 'Prompt', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #27619D; padding-bottom: 20px; }
    .title { font-size: 28px; font-weight: 700; color: #27619D; margin-bottom: 8px; }
    .doc-info { font-size: 14px; color: #64748b; }
    .section-title { font-size: 18px; font-weight: 600; color: #27619D; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    .row { display: flex; margin-bottom: 12px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 4px; }
    .label { font-weight: 600; width: 35%; color: #475569; }
    .value { flex: 1; color: #0f172a; word-break: break-word; }
    .footer { margin-top: 80px; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid; }
    .sign-box { width: 200px; border-top: 1px solid #475569; padding-top: 10px; margin-top: 80px; color: #475569; font-size: 14px; }
    @media print { body { padding: 0; } @page { margin: 15mm; } }
  </style>
</head>
<body>
  <div class="header">
     <div class="title">${formLabel}</div>
     <div class="doc-info">Record ID: ${record.id} &nbsp;|&nbsp; Submitted: ${submitDate}</div>
  </div>
  <div class="section-title">Requester Information</div>
  <div class="row"><div class="label">Reporter / Applicant Name</div><div class="value">${reporterName}</div></div>
  <div class="row"><div class="label">Current Status</div><div class="value">${String(record.status || 'Pending').toUpperCase()}</div></div>
  <div class="section-title">Request Details</div>
  ${dataRows}
  <div class="footer">
     <div><div class="sign-box">Requester / Applicant</div><div style="margin-top: 10px;">Date: ${submitDate.split(' ')[0]}</div></div>
     <div><div class="sign-box">IT Department Authorization</div><div style="margin-top: 10px;">Date: ____/____/______</div></div>
  </div>
  <script>
    window.onload = function() { window.print(); };
    window.onafterprint = function() { window.close(); };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

const FormBackend = () => {
  const { userProfile: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('001');
  const [records, setRecords] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [orderedColumns, setOrderedColumns] = useState<{ id: string; label: string }[]>([]);
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importTargetTab, setImportTargetTab] = useState('001');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<FormRecord | null>(null);
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [evaluationRecords, setEvaluationRecords] = useState<EvaluationRecord[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalSearchQuery, setEvalSearchQuery] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!previewImageUrl) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImageUrl(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewImageUrl]);

  const isMasterAdmin = currentUser && (
    Array.isArray(currentUser.role)
      ? currentUser.role.includes('MasterAdmin')
      : currentUser.role === 'MasterAdmin'
  );

  useEffect(() => {
    if (activeTab === 'evaluation') {
      // Load evaluations from Firestore
      const loadEvaluations = async () => {
        setEvalLoading(true);
        try {
          const [evalsSnap, projectsSnap] = await Promise.all([
            getDocs(collection(db, `${APP_NAME}/root/projectEvaluations`)),
            getDocs(collection(db, `${APP_NAME}/root/projects`)),
          ]);

          const projectMap: Record<string, string> = {};
          projectsSnap.docs.forEach((d) => {
            const data = d.data() as ProjectRef;
            projectMap[d.id] = data.name || d.id;
          });

          const evals: EvaluationRecord[] = evalsSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<EvaluationRecord, 'id'>),
            projectName: projectMap[(d.data() as EvaluationRecord).projectId] || (d.data() as EvaluationRecord).projectId,
          }));

          evals.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
          setEvaluationRecords(evals);
        } catch (err) {
          console.error('Error loading evaluations:', err);
        } finally {
          setEvalLoading(false);
        }
      };
      loadEvaluations();
      return;
    }

    const activeForm = formTabs.find((t) => t.id === activeTab);
    if (!activeForm) return;
    setStatusFilter('pending'); // Reset filter when changing tabs
    setCurrentPage(1); // Reset page when changing tabs
    setHiddenColumns(new Set()); // Reset hidden columns when changing tabs

    // Set default column order
    setOrderedColumns([
      { id: 'dateSubmitted', label: 'Date Submitted' },
      ...(tabColumnsConfig[activeTab] || tabColumnsConfig['fallback']),
      { id: 'photos', label: 'Photos' },
      { id: 'status', label: 'Status' },
      { id: 'pdf', label: 'PDF' },
      { id: 'delete', label: 'Delete' },
    ]);

    setLoading(true);
    const q = query(collection(db, `${APP_NAME}/root/${activeForm.collection}`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: FormRecord[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => {
        const ta = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      setRecords(data);
      setLoading(false);
    }, (err) => {
      console.error('Form backend snapshot error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  if (!isMasterAdmin) {
    return <Navigate to="/" replace />;
  }

  const activeLabel = formTabs.find((t) => t.id === activeTab)?.label || '';

  // Filter records based on selected status
  const filteredRecords = records.filter(record => {
    if (statusFilter === 'All') return true;
    const currentStatus = (record.status as string)?.toLowerCase() || 'pending';
    return currentStatus === statusFilter.toLowerCase();
  });

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const getAvailableFields = (tabId: string) => {
    const formFields = tabColumnsConfig[tabId] || tabColumnsConfig['fallback'];
    return [
      { id: 'id', label: 'Record ID' },
      { id: 'status', label: 'Status' },
      ...formFields
    ];
  };

  const handleDownloadTemplate = () => {
    const targetForm = formTabs.find((t) => t.id === activeTab);
    if (!targetForm) return;

    const fields = getAvailableFields(activeTab);
    // สร้าง CSV Header โดยการวนลูปเอา label ของแต่ละฟิลด์มาใส่
    const headers = fields.map(f => `"${f.label}"`).join(',');
    
    // สร้างไฟล์และดาวน์โหลด (ใช้ \uFEFF เพื่อให้รองรับภาษาไทยใน Excel)
    const blob = new Blob(['\uFEFF' + headers], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${targetForm.label}-Template.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updatePreview = (headers: string[], data: string[][], mapping: Record<string, string>) => {
    const parsedRecords: any[] = [];
    data.forEach((values, index) => {
      const record: any = {};
      let hasData = false;
      headers.forEach((header, i) => {
        const mappedField = mapping[header];
        if (mappedField) {
          let val = values[i] || '';
          if (val.toLowerCase() === 'true') record[mappedField] = true;
          else if (val.toLowerCase() === 'false') record[mappedField] = false;
          else record[mappedField] = val;
          hasData = true;
        }
      });
      if (hasData) {
        if (!record.id) record.id = `IMP-${Date.now()}-${index}`;
        if (!record.createdAt) record.createdAt = Timestamp.now();
        if (!record.status) record.status = 'pending';
        parsedRecords.push(record);
      }
    });
    setImportPreview(parsedRecords);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (csvHeaders.length > 0 && csvData.length > 0) {
      const initialMapping: Record<string, string> = {};
      const availableFields = getAvailableFields(importTargetTab);
      csvHeaders.forEach(header => {
        const match = availableFields.find(f => f.id.toLowerCase() === header.toLowerCase() || f.label.toLowerCase() === header.toLowerCase());
        if (match) {
          initialMapping[header] = match.id;
        } else {
          initialMapping[header] = '';
        }
      });
      setColumnMapping(initialMapping);
      updatePreview(csvHeaders, csvData, initialMapping);
    }
  }, [importTargetTab]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());
        
        if (lines.length < 2) {
          setImportErrors(['CSV file is empty or invalid']);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const dataLines = lines.slice(1);
        const rawData: string[][] = [];

        dataLines.forEach((line) => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                current += '"';
                i++; 
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ''));
          rawData.push(values);
        });

        setCsvHeaders(headers);
        setCsvData(rawData);

        const initialMapping: Record<string, string> = {};
        const availableFields = getAvailableFields(importTargetTab);
        headers.forEach(header => {
          const match = availableFields.find(f => f.id.toLowerCase() === header.toLowerCase() || f.label.toLowerCase() === header.toLowerCase());
          initialMapping[header] = match ? match.id : '';
        });
        setColumnMapping(initialMapping);
        updatePreview(headers, rawData, initialMapping);
        setImportErrors([]);
      } catch (error) {
        setImportErrors(['Failed to parse CSV file: ' + (error as Error).message]);
      }
    };
    reader.readAsText(file);
  };

  const handleImportRecords = async () => {
    if (importPreview.length === 0) return;
    const targetForm = formTabs.find((t) => t.id === importTargetTab);
    if (!targetForm) return;

    try {
      const promises = importPreview.map((record) => {
        const { id, ...data } = record;
        return setDoc(doc(db, `${APP_NAME}/root/${targetForm.collection}`, id), data);
      });

      await Promise.all(promises);
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview([]);
      setImportErrors([]);
      setCsvHeaders([]);
      setCsvData([]);
      setColumnMapping({});
    } catch (error) {
      setImportErrors(['Failed to import records: ' + (error as Error).message]);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) return;
    const activeForm = formTabs.find((t) => t.id === activeTab);
    if (!activeForm) return;

    try {
      await deleteDoc(doc(db, `${APP_NAME}/root/${activeForm.collection}`, recordId));
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record.');
    }
  };

  const handleDeleteAll = async () => {
    if (filteredRecords.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ALL ${filteredRecords.length} displayed records? THIS ACTION CANNOT BE UNDONE!`)) return;
    
    const activeForm = formTabs.find((t) => t.id === activeTab);
    if (!activeForm) return;

    try {
      const batch = writeBatch(db);
      filteredRecords.forEach((record) => {
        const docRef = doc(db, `${APP_NAME}/root/${activeForm.collection}`, record.id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (error) {
      console.error('Error deleting all records:', error);
      alert('Failed to delete records.');
    }
  };

  const handleEditClick = () => {
    if (!selectedRecord) return;
    const initialData: Record<string, any> = {
      status: selectedRecord.status || 'pending',
      attachments: getAttachments(selectedRecord)
    };
    tabColumnsConfig[activeTab]?.forEach(col => {
      const val = renderCellContent(col.id, selectedRecord, activeTab);
      initialData[col.id] = val === '-' ? '' : val;
    });
    setEditFormData(initialData);
    setIsEditingRecord(true);
  };

  const handleSaveRecord = async () => {
    if (!selectedRecord) return;
    setIsSavingRecord(true);
    const activeForm = formTabs.find((t) => t.id === activeTab);
    if (!activeForm) {
      setIsSavingRecord(false);
      return;
    }

    try {
      const docRef = doc(db, `${APP_NAME}/root/${activeForm.collection}`, selectedRecord.id);
      // บันทึกการแก้ไขแบบ Merge เพื่อไม่ให้กระทบฟิลด์อื่นๆ ที่อาจจะซ่อนอยู่ (เช่น รูปภาพ)
      await setDoc(docRef, editFormData, { merge: true });
      
      // อัปเดตข้อมูลที่แสดงบน Modal ทันที
      setSelectedRecord({ ...selectedRecord, ...editFormData });
      setIsEditingRecord(false);
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Failed to update record.');
    } finally {
      setIsSavingRecord(false);
    }
  };

  return (
    <div className="pt-8 pb-12 px-8 min-h-screen relative z-10">
      <div className="max-w-[95%] mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">Form Backend</h2>
            <p className="text-on-surface-variant font-body mt-2">Manage and review all submitted IT forms.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteAll}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete All Displayed Records"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              Delete All
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 bg-white text-[#27619d] px-4 py-2 rounded-lg font-semibold text-sm border border-[#27619d]/20 hover:bg-slate-50 transition-colors shadow-sm"
              title="Download CSV Template"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Template
            </button>
            <button
              onClick={() => {
                setImportTargetTab(activeTab);
                setShowImportModal(true);
              }}
              className="flex items-center gap-2 bg-[#625983] text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity"
              title="Import CSV"
            >
              <span className="material-symbols-outlined text-sm">upload</span>
              Import CSV
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {formTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? tab.id === 'evaluation'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-400/30'
                    : 'bg-[#27619D] text-white shadow-md shadow-[#27619D]/30'
                  : tab.id === 'evaluation'
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {tab.id === 'evaluation' && (
                <span className="material-symbols-outlined text-sm align-middle mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ====== Evaluation Tab Content ====== */}
        {activeTab === 'evaluation' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                <h3 className="font-bold text-lg text-on-surface">Project Evaluation</h3>
                <span className="text-sm text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  {evaluationRecords.filter(e => !evalSearchQuery || e.projectName?.toLowerCase().includes(evalSearchQuery.toLowerCase()) || e.evaluatorName?.toLowerCase().includes(evalSearchQuery.toLowerCase())).length} record(s)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input
                    type="text"
                    placeholder="ค้นหาโปรเจ็ค หรือผู้ประเมิน..."
                    value={evalSearchQuery}
                    onChange={(e) => setEvalSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm w-64"
                  />
                </div>
                <button
                  onClick={() => {
                    setEvalLoading(true);
                    const loadEvals = async () => {
                      try {
                        const [evalsSnap, projectsSnap] = await Promise.all([
                          getDocs(collection(db, `${APP_NAME}/root/projectEvaluations`)),
                          getDocs(collection(db, `${APP_NAME}/root/projects`)),
                        ]);
                        const projectMap: Record<string, string> = {};
                        projectsSnap.docs.forEach((d) => { projectMap[d.id] = (d.data() as ProjectRef).name || d.id; });
                        const evals: EvaluationRecord[] = evalsSnap.docs.map((d) => ({
                          id: d.id,
                          ...(d.data() as Omit<EvaluationRecord, 'id'>),
                          projectName: projectMap[(d.data() as EvaluationRecord).projectId] || (d.data() as EvaluationRecord).projectId,
                        }));
                        evals.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
                        setEvaluationRecords(evals);
                      } finally { setEvalLoading(false); }
                    };
                    loadEvals();
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Refresh
                </button>
              </div>
            </div>

            {evalLoading ? (
              <div className="p-12 text-center text-slate-500">
                <span className="material-symbols-outlined animate-spin text-3xl mb-3 inline-block">progress_activity</span>
                <p className="font-medium">Loading evaluations...</p>
              </div>
            ) : (() => {
              const filtered = evaluationRecords.filter(e =>
                !evalSearchQuery ||
                e.projectName?.toLowerCase().includes(evalSearchQuery.toLowerCase()) ||
                e.evaluatorName?.toLowerCase().includes(evalSearchQuery.toLowerCase())
              );
              if (filtered.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-3 inline-block" style={{ fontVariationSettings: "'FILL' 1" }}>star_border</span>
                    <p className="font-medium">{evalSearchQuery ? 'ไม่พบผลการค้นหา' : 'ยังไม่มีการประเมิน'}</p>
                  </div>
                );
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                        <th className="px-3 py-2 font-bold whitespace-nowrap">#</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Project</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Evaluator</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Score (Avg)</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Q1</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Q2</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Q3</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Q4</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">Q5</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">วันที่ประเมิน</th>
                        <th className="px-3 py-2 font-bold whitespace-nowrap">คำแนะนำ / ความคิดเห็น</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((ev, idx) => {
                        const avg = ev.ratings ? ((ev.ratings.q1 + ev.ratings.q2 + ev.ratings.q3 + ev.ratings.q4 + ev.ratings.q5) / 5) : 0;
                        const avgDisplay = avg.toFixed(1);
                        const pct = Math.round((avg / 5) * 100);
                        const scoreColor = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-[#27619d]' : pct >= 40 ? 'text-amber-600' : 'text-rose-600';
                        const scoreBg = pct >= 80 ? 'bg-emerald-50 border-emerald-200' : pct >= 60 ? 'bg-blue-50 border-blue-200' : pct >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
                        const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-[#27619d]' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-500';
                        const renderStarScore = (score: number) => (
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <span key={s} className={`material-symbols-outlined text-sm ${s <= score ? 'text-amber-400' : 'text-slate-200'}`} style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            ))}
                            <span className="text-xs font-bold text-slate-500 ml-1 leading-none">{score}</span>
                          </div>
                        );
                        return (
                          <tr key={ev.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-3 py-1.5 text-slate-500 font-medium whitespace-nowrap">{idx + 1}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <div className="font-bold text-slate-800 text-sm leading-tight">{ev.projectName || ev.projectId}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 leading-tight">{ev.projectId}</div>
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <div className="font-medium text-slate-700 text-sm leading-tight">{ev.evaluatorName}</div>
                              {ev.evaluatorEmail && <div className="text-[10px] text-slate-400 leading-tight">{ev.evaluatorEmail}</div>}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <div className={`inline-flex flex-col items-center px-2 py-0.5 rounded-lg border ${scoreBg}`}>
                                <span className={`text-base font-extrabold leading-tight ${scoreColor}`}>{avgDisplay}</span>
                                <div className="w-16 bg-slate-200 rounded-full h-1 overflow-hidden my-0.5">
                                  <div className={`${barColor} h-1 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className={`text-[9px] font-bold leading-tight ${scoreColor}`}>{pct}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5">{renderStarScore(ev.ratings?.q1 || 0)}</td>
                            <td className="px-3 py-1.5">{renderStarScore(ev.ratings?.q2 || 0)}</td>
                            <td className="px-3 py-1.5">{renderStarScore(ev.ratings?.q3 || 0)}</td>
                            <td className="px-3 py-1.5">{renderStarScore(ev.ratings?.q4 || 0)}</td>
                            <td className="px-3 py-1.5">{renderStarScore(ev.ratings?.q5 || 0)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-slate-600 text-sm">
                              {ev.submittedAt ? new Date(ev.submittedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                            </td>
                            <td className="px-3 py-1.5">
                              {ev.comment ? (
                                <div className="max-w-[260px]">
                                  <p className="text-xs text-slate-700 leading-tight line-clamp-2 whitespace-pre-wrap" title={ev.comment}>{ev.comment}</p>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">ไม่มีความคิดเห็น</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* Table Card */}
        {activeTab !== 'evaluation' && <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-lg text-on-surface">{activeLabel}</h3>
              <span className="text-sm text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">{filteredRecords.length} record(s)</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Column Visibility Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">view_column</span>
                  Columns
                </button>
                
                {showColumnDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 max-h-[60vh] overflow-y-auto">
                    <div className="px-4 pb-2 mb-2 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                      <span className="text-xs font-bold text-slate-400 uppercase">Visible Columns</span>
                      <button onClick={() => setHiddenColumns(new Set())} className="text-xs text-[#27619D] hover:underline font-medium">Reset</button>
                    </div>
                    {orderedColumns.map((col, index) => (
                      <div 
                        key={col.id} 
                        draggable
                        onDragStart={(e) => {
                          setDraggedColIndex(index);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnter={() => setDragOverColIndex(index)}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                        onDrop={() => {
                          if (draggedColIndex !== null && dragOverColIndex !== null && draggedColIndex !== dragOverColIndex) {
                            setOrderedColumns(prev => {
                              const next = [...prev];
                              const [moved] = next.splice(draggedColIndex, 1);
                              next.splice(dragOverColIndex, 0, moved);
                              return next;
                            });
                          }
                          setDraggedColIndex(null);
                          setDragOverColIndex(null);
                        }}
                        onDragEnd={() => { setDraggedColIndex(null); setDragOverColIndex(null); }}
                        className={`flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-move transition-all ${draggedColIndex === index ? 'opacity-30 bg-slate-100' : ''} ${dragOverColIndex === index && draggedColIndex !== null && draggedColIndex !== index ? (index > draggedColIndex ? 'border-b-2 border-b-[#27619D]' : 'border-t-2 border-t-[#27619D]') : 'border-y-2 border-y-transparent'}`}
                      >
                        <span className="material-symbols-outlined text-slate-400 text-sm active:cursor-grabbing">drag_indicator</span>
                        <label className="flex items-center gap-3 flex-1 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!hiddenColumns.has(col.id)}
                            onChange={() => {
                              setHiddenColumns(prev => {
                                const next = new Set(prev);
                                if (next.has(col.id)) next.delete(col.id);
                                else next.add(col.id);
                                return next;
                              });
                            }}
                            className="rounded border-slate-300 text-[#27619D] focus:ring-[#27619D]"
                          />
                          <span className="text-sm text-slate-700 select-none">{col.label}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-slate-500">Status:</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#27619D] shadow-sm cursor-pointer"
                >
                  <option value="All">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <span className="material-symbols-outlined animate-spin text-3xl mb-3 inline-block">progress_activity</span>
              <p className="font-medium">Loading data...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-3 inline-block">inbox</span>
              <p className="font-medium">{records.length > 0 ? 'No records match the selected status.' : 'No submissions yet.'}</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider border-b border-slate-200">
                    <th className="px-6 py-4 font-bold whitespace-nowrap">#</th>
                    {orderedColumns.map(col => (
                      !hiddenColumns.has(col.id) && <th key={col.id} className="px-6 py-4 font-bold whitespace-nowrap">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map((record, pageIndex) => {
                    const index = (currentPage - 1) * pageSize + pageIndex;
                    const attachments = getAttachments(record);
                    const status = (record.status as string) || 'pending';
                    const statusColor =
                      status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700';

                    return (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedRecord(record)}>
                        <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{index + 1}</td>
                        {orderedColumns.map(col => {
                          if (hiddenColumns.has(col.id)) return null;

                          let cellContent: React.ReactNode;
                          let isComponent = false;

                          if (col.id === 'dateSubmitted') {
                            cellContent = formatDate(record.createdAt);
                          } else if (col.id === 'photos') {
                            isComponent = true;
                            cellContent = attachments.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {attachments.map((url, i) => (
                                  <div
                                    key={i}
                                    onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(url); }}
                                    className="relative w-12 h-12 rounded-lg overflow-hidden cursor-pointer border border-slate-200 hover:ring-2 hover:ring-[#27619D] hover:shadow-md transition-all group shrink-0 bg-slate-100"
                                    title={`View Photo ${i + 1}`}
                                  >
                                    <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                  </div>
                                ))}
                              </div>
                            ) : <span className="text-slate-400 text-sm">-</span>;
                          } else if (col.id === 'status') {
                            isComponent = true;
                            cellContent = <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>{status}</span>;
                          } else if (col.id === 'pdf') {
                            isComponent = true;
                            cellContent = (
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleExportPDF(record, activeLabel); }} className="flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors shadow-sm" title="Download / View PDF">
                                <span className="material-symbols-outlined text-base">picture_as_pdf</span> Export
                              </button>
                            );
                          } else if (col.id === 'delete') {
                            isComponent = true;
                            cellContent = (
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteRecord(record.id); }} className="flex items-center gap-1 text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm" title="Delete Record">
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            );
                          } else {
                            cellContent = renderCellContent(col.id, record, activeTab);
                          }

                          const isTruncate = ['equipmentCategory', 'symptoms', 'detailedDescription', 'jobDetails', 'reason', 'cancelUsageReason', 'dataAccessDetails', 'requirements', 'detail'].includes(col.id);
                          const isReporter = col.id === 'reporter';

                          return (
                            <td key={col.id} className={`px-6 py-4 ${isComponent ? '' : 'text-slate-700'}`}>
                              {isComponent ? cellContent : (
                                <div className={`${isTruncate ? 'max-w-[200px] truncate' : 'whitespace-nowrap'} ${isReporter ? 'font-medium' : ''}`} title={isTruncate ? String(cellContent) : undefined}>
                                  {cellContent as React.ReactNode}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
              <div className="text-sm text-slate-500 font-medium">
                Showing {filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} records
              </div>
              <div className="flex gap-2">
                <button
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-slate-400 font-medium">...</span>
                  ) : (
                    <button
                      key={index}
                      onClick={() => setCurrentPage(page as number)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors shadow-sm ${
                        currentPage === page
                          ? 'bg-[#27619d] text-white border-[#27619d]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
                <button
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
            </>
          )}
        </div>}
      </div>

      {previewImageUrl && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99998 }}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setPreviewImageUrl(null)} />
          <div className="relative w-full max-w-5xl">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 bg-black/60 px-5 py-4">
                <h2 className="text-base font-bold text-white">Photo Preview</h2>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                  aria-label="Close preview"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div className="flex max-h-[75vh] items-center justify-center bg-black p-4">
                <img src={previewImageUrl} alt="Preview" className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-black/60 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="min-w-[140px] rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20"
                >
                  Cancel
                </button>
                <a
                  href={previewImageUrl}
                  download
                  className="min-w-[140px] rounded-xl bg-[#27619D] px-6 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#1f4f80]"
                >
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showImportModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-[#2c3437]/20 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[90vw] p-8 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Import Records to {formTabs.find(t => t.id === importTargetTab)?.label}</h2>
              <button onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview([]);
                setImportErrors([]);
                setCsvHeaders([]);
                setCsvData([]);
                setColumnMapping({});
              }} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-blue-600 text-xl">info</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-blue-900 mb-2 text-sm">CSV Format Requirements:</h3>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>First row must contain headers. You can map them to the database fields below.</li>
                      <li>Data will be imported into the selected form (<strong className="font-bold">{formTabs.find(t => t.id === importTargetTab)?.label}</strong>).</li>
                      <li>If <code className="bg-blue-100 px-1 rounded">id</code> column is omitted, a unique ID will be auto-generated.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Target Form:</label>
                <select
                  value={importTargetTab}
                  onChange={(e) => setImportTargetTab(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#27619D] font-medium text-slate-700 cursor-pointer shadow-sm"
                >
                  {formTabs.map(tab => (
                    <option key={tab.id} value={tab.id}>{tab.label}</option>
                  ))}
                </select>
              </div>

              <label className="block">
                <div className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-[#27619d] border-dashed rounded-xl appearance-none cursor-pointer hover:bg-slate-50 focus:outline-none">
                  <div className="flex flex-col items-center space-y-2">
                    <span className="material-symbols-outlined text-4xl text-[#27619d]">upload_file</span>
                    <span className="font-medium text-[#27619d]">
                      {importFile ? importFile.name : 'Click to select CSV file or drag and drop'}
                    </span>
                    <span className="text-xs text-slate-500">CSV files only</span>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </label>
            </div>

            {csvHeaders.length > 0 && (
              <div className="mb-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#27619d]">schema</span>
                  Map CSV Columns to Database Fields
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {csvHeaders.map(header => (
                    <div key={header} className="flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold text-slate-500 truncate" title={header}>{header}</span>
                      <select
                        value={columnMapping[header] || ''}
                        onChange={(e) => {
                          const newMapping = { ...columnMapping, [header]: e.target.value };
                          setColumnMapping(newMapping);
                          updatePreview(csvHeaders, csvData, newMapping);
                        }}
                        className="w-full px-2 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#27619D] focus:border-[#27619D] outline-none cursor-pointer"
                      >
                        <option value="">-- Ignore Column --</option>
                        {getAvailableFields(importTargetTab).map(field => (
                          <option key={field.id} value={field.id}>{field.label} ({field.id})</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importErrors.length > 0 && (
              <div className="mb-6 bg-red-50 border-red-200 border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-600 text-xl">error</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 mb-2 text-sm">Import Errors:</h3>
                    <ul className="text-xs text-red-800 space-y-1">
                      {importErrors.map((err, index) => (
                        <li key={index}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-slate-800 mb-3 text-sm">Preview ({importPreview.length} records)</h3>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr>
                        {Object.keys(importPreview[0]).slice(0, 6).map((key) => (
                          <th key={key} className="px-3 py-2 font-bold text-slate-600">{key}</th>
                        ))}
                        {Object.keys(importPreview[0]).length > 6 && (
                          <th className="px-3 py-2 font-bold text-slate-600">...</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importPreview.slice(0, 100).map((record, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          {Object.values(record).slice(0, 6).map((val: any, i) => (
                            <td key={i} className="px-3 py-2 truncate max-w-[150px]">{String(val)}</td>
                          ))}
                          {Object.keys(record).length > 6 && (
                            <td className="px-3 py-2 text-slate-400">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 100 && (
                     <div className="px-3 py-2 text-center text-slate-500 bg-slate-50 border-t border-slate-100">
                       Showing first 100 records
                     </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview([]);
                  setImportErrors([]);
                  setCsvHeaders([]);
                  setCsvData([]);
                  setColumnMapping({});
                }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportRecords}
                disabled={importPreview.length === 0 || importErrors.length > 0}
                className="flex-1 py-3 rounded-xl bg-[#625983] text-white font-bold text-sm shadow-lg shadow-[#625983]/20 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {importPreview.length} Records
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedRecord && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99990 }}>
          <div className="absolute inset-0 bg-[#2c3437]/40 backdrop-blur-sm" onClick={() => { setSelectedRecord(null); setIsEditingRecord(false); }} />
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">Record Details</h2>
                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-wider">{selectedRecord.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingRecord && (
                  <button onClick={handleEditClick} className="flex items-center gap-1 px-4 py-2 bg-slate-100 text-[#27619d] rounded-xl hover:bg-slate-200 transition-colors text-sm font-bold shadow-sm">
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit
                  </button>
                )}
                <button onClick={() => { setSelectedRecord(null); setIsEditingRecord(false); }} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-slate-500">close</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
              <div className="col-span-full sm:col-span-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date Submitted</label>
                <div className="text-sm font-medium text-slate-800">{formatDate(selectedRecord.createdAt)}</div>
              </div>
              <div className="col-span-full sm:col-span-1">
                 <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                 {isEditingRecord ? (
                    <select 
                      value={editFormData.status || 'pending'}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#27619D] outline-none cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                 ) : (
                   <div className="text-sm font-bold capitalize text-slate-800">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${(selectedRecord.status as string) === 'approved' ? 'bg-green-100 text-green-700' : (selectedRecord.status as string) === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {(selectedRecord.status as string) || 'Pending'}
                      </span>
                   </div>
                 )}
              </div>
      
              {tabColumnsConfig[activeTab]?.map(col => {
                const isLongText = ['detailedDescription', 'jobDetails', 'reason', 'cancelUsageReason', 'dataAccessDetails', 'requirements', 'detail'].includes(col.id);
                return (
                  <div key={col.id} className={`${isLongText ? 'col-span-full' : 'col-span-full sm:col-span-1'}`}>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{col.label}</label>
                    {isEditingRecord ? (
                      isLongText ? (
                        <textarea 
                          value={editFormData[col.id] || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, [col.id]: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#27619D] outline-none resize-none"
                        />
                      ) : (
                        <input 
                          type="text"
                          value={editFormData[col.id] || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, [col.id]: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#27619D] outline-none"
                        />
                      )
                    ) : (
                      <div className="text-sm font-medium text-slate-800 whitespace-pre-wrap">
                        {renderCellContent(col.id, selectedRecord, activeTab) || '-'}
                      </div>
                    )}
                  </div>
                );
              })}

              {(() => {
                const attachments = isEditingRecord 
                  ? (editFormData.attachments || []) 
                  : getAttachments(selectedRecord);
                
                if (attachments.length === 0 && !isEditingRecord) return null;
                
                return (
                  <div className="col-span-full mt-2 border-t border-slate-100 pt-5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">photo_library</span>
                      Attached Photos ({attachments.length})
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {attachments.map((url: string, i: number) => (
                        <div
                          key={i}
                          onClick={(e) => { 
                            if (!isEditingRecord) {
                              e.stopPropagation(); 
                              setPreviewImageUrl(url); 
                            }
                          }}
                          className={`relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 ${!isEditingRecord ? 'cursor-pointer hover:ring-2 hover:ring-[#27619D] hover:shadow-md transition-all group' : ''}`}
                          title={!isEditingRecord ? `View Photo ${i + 1}` : ''}
                        >
                          <img src={url} alt={`Attachment ${i + 1}`} className={`w-full h-full object-cover ${!isEditingRecord ? 'group-hover:scale-110 transition-transform duration-300' : ''}`} />
                          {!isEditingRecord && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity">zoom_in</span>
                            </div>
                          )}
                          {isEditingRecord && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditFormData((prev) => ({
                                  ...prev,
                                  attachments: (prev.attachments || []).filter((_: string, index: number) => index !== i)
                                }));
                              }}
                              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center transition-all shadow-md z-10"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          )}
                        </div>
                      ))}
                      
                      {isEditingRecord && (
                        <label className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-[#27619D] transition-colors text-slate-400 hover:text-[#27619D]">
                          <span className="material-symbols-outlined">add_photo_alternate</span>
                          <span className="text-[10px] font-bold mt-1">Add Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (!files) return;
                              Array.from(files).forEach((file) => {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const base64 = event.target?.result as string;
                                  setEditFormData((prev) => ({
                                    ...prev,
                                    attachments: [...(prev.attachments || []), base64]
                                  }));
                                };
                                reader.readAsDataURL(file);
                              });
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {isEditingRecord && (
              <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditingRecord(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-sm"
                  disabled={isSavingRecord}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRecord}
                  disabled={isSavingRecord}
                  className="px-5 py-2.5 rounded-xl font-bold bg-[#27619D] text-white hover:bg-[#1e4d7a] transition-colors shadow-lg shadow-[#27619D]/20 text-sm flex items-center gap-2"
                >
                  {isSavingRecord && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FormBackend;
