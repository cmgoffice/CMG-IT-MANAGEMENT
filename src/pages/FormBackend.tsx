import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

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
                    <th className="px-6 py-4 font-bold">#</th>
                    <th className="px-6 py-4 font-bold">Date Submitted</th>
                    <th className="px-6 py-4 font-bold">Reporter / Submitter</th>
                    <th className="px-6 py-4 font-bold">Detail</th>
                    <th className="px-6 py-4 font-bold">Photos</th>
                    <th className="px-6 py-4 font-bold">Status</th>
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
                        <td className="px-6 py-4 text-slate-600 font-medium">{index + 1}</td>
                        <td className="px-6 py-4 text-slate-700 whitespace-nowrap">
                          {formatDate(record.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-medium">
                          {getReporterName(record)}
                        </td>
                        <td className="px-6 py-4 text-slate-700 max-w-xs truncate">
                          {getDetailText(activeTab, record)}
                        </td>
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
