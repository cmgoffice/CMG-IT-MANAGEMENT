import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { exportFM001 } from '../lib/pdfExport';

const APP_NAME = 'CMG-IT-MANAGEMENT';

interface FormRecord {
  id: string;
  [key: string]: unknown;
}

const formTabs = [
  { id: '001', label: 'FM-IT-001', collection: 'repairRequests' },
  { id: '002', label: 'FM-IT-002', collection: 'appointments' },
  { id: '003', label: 'FM-IT-003', collection: 'assetRequests' },
  { id: '004', label: 'FM-IT-004', collection: 'assetReturns' },
  { id: '005', label: 'FM-IT-005', collection: 'licenseRequests' },
  { id: '006', label: 'FM-IT-006', collection: 'userRegistrations' },
  { id: '007', label: 'FM-IT-007', collection: 'remoteSupports' },
];

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
    return `${r.name || ''}`.trim() || '-';
  }
  if (typeof data.applicantName === 'string') return data.applicantName;
  if (typeof data.requester === 'string') return data.requester;
  if (typeof data.submittedBy === 'string') return data.submittedBy;
  if (typeof data.name === 'string') return data.name;
  return '-';
}

function getDetailText(tabId: string, data: FormRecord): string {
  switch (tabId) {
    case '001': {
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
  if (!eq || typeof eq !== 'object') return '-';
  const rec = eq as Record<string, boolean | string>;
  const items = Object.entries(rec)
    .filter(([k, v]) => v === true && k !== 'otherText')
    .map(([k]) => k);
  if (rec.otherText && typeof rec.otherText === 'string') items.push(rec.otherText);
  return items.length > 0 ? items.join(', ') : '-';
}

function getSymptomsText(issue: unknown): string {
  if (!issue || typeof issue !== 'object') return '-';
  const rec = issue as Record<string, boolean | string>;
  const items = Object.entries(rec)
    .filter(([k, v]) => v === true && k !== 'detailedDescription')
    .map(([k]) => k);
  return items.length > 0 ? items.join(', ') : '-';
}

async function handleExportPDF(record: FormRecord, formLabel: string) {
  if (formLabel.includes('FM-IT-001')) {
    await exportFM001(record);
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

  const isMasterAdmin = currentUser && (
    Array.isArray(currentUser.role)
      ? currentUser.role.includes('MasterAdmin')
      : currentUser.role === 'MasterAdmin'
  );

  useEffect(() => {
    const activeForm = formTabs.find((t) => t.id === activeTab);
    if (!activeForm) return;

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

  return (
    <div className="pt-8 pb-12 px-8 min-h-screen relative z-10">
      <div className="max-w-[95%] mx-auto">
        <header className="mb-8">
          <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">Form Backend</h2>
          <p className="text-on-surface-variant font-body mt-2">Manage and review all submitted IT forms.</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {formTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#27619D] text-white shadow-md shadow-[#27619D]/30'
                  : 'bg-white/50 text-slate-600 hover:bg-white/80 border border-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table Card */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-white/60 flex items-center justify-between">
            <h3 className="font-bold text-lg text-on-surface">{activeLabel}</h3>
            <span className="text-sm text-slate-500 font-medium">{records.length} record(s)</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <span className="material-symbols-outlined animate-spin text-3xl mb-3 inline-block">progress_activity</span>
              <p className="font-medium">Loading data...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-3 inline-block">inbox</span>
              <p className="font-medium">No submissions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-bold whitespace-nowrap">#</th>
                    <th className="px-6 py-4 font-bold whitespace-nowrap">Date Submitted</th>
                    {activeTab === '001' ? (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Doc No</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Reporter Name</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Department</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Job Title</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Phone</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Email</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Equipment Category</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Symptoms</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Detailed Description</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Asset ID</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Brand</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Model</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">S/N</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Purchase Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Caretaker</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Receive Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Repair Count</th>
                      </>
                    ) : activeTab === '002' ? (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">WR Number</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Reporter Name</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Department</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Job Title</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Phone</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Appointment Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Time</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Location</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Job Details</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Prepare Tools</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Assess Equip</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Tools Prepared</th>
                      </>
                    ) : activeTab === '003' ? (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">WR Number</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Type</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Applicant Name</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Department</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Job Title</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Phone</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Date of Use</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Reason</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Eq Details</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Change: Asset ID</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Change: S/N</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Change: Prev User</th>
                      </>
                    ) : activeTab === '004' ? (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">WR Number</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Returner Name</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Department</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Job Title</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Phone</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Return Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Reason</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Asset ID</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Eq Details</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Cancel Usage: Asset ID</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Cancel Usage: Reason</th>
                      </>
                    ) : activeTab === '005' ? (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">WR Number</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Type</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Software</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Applicant Name</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Department</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Job Title</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Phone</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Reason</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">IT: Registered Prog</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">IT: Packet Details</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">IT: Start Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">IT: Expire Date</th>
                      </>
                    ) : activeTab === '006' ? (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">WR Number</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Type</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Applicant Name</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Department</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Job Title</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Phone</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Date of Use</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Reason</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Email</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Data Access Details</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">IT: Action Done</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">IT: Username</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">IT: Password</th>
                      </>
                    ) : activeTab === '007' ? (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">WR Number</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Request Date</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Equipment</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Applicant Name</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Department</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">JOB</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Phone</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Symptoms</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Requirements</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Remote Program</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Remote ID</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Appointment Time</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Reporter / Submitter</th>
                        <th className="px-6 py-4 font-bold whitespace-nowrap">Detail</th>
                      </>
                    )}
                    <th className="px-6 py-4 font-bold whitespace-nowrap">Photos</th>
                    <th className="px-6 py-4 font-bold whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 font-bold whitespace-nowrap">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record, index) => {
                    const attachments = getAttachments(record);
                    const status = (record.status as string) || 'pending';
                    const statusColor =
                      status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700';

                    return (
                      <tr key={record.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">{index + 1}</td>
                        <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                          {formatDate(record.createdAt)}
                        </td>
                        {activeTab === '001' ? (
                          <>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.docNo || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.requestDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.reporter as any)?.name || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.reporter as any)?.department || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.reporter as any)?.jobTitle || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.reporter as any)?.phone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.reporter as any)?.email || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={getEquipmentCategoryText(record.equipmentCategory)}>{getEquipmentCategoryText(record.equipmentCategory)}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={getSymptomsText(record.issueDescription)}>{getSymptomsText(record.issueDescription)}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String((record.issueDescription as any)?.detailedDescription || '-')}>{String((record.issueDescription as any)?.detailedDescription || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.assetId || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.brand || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.model || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.serialNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.purchaseDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.caretaker || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.receiveDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String((record.asset as any)?.repairCount || '-')}</td>
                          </>
                        ) : activeTab === '002' ? (
                          <>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.wrNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.requestDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.applicantName || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.department || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.jobTitle || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.phone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.appointmentDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.appointmentTime || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.location || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(record.jobDetails || '-')}>{String(record.jobDetails || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{record.prepareTools === 'true' ? 'Yes' : 'No'}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{record.assessEquipment === 'true' ? 'Yes' : 'No'}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{record.toolsPrepared === 'true' ? 'Yes' : 'No'}</td>
                          </>
                        ) : activeTab === '003' ? (
                          <>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.wrNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.requestDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                              {record.reqType_new === 'true' ? 'New Equipment' : record.reqType_change === 'true' ? 'Change User' : '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.applicantName || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.department || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.jobTitle || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.phone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.dateOfUse || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(record.reason || '-')}>{String(record.reason || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                               {[
                                  record.eqComputer === 'true' && 'Computer',
                                  record.eqPrinter === 'true' && 'Printer',
                                  record.eqCctv === 'true' && 'CCTV',
                                  record.eqRadio === 'true' && 'Radio',
                                  record.eqMonitor === 'true' && 'Monitor',
                                  record.eqOther === 'true' && 'Other'
                               ].filter(Boolean).join(', ') || '-'} {record.eqQuantity ? `(Qty: ${record.eqQuantity})` : ''}
                            </td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.assetId || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.serialNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.previousUser || '-')}</td>
                          </>
                        ) : activeTab === '004' ? (
                          <>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.wrNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.requestDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.returnerName || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.department || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.jobTitle || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.phone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.returnDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(record.reason || '-')}>{String(record.reason || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.assetId || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                               {[
                                  record.eqComputer === 'true' && 'Computer',
                                  record.eqPrinter === 'true' && 'Printer',
                                  record.eqCctv === 'true' && 'CCTV',
                                  record.eqRadio === 'true' && 'Radio',
                                  record.eqMonitor === 'true' && 'Monitor',
                                  record.eqOther === 'true' && `Other (${record.eqOtherText || ''})`
                               ].filter(Boolean).join(', ') || '-'} {record.eqQuantity ? `(Qty: ${record.eqQuantity})` : ''}
                            </td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.cancelAssetId || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(record.cancelReason || '-')}>{String(record.cancelReason || '-')}</td>
                          </>
                        ) : activeTab === '005' ? (
                          <>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.wrNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.requestDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                              {record.reqType_new === 'true' ? 'New License' : record.reqType_renew === 'true' ? 'Renew License' : '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                               {[
                                  record.sw_office === 'true' && 'Office 365+',
                                  record.sw_sketchup === 'true' && 'Sketchup 3D',
                                  record.sw_autodesk === 'true' && 'Autodesk',
                                  record.sw_adobe === 'true' && 'Adobe',
                                  record.sw_other === 'true' && `Other (${record.sw_otherText || ''})`
                               ].filter(Boolean).join(', ') || '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.applicantName || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.department || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.jobTitle || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.phone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(record.reason || '-')}>{String(record.reason || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.it_registeredProgram || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.it_packetDetails || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.it_startDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.it_expireDate || '-')}</td>
                          </>
                        ) : activeTab === '006' ? (
                          <>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.wrNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.requestDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                               {[
                                  record.req_email === 'true' && 'Email',
                                  record.req_storage === 'true' && 'Central Storage',
                                  record.req_cctv === 'true' && 'CCTV Online'
                               ].filter(Boolean).join(', ') || '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.applicantName || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.department || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.jobTitle || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.phone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.dateOfUse || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(record.reason || '-')}>{String(record.reason || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.email || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(`${record.dataAccessDetails || ''} ${record.dataAccessDetails_2 || ''}`)}>{String(`${record.dataAccessDetails || ''} ${record.dataAccessDetails_2 || ''}`).trim() || '-'}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.it_actionDone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.it_username || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                              {record.it_password ? '********' : '-'}
                            </td>
                          </>
                        ) : activeTab === '007' ? (
                          <>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.wrNumber || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.requestDate || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                               {[
                                  record.eq_computer === 'true' && 'Computer/Notebook',
                                  record.eq_printer === 'true' && 'Printer/Copier',
                                  record.eq_radio === 'true' && 'Radio Comm',
                                  record.eq_cctv === 'true' && 'CCTV',
                                  record.eq_other === 'true' && 'Other'
                               ].filter(Boolean).join(', ') || '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.applicantName || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.department || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.jobName || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.phone || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                               {[
                                  record.symp_slow === 'true' && 'Slow/Laggy',
                                  record.symp_software === 'true' && 'Install/Fix Software',
                                  record.symp_check === 'true' && 'Basic Check',
                                  record.symp_support === 'true' && 'Usage Support',
                                  record.symp_other === 'true' && 'Other'
                               ].filter(Boolean).join(', ') || '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-700 max-w-[200px] truncate" title={String(`${record.requirements || ''} ${record.requirements_2 || ''} ${record.requirements_3 || ''}`)}>{String(`${record.requirements || ''} ${record.requirements_2 || ''} ${record.requirements_3 || ''}`).trim() || '-'}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.remoteProgram || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.remoteId || '-')}</td>
                            <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{String(record.appointmentTime || '-')}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 text-slate-700 font-medium whitespace-nowrap">
                              {getReporterName(record)}
                            </td>
                            <td className="px-6 py-4 text-slate-700 max-w-xs truncate">
                              {getDetailText(activeTab, record)}
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4">
                          {attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {attachments.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-bold text-[#27619D] bg-[#C7E7FF]/40 px-3 py-1 rounded-lg hover:bg-[#C7E7FF] transition-colors"
                                >
                                  Photo {i + 1}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusColor}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => handleExportPDF(record, activeLabel)}
                            className="flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
                            title="Download / View PDF"
                          >
                            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                            Export
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormBackend;
