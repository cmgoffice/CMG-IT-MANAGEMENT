import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/firebase';
import { ROOT_COLLECTION, ROOT_DOCUMENT } from '../lib/db';

type LicenseView = 'licenseSoftwareIso' | 'office365Registry';
type AutodeskModalMode = 'add' | 'renew' | null;
type OfficeModalMode = 'add' | 'edit' | 'renew' | null;

type WorkbookRow = {
  values: string[];
};

type WorkbookSheet = {
  name: string;
  headerRow: number;
  prefaceRows: string[][];
  headers: string[];
  rows: WorkbookRow[];
};

type WorkbookData = {
  sourceFileName: string;
  sourceLastWriteTime: string;
  syncedAt: string;
  sheets: WorkbookSheet[];
};

type OfficeLicenseRecord = {
  id: string;
  name: string;
  email: string;
  packet: string;
  keyValue: string;
  endDate: string;
  color?: string;
  renewedFromId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type OfficeLicenseHistoryItem = {
  id: string;
  name: string;
  email: string;
  packet: string;
  keyValue: string;
  endDate: string;
  color: string;
  sourceLabel: string;
  isSuperseded?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type OfficeLicenseItem = {
  id: string;
  recordId?: string;
  name: string;
  email: string;
  packet: string;
  keyValue: string;
  endDate: string;
  userCount: number;
  color: string;
  sourceType: 'sheet' | 'manual';
};

type Office365GroupMember = {
  name: string;
  email: string;
};

type Office365PrimaryUser = {
  id: string;
  row: number;
  name: string;
  email: string;
  totalUsers: string;
  remainingUsers: string;
  price: string;
  storage: string;
  startDate: string;
  endDate: string;
  remainingDays: string;
  keyValue: string;
  packet: string;
  color: string;
};

type Office365Group = {
  color: string;
  members: Office365GroupMember[];
};

type Office365DetailData = {
  sourceFileName: string;
  generatedAt: string;
  primaryUsers: Office365PrimaryUser[];
  groups: Office365Group[];
};

type AutodeskLicenseRecord = {
  id: string;
  packet: string;
  contract: string;
  subscriptionId: string;
  term: string;
  manage: string;
  user: string;
  startDate: string;
  endDate: string;
  company: string;
  vendor: string;
  sale: string;
  tel: string;
  sourceType: 'excel' | 'renew';
  sourceLabel: string;
  renewedFromId?: string;
  createdAt?: string;
};

type AutodeskRenewRecord = Omit<AutodeskLicenseRecord, 'sourceType' | 'sourceLabel'> & {
  renewedFromId?: string;
  createdAt?: string;
};

type AutodeskPdfFile = {
  name: string;
  url: string;
  path?: string;
  uploadedAt?: string;
};

type AutodeskPdfUploadMode = 'append' | 'replace';

type AutodeskPdfRecord = {
  id: string;
  recordId: string;
  packet: string;
  files: AutodeskPdfFile[];
  updatedAt?: string;
};

type AutodeskLicenseGroup = {
  packet: string;
  records: AutodeskLicenseRecord[];
  currentRecords: AutodeskLicenseRecord[];
  activeCount: number;
  warningCount: number;
  expiredCount: number;
};

const AUTODESK_RENEWAL_COLLECTION = 'licenseAutodeskRenewals';
const AUTODESK_PDF_COLLECTION = 'licenseAutodeskPdfAssets';
const OFFICE_LICENSE_COLLECTION = 'licenseMicrosoft365';
const EXPIRING_SOON_DAYS = 30;

const topButtonBase =
  'inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all font-body';

const normalizePacket = (value: string) => value.trim().toLowerCase();
const normalizeHeader = (value: string) => value.trim().toLowerCase();

const findColumnIndex = (headers: string[], candidates: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) => candidates.some((candidate) => normalizeHeader(candidate) === header));
};

const normalizeAutodeskPacket = (value: string) => {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();

  if (!trimmed) return '';
  if (normalized.includes('autodesk aec')) return 'Autodesk AEC';
  if (normalized.includes('specialized toolsets') || normalized.includes('autocad full')) return 'AutoCAD FULL';
  if (normalized.includes('autocad revit lt suite')) return 'AutoCAD Revit LT Suite';
  return trimmed;
};

const buildOfficeLicenseId = (name: string, email: string) => {
  const normalized = `${normalizePacket(name)}__${normalizePacket(email)}`.replace(/^__|__$/g, '');
  return normalized ? encodeURIComponent(normalized) : `license-${Date.now()}`;
};

const isSameOfficeIdentity = (
  leftName: string,
  leftEmail: string,
  rightName: string,
  rightEmail: string,
) => normalizePacket(leftName) === normalizePacket(rightName) && normalizePacket(leftEmail) === normalizePacket(rightEmail);

const formatDisplayDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '-';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('en-GB');
};

const toInputDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const getRecordSortTime = (record: { updatedAt?: string; createdAt?: string; endDate?: string }) => {
  const candidate = record.updatedAt || record.createdAt || record.endDate || '';
  const parsed = parseDateValue(candidate);
  return parsed ? parsed.getTime() : 0;
};

const parseDateValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getLicenseStatus = (endDate: string) => {
  const parsed = parseDateValue(endDate);
  if (!parsed) {
    return {
      key: 'warning' as const,
      label: 'No end date',
      dotClassName: 'bg-[#f59e0b]',
      rowClassName: 'bg-[#fff4e5]/95 text-[#9a5a00]',
    };
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfEndDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.ceil((startOfEndDate.getTime() - startOfToday.getTime()) / 86400000);

  if (diffDays < 0) {
    return {
      key: 'expired' as const,
      label: 'Expired',
      dotClassName: 'bg-[#dc2626]',
      rowClassName: 'bg-[#ffe7e7]/95 text-[#8f1f1f]',
    };
  }

  if (diffDays <= EXPIRING_SOON_DAYS) {
    return {
      key: 'warning' as const,
      label: 'Expiring soon',
      dotClassName: 'bg-[#f59e0b]',
      rowClassName: 'bg-[#fff4e5]/95 text-[#9a5a00]',
    };
  }

  return {
    key: 'active' as const,
    label: 'Active',
    dotClassName: 'bg-[#16a34a]',
    rowClassName: '',
  };
};

const getAutodeskSheetRows = (sheet: WorkbookSheet) => {
  if (sheet.name === 'AutoCAD Revit LT Suite' && sheet.prefaceRows.length > 0) {
    return {
      headers: sheet.prefaceRows[0],
      rows: [...sheet.prefaceRows.slice(1), sheet.headers, ...sheet.rows.map((row) => row.values)],
    };
  }

  return {
    headers: sheet.headers,
    rows: sheet.rows.map((row) => row.values),
  };
};

const buildAutodeskRecordKey = (record: Pick<AutodeskLicenseRecord, 'packet' | 'contract' | 'subscriptionId' | 'user'>) => {
  const packet = normalizeAutodeskPacket(record.packet);
  const contract = record.contract.trim().toLowerCase();
  const subscriptionId = record.subscriptionId.trim().toLowerCase();
  const user = record.user.trim().toLowerCase();

  if (!packet || !user || (!contract && !subscriptionId)) return '';
  return [packet, contract, subscriptionId, user].join('|');
};

const isAutodeskRenewedRecord = (record: Pick<AutodeskLicenseRecord, 'sourceType' | 'renewedFromId'>) => (
  record.sourceType === 'renew' && Boolean(record.renewedFromId)
);

const buildAutodeskRecords = (workbook: WorkbookData | null, renewRecords: AutodeskRenewRecord[]) => {
  const records: AutodeskLicenseRecord[] = [];

  workbook?.sheets
    .filter((sheet) => sheet.name === 'AutoCAD Revit LT Suite (2)')
    .forEach((sheet) => {
      const { headers, rows } = getAutodeskSheetRows(sheet);
      const packetIndex = findColumnIndex(headers, ['Packet', 'à¹€à¸˜ÂŠà¹€à¸˜à¸—à¹€à¸™Âˆà¹€à¸˜à¸à¹€à¸™Â‚à¹€à¸˜Â›à¹€à¸˜à¸ƒà¹€à¸™Âà¹€à¸˜Âà¹€à¸˜à¸ƒà¹€à¸˜à¸']);
      const contractIndex = findColumnIndex(headers, ['Contract']);
      const subscriptionIndex = findColumnIndex(headers, ['Subscription ID']);
      const termIndex = findColumnIndex(headers, ['term']);
      const manageIndex = findColumnIndex(headers, ['Manage', 'à¹€à¸˜Âœà¹€à¸˜à¸™à¹€à¸™Â‰à¹€à¸˜Âà¹€à¸˜à¸“à¹€à¸˜à¸‹à¹€à¸˜Â™à¹€à¸˜â€à¹€à¸˜à¸Šà¹€à¸˜à¸”à¹€à¸˜â€”à¹€à¸˜Â˜à¹€à¸™ÂŒ']);
      const userIndex = findColumnIndex(headers, ['User', 'à¹€à¸˜Âœà¹€à¸˜à¸™à¹€à¸™Â‰à¹€à¸˜â€“à¹€à¸˜à¸—à¹€à¸˜à¸à¹€à¸˜à¸…à¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸™â‚¬à¹€à¸˜Â‹à¹€à¸™Â‰à¹€à¸˜Â™']);
      const startIndex = findColumnIndex(headers, ['Start', 'à¹€à¸˜à¸‡à¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜â€”à¹€à¸˜à¸•à¹€à¸™Âˆà¹€à¸™â‚¬à¹€à¸˜à¸ƒà¹€à¸˜à¸”à¹€à¸™Âˆà¹€à¸˜à¸']);
      const endIndex = findColumnIndex(headers, ['End', 'à¹€à¸˜à¸Šà¹€à¸˜à¸”à¹€à¸™Â‰à¹€à¸˜Â™à¹€à¸˜à¸Šà¹€à¸˜à¸˜à¹€à¸˜â€']);
      const companyIndex = findColumnIndex(headers, ['Company', 'à¹€à¸˜Âšà¹€à¸˜à¸ƒà¹€à¸˜à¸”à¹€à¸˜à¸‰à¹€à¸˜à¸‘à¹€à¸˜â€”à¹€à¸™Âƒà¹€à¸˜ÂŠà¹€à¸™Â‰à¹€à¸˜Â‡à¹€à¸˜à¸’à¹€à¸˜Â™']);
      const vendorIndex = findColumnIndex(headers, ['Vender', 'à¹€à¸˜Âšà¹€à¸˜à¸ƒà¹€à¸˜à¸”à¹€à¸˜à¸‰à¹€à¸˜à¸‘à¹€à¸˜â€”à¹€à¸˜â€”à¹€à¸˜à¸•à¹€à¸™Âˆà¹€à¸˜Â‚à¹€à¸˜à¸’à¹€à¸˜à¸‚']);
      const saleIndex = findColumnIndex(headers, ['Sale', 'à¹€à¸˜Âœà¹€à¸˜à¸™à¹€à¸™Â‰à¹€à¸˜Â‚à¹€à¸˜à¸’à¹€à¸˜à¸‚']);
      const telIndex = findColumnIndex(headers, ['Tel.', 'à¹€à¸™â‚¬à¹€à¸˜Âšà¹€à¸˜à¸à¹€à¸™Â‚à¹€à¸˜â€”à¹€à¸˜à¸ƒà¹€à¸˜à¸ˆà¹€à¸˜à¸‘à¹€à¸˜Âžà¹€à¸˜â€”à¹€à¸™ÂŒ']);

      rows.forEach((row, rowIndex) => {
        const rawPacket = packetIndex >= 0 ? row[packetIndex] || '' : '';
        const packet = normalizeAutodeskPacket(rawPacket || sheet.name);
        const user = userIndex >= 0 ? row[userIndex] || '' : '';
        const endDate = endIndex >= 0 ? row[endIndex] || '' : '';

        if (!packet || (!user && !endDate)) return;

        records.push({
          id: `excel-${sheet.name}-${rowIndex}`,
          packet,
          contract: contractIndex >= 0 ? row[contractIndex] || '' : '',
          subscriptionId: subscriptionIndex >= 0 ? row[subscriptionIndex] || '' : '',
          term: termIndex >= 0 ? row[termIndex] || '' : '',
          manage: manageIndex >= 0 ? row[manageIndex] || '' : '',
          user,
          startDate: startIndex >= 0 ? row[startIndex] || '' : '',
          endDate,
          company: companyIndex >= 0 ? row[companyIndex] || '' : '',
          vendor: vendorIndex >= 0 ? row[vendorIndex] || '' : '',
          sale: saleIndex >= 0 ? row[saleIndex] || '' : '',
          tel: telIndex >= 0 ? row[telIndex] || '' : '',
          sourceType: 'excel',
          sourceLabel: `Excel: ${sheet.name}`,
        });
      });
    });

  renewRecords.forEach((record) => {
    records.push({
      ...record,
      packet: normalizeAutodeskPacket(record.packet),
      sourceType: 'renew',
      sourceLabel: 'Renew',
    });
  });

  return records.sort((left, right) => {
    const leftDate = parseDateValue(left.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDate = parseDateValue(right.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (left.packet !== right.packet) {
      return left.packet.localeCompare(right.packet, 'th');
    }

    return rightDate - leftDate;
  });
};

const License = () => {
  const { userProfile } = useAuth();
  const [activeView, setActiveView] = useState<LicenseView>('licenseSoftwareIso');
  const [licenseWorkbook, setLicenseWorkbook] = useState<WorkbookData | null>(null);
  const [officeWorkbook, setOfficeWorkbook] = useState<WorkbookData | null>(null);
  const [officeDetailData, setOfficeDetailData] = useState<Office365DetailData | null>(null);
  const [autodeskRenewRecords, setAutodeskRenewRecords] = useState<AutodeskRenewRecord[]>([]);
  const [autodeskPdfRecords, setAutodeskPdfRecords] = useState<AutodeskPdfRecord[]>([]);
  const [officeLicenseRecords, setOfficeLicenseRecords] = useState<OfficeLicenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAutodeskRenew, setIsSavingAutodeskRenew] = useState(false);
  const [deletingAutodeskRenewId, setDeletingAutodeskRenewId] = useState('');
  const [isUploadingAutodeskPdf, setIsUploadingAutodeskPdf] = useState(false);
  const [isUpdatingAutodeskPdf, setIsUpdatingAutodeskPdf] = useState(false);
  const [isSavingOfficeLicense, setIsSavingOfficeLicense] = useState(false);
  const [isDeletingOfficeLicense, setIsDeletingOfficeLicense] = useState(false);
  const [selectedLicensePacket, setSelectedLicensePacket] = useState('');
  const [selectedAutodeskRecordId, setSelectedAutodeskRecordId] = useState('');
  const [selectedAutodeskPdfIndex, setSelectedAutodeskPdfIndex] = useState(0);
  const [autodeskPdfUploadMode, setAutodeskPdfUploadMode] = useState<AutodeskPdfUploadMode>('append');
  const [isAutodeskPreviewOpen, setIsAutodeskPreviewOpen] = useState(false);
  const [selectedOfficeUserId, setSelectedOfficeUserId] = useState('');
  const [autodeskModalMode, setAutodeskModalMode] = useState<AutodeskModalMode>(null);
  const [autodeskRenewTarget, setAutodeskRenewTarget] = useState<AutodeskLicenseRecord | null>(null);
  const [autodeskRenewForm, setAutodeskRenewForm] = useState({
    packet: '',
    contract: '',
    subscriptionId: '',
    term: '',
    manage: '',
    user: '',
    startDate: '',
    endDate: '',
    company: '',
    vendor: '',
    sale: '',
    tel: '',
  });
  const [officeModalMode, setOfficeModalMode] = useState<OfficeModalMode>(null);
  const [officeEditingLicenseId, setOfficeEditingLicenseId] = useState('');
  const [officeEditingSourceName, setOfficeEditingSourceName] = useState('');
  const [officeDeleteTarget, setOfficeDeleteTarget] = useState<OfficeLicenseItem | null>(null);
  const [officeForm, setOfficeForm] = useState({
    name: '',
    email: '',
    packet: '',
    keyValue: '',
    endDate: '',
    color: '',
  });
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const officeUsersSectionRef = useRef<HTMLDivElement>(null);
  const autodeskPdfInputRef = useRef<HTMLInputElement>(null);
  const [dragState, setDragState] = useState({ isDragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const autodeskRenewRef = collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, AUTODESK_RENEWAL_COLLECTION);
    const unsubscribe = onSnapshot(autodeskRenewRef, (snapshot) => {
      const nextRecords = snapshot.docs.map((record) => {
        const data = record.data() as Partial<AutodeskRenewRecord>;
        return {
          id: record.id,
          packet: typeof data.packet === 'string' ? data.packet : '',
          contract: typeof data.contract === 'string' ? data.contract : '',
          subscriptionId: typeof data.subscriptionId === 'string' ? data.subscriptionId : '',
          term: typeof data.term === 'string' ? data.term : '',
          manage: typeof data.manage === 'string' ? data.manage : '',
          user: typeof data.user === 'string' ? data.user : '',
          startDate: typeof data.startDate === 'string' ? data.startDate : '',
          endDate: typeof data.endDate === 'string' ? data.endDate : '',
          company: typeof data.company === 'string' ? data.company : '',
          vendor: typeof data.vendor === 'string' ? data.vendor : '',
          sale: typeof data.sale === 'string' ? data.sale : '',
          tel: typeof data.tel === 'string' ? data.tel : '',
          renewedFromId: typeof data.renewedFromId === 'string' ? data.renewedFromId : undefined,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
        };
      });

      setAutodeskRenewRecords(nextRecords);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const autodeskPdfRef = collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, AUTODESK_PDF_COLLECTION);
    const unsubscribe = onSnapshot(autodeskPdfRef, (snapshot) => {
      const nextRecords = snapshot.docs.map((record) => {
        const data = record.data() as Partial<AutodeskPdfRecord>;
        return {
          id: record.id,
          recordId: typeof data.recordId === 'string' ? data.recordId : '',
          packet: typeof data.packet === 'string' ? data.packet : '',
          files: Array.isArray(data.files)
            ? data.files
                .filter((file): file is AutodeskPdfFile => Boolean(file) && typeof file === 'object')
                .map((file) => ({
                  name: typeof file.name === 'string' ? file.name : 'PDF',
                  url: typeof file.url === 'string' ? file.url : '',
                  uploadedAt: typeof file.uploadedAt === 'string' ? file.uploadedAt : undefined,
                }))
                .filter((file) => file.url)
            : [],
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
        };
      });

      setAutodeskPdfRecords(nextRecords);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const officeLicenseRef = collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, OFFICE_LICENSE_COLLECTION);
    const unsubscribe = onSnapshot(officeLicenseRef, (snapshot) => {
      const nextRecords = snapshot.docs.map((record) => {
        const data = record.data() as Partial<OfficeLicenseRecord>;
        return {
          id: record.id,
          name: typeof data.name === 'string' ? data.name : typeof data.packet === 'string' ? data.packet : '',
          email: typeof data.email === 'string' ? data.email : '',
          packet: typeof data.packet === 'string' ? data.packet : '',
          keyValue: typeof data.keyValue === 'string' ? data.keyValue : '',
          endDate: typeof data.endDate === 'string' ? data.endDate : '',
          color: typeof data.color === 'string' ? data.color : '',
          renewedFromId: typeof data.renewedFromId === 'string' ? data.renewedFromId : undefined,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
        };
      });

      setOfficeLicenseRecords(nextRecords);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);

      try {
        const [licenseResponse, officeResponse, officeDetailResponse] = await Promise.all([
          fetch('/license-data/license-software-iso.json'),
          fetch('/license-data/office365-cmg.json'),
          fetch('/license-data/office365-cmg-detail.json'),
        ]);

        if (!licenseResponse.ok || !officeResponse.ok || !officeDetailResponse.ok) {
          throw new Error('Failed to load license data JSON files.');
        }

        const [licenseJson, officeJson, officeDetailJson] = await Promise.all([
          licenseResponse.json() as Promise<WorkbookData>,
          officeResponse.json() as Promise<WorkbookData>,
          officeDetailResponse.json() as Promise<Office365DetailData>,
        ]);

        if (cancelled) return;

        setLicenseWorkbook(licenseJson);
        setOfficeWorkbook(officeJson);
        setOfficeDetailData(officeDetailJson);

        const licenseSheet = licenseJson.sheets.find((sheet) => sheet.name === 'AutoCAD Revit LT Suite (2)');
        const licensePacketIndex = licenseSheet?.headers.findIndex((header) => header === 'Packet') ?? -1;
        const firstLicensePacket =
          licensePacketIndex >= 0
            ? licenseSheet?.rows.find((row) => row.values[licensePacketIndex])?.values[licensePacketIndex] ?? ''
            : '';
        setSelectedLicensePacket(firstLicensePacket);
      } catch (error) {
        console.error('Failed to load license workbook data:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const isMasterAdmin = userProfile
    && (Array.isArray(userProfile.role)
      ? userProfile.role.includes('MasterAdmin')
      : userProfile.role === 'MasterAdmin');

  const autodeskLicenseRecords = useMemo(
    () => buildAutodeskRecords(licenseWorkbook, autodeskRenewRecords),
    [autodeskRenewRecords, licenseWorkbook],
  );
  const autodeskRenewedSourceIds = useMemo(() => {
    const explicitRenewedIds = new Set(
      autodeskRenewRecords.map((record) => record.renewedFromId).filter((value): value is string => Boolean(value)),
    );

    const groupedRecords = new Map<string, AutodeskLicenseRecord[]>();
    autodeskLicenseRecords.forEach((record) => {
      const key = buildAutodeskRecordKey(record);
      if (!key) return;

      const records = groupedRecords.get(key) ?? [];
      records.push(record);
      groupedRecords.set(key, records);
    });

    groupedRecords.forEach((records) => {
      if (records.length < 2) return;

      const latestEndTime = Math.max(
        ...records.map((record) => parseDateValue(record.endDate)?.getTime() ?? Number.MIN_SAFE_INTEGER),
      );

      records.forEach((record) => {
        const recordEndTime = parseDateValue(record.endDate)?.getTime() ?? Number.MIN_SAFE_INTEGER;
        if (recordEndTime < latestEndTime) {
          explicitRenewedIds.add(record.id);
        }
      });
    });

    return explicitRenewedIds;
  }, [autodeskLicenseRecords, autodeskRenewRecords]);

  const autodeskLicenseGroups = useMemo<AutodeskLicenseGroup[]>(() => {
    const groupMap = new Map<string, AutodeskLicenseRecord[]>();

    autodeskLicenseRecords.forEach((record) => {
      const packet = normalizeAutodeskPacket(record.packet);
      if (!packet) return;

      const currentRecords = groupMap.get(packet) ?? [];
      currentRecords.push(record);
      groupMap.set(packet, currentRecords);
    });

    return Array.from(groupMap.entries())
      .map(([packet, records]) => {
        const currentRecords = records.filter((record) => !autodeskRenewedSourceIds.has(record.id));
        const counts = currentRecords.reduce(
          (summary, record) => {
            if (isAutodeskRenewedRecord(record)) {
              summary.activeCount += 1;
              return summary;
            }

            const status = getLicenseStatus(record.endDate);
            if (status.key === 'expired') summary.expiredCount += 1;
            else if (status.key === 'warning') summary.warningCount += 1;
            else summary.activeCount += 1;
            return summary;
          },
          { activeCount: 0, warningCount: 0, expiredCount: 0 },
        );

        return {
          packet,
          records,
          currentRecords,
          ...counts,
        };
      })
      .sort((left, right) => left.packet.localeCompare(right.packet, 'th'));
  }, [autodeskLicenseRecords, autodeskRenewedSourceIds]);

  useEffect(() => {
    if (!autodeskLicenseGroups.length) {
      if (selectedLicensePacket) setSelectedLicensePacket('');
      return;
    }

    const hasSelectedPacket = autodeskLicenseGroups.some(
      (group) => normalizePacket(group.packet) === normalizePacket(selectedLicensePacket),
    );

    if (!hasSelectedPacket) {
      setSelectedLicensePacket(autodeskLicenseGroups[0].packet);
    }
  }, [autodeskLicenseGroups, selectedLicensePacket]);

  const selectedAutodeskGroup = useMemo(
    () => autodeskLicenseGroups.find((group) => normalizePacket(group.packet) === normalizePacket(selectedLicensePacket)) ?? null,
    [autodeskLicenseGroups, selectedLicensePacket],
  );
  const selectedAutodeskCurrentRecords = useMemo(
    () => selectedAutodeskGroup?.currentRecords ?? [],
    [selectedAutodeskGroup],
  );
  const selectedAutodeskHistoryRecords = useMemo(() => {
    if (!selectedAutodeskGroup) return [];

    return selectedAutodeskGroup.records
      .filter((record) => autodeskRenewedSourceIds.has(record.id))
      .sort((left, right) => {
        const leftTime = parseDateValue(left.endDate)?.getTime() ?? 0;
        const rightTime = parseDateValue(right.endDate)?.getTime() ?? 0;
        return rightTime - leftTime;
      });
  }, [autodeskRenewedSourceIds, selectedAutodeskGroup]);
  const selectedAutodeskRecord = useMemo(
    () => selectedAutodeskGroup?.records.find((record) => record.id === selectedAutodeskRecordId) ?? null,
    [selectedAutodeskGroup, selectedAutodeskRecordId],
  );
  const selectedAutodeskPdfRecord = useMemo(
    () => autodeskPdfRecords.find((record) => record.recordId === selectedAutodeskRecordId) ?? null,
    [autodeskPdfRecords, selectedAutodeskRecordId],
  );
  const selectedAutodeskPdfFiles = selectedAutodeskPdfRecord?.files ?? [];
  const selectedAutodeskPdfFile = selectedAutodeskPdfFiles[selectedAutodeskPdfIndex] ?? null;

  useEffect(() => {
    const availableIds = selectedAutodeskCurrentRecords.length
      ? selectedAutodeskCurrentRecords.map((record) => record.id)
      : selectedAutodeskGroup?.records.map((record) => record.id) ?? [];
    if (!availableIds.length) {
      if (selectedAutodeskRecordId) setSelectedAutodeskRecordId('');
      return;
    }

    if (!selectedAutodeskRecordId || !availableIds.includes(selectedAutodeskRecordId)) {
      const recordMap = new Map((selectedAutodeskGroup?.records ?? []).map((record) => [record.id, record]));
      const preferredId = availableIds.find((id) => {
        let currentRecord = recordMap.get(id);
        const visited = new Set<string>();

        while (currentRecord?.renewedFromId) {
          const previousRecord = recordMap.get(currentRecord.renewedFromId);
          if (!previousRecord || visited.has(previousRecord.id)) break;
          return true;
        }

        return false;
      });

      setSelectedAutodeskRecordId(preferredId ?? availableIds[0]);
    }
  }, [selectedAutodeskCurrentRecords, selectedAutodeskGroup, selectedAutodeskRecordId]);

  useEffect(() => {
    setSelectedAutodeskPdfIndex(0);
  }, [selectedAutodeskRecordId]);

  const officePrimaryUsers = useMemo(
    () => officeDetailData?.primaryUsers.filter((user) => user.name) ?? [],
    [officeDetailData],
  );

  const sortedOfficeLicenseRecords = useMemo(
    () => [...officeLicenseRecords].sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left)),
    [officeLicenseRecords],
  );
  const officeRenewedSourceIds = useMemo(
    () => new Set(sortedOfficeLicenseRecords.map((record) => record.renewedFromId).filter((value): value is string => Boolean(value))),
    [sortedOfficeLicenseRecords],
  );

  const officeLicenseItems = useMemo(() => {
    const itemMap = new Map<string, OfficeLicenseItem>();

    officePrimaryUsers.forEach((user) => {
      const matchingRecords = sortedOfficeLicenseRecords
        .filter(
          (record) =>
            isSameOfficeIdentity(record.name, record.email, user.name, user.email) ||
            (!record.email && normalizePacket(record.name || record.packet) === normalizePacket(user.name)),
        );
      const overrideRecord = matchingRecords[0];
      const groupMembers = officeDetailData?.groups.find((group) => group.color === user.color)?.members ?? [];

      itemMap.set(user.id, {
        id: user.id,
        recordId: overrideRecord?.id,
        name: user.name,
        email: user.email,
        packet: overrideRecord?.packet || user.packet,
        keyValue: overrideRecord?.keyValue || user.keyValue,
        endDate: overrideRecord?.endDate || user.endDate,
        userCount: groupMembers.length,
        color: overrideRecord?.color || user.color,
        sourceType: overrideRecord ? 'manual' : 'sheet',
      });
    });

    sortedOfficeLicenseRecords.forEach((record) => {
      const recordName = record.name || record.packet;
      const alreadyExists = Array.from(itemMap.values()).some(
        (item) => isSameOfficeIdentity(item.name, item.email, recordName, record.email),
      );
      if (alreadyExists) return;

      const groupMembers = officeDetailData?.groups.find((group) => group.color === record.color)?.members ?? [];
      const manualId = record.id || buildOfficeLicenseId(recordName, record.email);

      itemMap.set(manualId, {
        id: manualId,
        recordId: record.id || manualId,
        name: recordName,
        email: record.email,
        packet: record.packet || 'MS 365 Family',
        keyValue: record.keyValue,
        endDate: record.endDate,
        userCount: groupMembers.length,
        color: record.color || '',
        sourceType: 'manual',
      });
    });

    return Array.from(itemMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'th'));
  }, [officeDetailData, officePrimaryUsers, sortedOfficeLicenseRecords]);

  useEffect(() => {
    if (!officeLicenseItems.length) {
      if (selectedOfficeUserId) setSelectedOfficeUserId('');
      return;
    }

    const hasSelectedUser = officeLicenseItems.some((user) => user.id === selectedOfficeUserId);
    if (!hasSelectedUser) {
      setSelectedOfficeUserId(officeLicenseItems[0].id);
    }
  }, [officeLicenseItems, selectedOfficeUserId]);

  const selectedOfficeLicenseItem = useMemo(
    () => officeLicenseItems.find((item) => item.id === selectedOfficeUserId) ?? null,
    [officeLicenseItems, selectedOfficeUserId],
  );

  const selectedOfficeGroupMembers = useMemo(() => {
    if (!officeDetailData || !selectedOfficeLicenseItem?.color) return [];

    const group = officeDetailData.groups.find((item) => item.color === selectedOfficeLicenseItem.color);
    if (!group) return [];

    const uniqueMembers = new Map<string, Office365GroupMember>();
    group.members.forEach((member) => {
      const key = `${member.name.trim().toLowerCase()}|${member.email.trim().toLowerCase()}`;
      if (!key || uniqueMembers.has(key)) return;
      uniqueMembers.set(key, member);
    });

    return Array.from(uniqueMembers.values());
  }, [officeDetailData, selectedOfficeLicenseItem]);

  const selectedOfficeHistory = useMemo<OfficeLicenseHistoryItem[]>(() => {
    if (!selectedOfficeLicenseItem) return [];

    const historyItems: OfficeLicenseHistoryItem[] = [];
    const primarySource = officePrimaryUsers.find(
      (user) => isSameOfficeIdentity(user.name, user.email, selectedOfficeLicenseItem.name, selectedOfficeLicenseItem.email),
    );
    const relatedRecordIds = new Set<string>();
    const relatedRecords: OfficeLicenseRecord[] = [];
    const queue = new Set<string>();

    if (selectedOfficeLicenseItem.recordId) {
      queue.add(selectedOfficeLicenseItem.recordId);
    }

    sortedOfficeLicenseRecords.forEach((record) => {
      const recordName = record.name || record.packet;
      if (isSameOfficeIdentity(recordName, record.email, selectedOfficeLicenseItem.name, selectedOfficeLicenseItem.email)) {
        queue.add(record.id);
        if (record.renewedFromId) queue.add(record.renewedFromId);
      }
    });

    let expanded = true;
    while (expanded) {
      expanded = false;
      sortedOfficeLicenseRecords.forEach((record) => {
        if (
          queue.has(record.id) ||
          (record.renewedFromId && queue.has(record.renewedFromId))
        ) {
          if (!queue.has(record.id)) {
            queue.add(record.id);
            expanded = true;
          }
          if (record.renewedFromId && !queue.has(record.renewedFromId)) {
            queue.add(record.renewedFromId);
            expanded = true;
          }
        }
      });
    }

    sortedOfficeLicenseRecords.forEach((record) => {
      const recordName = record.name || record.packet;
      const isIdentityMatch = isSameOfficeIdentity(
        recordName,
        record.email,
        selectedOfficeLicenseItem.name,
        selectedOfficeLicenseItem.email,
      );
      const isChainMatch = queue.has(record.id) || (record.renewedFromId ? queue.has(record.renewedFromId) : false);
      if ((!isIdentityMatch && !isChainMatch) || relatedRecordIds.has(record.id)) return;

      relatedRecordIds.add(record.id);
      relatedRecords.push(record);
    });

    relatedRecords.forEach((record, index) => {
        historyItems.push({
          id: record.id,
          name: record.name || selectedOfficeLicenseItem.name,
          email: record.email || selectedOfficeLicenseItem.email,
          packet: record.packet,
          keyValue: record.keyValue,
          endDate: record.endDate,
          color: record.color || selectedOfficeLicenseItem.color,
          sourceLabel: index === 0 ? 'Current' : 'History',
          isSuperseded: officeRenewedSourceIds.has(record.id),
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        });
      });

    if (primarySource) {
      historyItems.push({
        id: `${selectedOfficeLicenseItem.id}-sheet`,
        name: selectedOfficeLicenseItem.name,
        email: selectedOfficeLicenseItem.email,
        packet: primarySource.packet || selectedOfficeLicenseItem.packet,
        keyValue: primarySource.keyValue || '',
        endDate: primarySource.endDate || '',
        color: selectedOfficeLicenseItem.color,
        sourceLabel: 'Excel',
      });
    }

    return historyItems;
  }, [officePrimaryUsers, officeRenewedSourceIds, selectedOfficeLicenseItem, sortedOfficeLicenseRecords]);
  const selectedOfficeCurrentRecord = useMemo(
    () => selectedOfficeHistory[0] ?? null,
    [selectedOfficeHistory],
  );
  const selectedOfficePastRecords = useMemo(
    () => selectedOfficeHistory.slice(1),
    [selectedOfficeHistory],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableContainerRef.current) return;

    setDragState({
      isDragging: true,
      startX: e.pageX,
      scrollLeft: tableContainerRef.current.scrollLeft,
    });
  };

  const handleMouseLeave = () => {
    setDragState((prev) => ({ ...prev, isDragging: false }));
  };

  const handleMouseUp = () => {
    setDragState((prev) => ({ ...prev, isDragging: false }));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const walk = (e.pageX - dragState.startX) * 1.5;
    tableContainerRef.current.scrollLeft = dragState.scrollLeft - walk;
  };

  const openAutodeskRenewModal = (record: AutodeskLicenseRecord) => {
    setAutodeskRenewTarget(record);
    setAutodeskRenewForm({
      packet: record.packet,
      contract: record.contract,
      subscriptionId: record.subscriptionId,
      term: record.term,
      manage: record.manage,
      user: record.user,
      startDate: toInputDate(record.startDate),
      endDate: toInputDate(record.endDate),
      company: record.company,
      vendor: record.vendor,
      sale: record.sale,
      tel: record.tel,
    });
    setAutodeskModalMode('renew');
  };

  const openAutodeskAddModal = () => {
    setAutodeskRenewTarget(null);
    setAutodeskRenewForm({
      packet: '',
      contract: '',
      subscriptionId: '',
      term: '',
      manage: '',
      user: '',
      startDate: '',
      endDate: '',
      company: '',
      vendor: '',
      sale: '',
      tel: '',
    });
    setAutodeskModalMode('add');
  };

  const closeAutodeskRenewModal = () => {
    if (isSavingAutodeskRenew) return;
    setAutodeskModalMode(null);
    setAutodeskRenewTarget(null);
  };

  const handleAutodeskRenewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const packet = autodeskRenewForm.packet.trim();
    const user = autodeskRenewForm.user.trim();
    const startDate = autodeskRenewForm.startDate.trim();
    const endDate = autodeskRenewForm.endDate.trim();

    if (!packet || !user || !startDate || !endDate) {
      alert('à¹€à¸˜Âà¹€à¸˜à¸ƒà¹€à¸˜à¸˜à¹€à¸˜â€œà¹€à¸˜à¸’à¹€à¸˜Âà¹€à¸˜à¸ƒà¹€à¸˜à¸à¹€à¸˜Â License, User, à¹€à¸˜à¸‡à¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸™â‚¬à¹€à¸˜à¸ƒà¹€à¸˜à¸”à¹€à¸™Âˆà¹€à¸˜à¸ à¹€à¸™Âà¹€à¸˜à¸…à¹€à¸˜à¸à¹€à¸˜à¸‡à¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜à¸‹à¹€à¸˜à¸à¹€à¸˜â€à¹€à¸˜à¸à¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸˜à¸˜à¹€à¸™Âƒà¹€à¸˜à¸‹à¹€à¸™Â‰à¹€à¸˜Â„à¹€à¸˜à¸ƒà¹€à¸˜Âš');
      return;
    }

    setIsSavingAutodeskRenew(true);
    try {
      await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, AUTODESK_RENEWAL_COLLECTION), {
        packet,
        contract: autodeskRenewForm.contract.trim(),
        subscriptionId: autodeskRenewForm.subscriptionId.trim(),
        term: autodeskRenewForm.term.trim(),
        manage: autodeskRenewForm.manage.trim(),
        user,
        startDate,
        endDate,
        company: autodeskRenewForm.company.trim(),
        vendor: autodeskRenewForm.vendor.trim(),
        sale: autodeskRenewForm.sale.trim(),
        tel: autodeskRenewForm.tel.trim(),
        renewedFromId: autodeskRenewTarget?.id ?? '',
        createdAt: new Date().toISOString(),
      });

      setSelectedLicensePacket(packet);
      setAutodeskModalMode(null);
      setAutodeskRenewTarget(null);
    } catch (error) {
      console.error('Failed to save Autodesk renew record:', error);
      alert('à¹€à¸˜Âšà¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜â€”à¹€à¸˜à¸–à¹€à¸˜Âà¹€à¸˜Âà¹€à¸˜à¸’à¹€à¸˜à¸ƒ Renew à¹€à¸™Â„à¹€à¸˜à¸à¹€à¸™Âˆà¹€à¸˜à¸Šà¹€à¸˜à¸“à¹€à¸™â‚¬à¹€à¸˜à¸ƒà¹€à¸™Â‡à¹€à¸˜Âˆ');
    } finally {
      setIsSavingAutodeskRenew(false);
    }
  };

  const openAutodeskPdfPicker = (recordId: string, mode: AutodeskPdfUploadMode = 'append') => {
    setSelectedAutodeskRecordId(recordId);
    setAutodeskPdfUploadMode(mode);
    autodeskPdfInputRef.current?.click();
  };

  const openAutodeskPreview = (recordId: string) => {
    setSelectedAutodeskRecordId(recordId);
    setSelectedAutodeskPdfIndex(0);
    setIsAutodeskPreviewOpen(true);
  };

  const closeAutodeskPreview = () => {
    setIsAutodeskPreviewOpen(false);
  };

  const handleAutodeskPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAutodeskRecord) return;

    setIsUploadingAutodeskPdf(true);
    try {
      const storageRef = ref(
        storage,
        `licenses/autodesk/${encodeURIComponent(selectedAutodeskRecord.id)}/${Date.now()}_${file.name}`,
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const timestamp = new Date().toISOString();
      const nextFile = { name: file.name, url, path: storageRef.fullPath, uploadedAt: timestamp };
      const nextFiles =
        autodeskPdfUploadMode === 'replace' && selectedAutodeskPdfFiles[selectedAutodeskPdfIndex]
          ? selectedAutodeskPdfFiles.map((existingFile, index) => (index === selectedAutodeskPdfIndex ? nextFile : existingFile))
          : [...(selectedAutodeskPdfRecord?.files ?? []), nextFile];

      await setDoc(
        doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, AUTODESK_PDF_COLLECTION, encodeURIComponent(selectedAutodeskRecord.id)),
        {
          recordId: selectedAutodeskRecord.id,
          packet: selectedAutodeskRecord.packet,
          files: nextFiles,
          updatedAt: timestamp,
        },
        { merge: true },
      );

      setSelectedAutodeskPdfIndex(
        autodeskPdfUploadMode === 'replace' && selectedAutodeskPdfFiles[selectedAutodeskPdfIndex]
          ? selectedAutodeskPdfIndex
          : Math.max(nextFiles.length - 1, 0),
      );
    } catch (error) {
      console.error('Failed to upload Autodesk PDF:', error);
      alert('à¹€à¸˜à¸à¹€à¸˜à¸‘à¹€à¸˜Â›à¹€à¸™Â‚à¹€à¸˜à¸‹à¹€à¸˜à¸…à¹€à¸˜â€ PDF à¹€à¸™Â„à¹€à¸˜à¸à¹€à¸™Âˆà¹€à¸˜à¸Šà¹€à¸˜à¸“à¹€à¸™â‚¬à¹€à¸˜à¸ƒà¹€à¸™Â‡à¹€à¸˜Âˆ');
    } finally {
      setIsUploadingAutodeskPdf(false);
      setAutodeskPdfUploadMode('append');
      e.target.value = '';
    }
  };

  const handleDeleteAutodeskPdf = async () => {
    if (!selectedAutodeskRecord || !selectedAutodeskPdfFiles[selectedAutodeskPdfIndex]) return;

    setIsUpdatingAutodeskPdf(true);
    try {
      const nextFiles = selectedAutodeskPdfFiles.filter((_, index) => index !== selectedAutodeskPdfIndex);
      await setDoc(
        doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, AUTODESK_PDF_COLLECTION, encodeURIComponent(selectedAutodeskRecord.id)),
        {
          recordId: selectedAutodeskRecord.id,
          packet: selectedAutodeskRecord.packet,
          files: nextFiles,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      setSelectedAutodeskPdfIndex((currentIndex) => Math.max(0, Math.min(currentIndex - 1, nextFiles.length - 1)));
    } catch (error) {
      console.error('Failed to delete Autodesk PDF:', error);
      alert('à¹€à¸˜à¸…à¹€à¸˜Âš PDF à¹€à¸™Â„à¹€à¸˜à¸à¹€à¸™Âˆà¹€à¸˜à¸Šà¹€à¸˜à¸“à¹€à¸™â‚¬à¹€à¸˜à¸ƒà¹€à¸™Â‡à¹€à¸˜Âˆ');
    } finally {
      setIsUpdatingAutodeskPdf(false);
    }
  };

  const handleDeleteAutodeskRenewRecord = async (record: AutodeskLicenseRecord) => {
    if (record.sourceType !== 'renew') {
      alert('Only manually added renewal records can be deleted.');
      return;
    }

    const shouldDelete = window.confirm(`Delete ${record.packet} from Autodesk License?`);
    if (!shouldDelete) return;

    setDeletingAutodeskRenewId(record.id);
    try {
      await deleteDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, AUTODESK_RENEWAL_COLLECTION, record.id));

      if (selectedAutodeskRecordId === record.id) {
        setSelectedAutodeskRecordId('');
      }
    } catch (error) {
      console.error('Failed to delete Autodesk renew record:', error);
      alert('Delete Autodesk License failed.');
    } finally {
      setDeletingAutodeskRenewId('');
    }
  };

  const renderAutodeskTable = (records: AutodeskLicenseRecord[], tableMode: 'current' | 'history') => {
    const visibleRecords =
      tableMode === 'current'
        ? records.filter((record) => !autodeskRenewedSourceIds.has(record.id))
        : records;

    return (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/35 shadow-sm">
      <div
        ref={tableContainerRef}
        className={`overflow-x-auto ${dragState.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <table className="w-full min-w-[1160px] table-auto text-left">
          <thead className="bg-white/60">
            <tr>
              {['License', 'Contract', 'Subscription ID', 'Term', 'Manage', 'User', 'Start', 'End', 'Company', 'Vendor', 'PDF', 'Status']
                .map((header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]"
                  >
                    {header}
                  </th>
                ))}
              {isMasterAdmin ? (
                <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Action</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record) => {
              const status = getLicenseStatus(record.endDate);
              const isSuperseded = autodeskRenewedSourceIds.has(record.id);
              const isRenewedCurrent = tableMode === 'current' && isAutodeskRenewedRecord(record);
              const isUrgentRenew = status.key === 'expired' && !isSuperseded && !isRenewedCurrent;
              const pdfCount = autodeskPdfRecords.find((item) => item.recordId === record.id)?.files.length ?? 0;
              const isNeutralExpiredRow =
                status.key === 'expired' && (tableMode === 'history' || isSuperseded || isRenewedCurrent);
              const rowClassName = isNeutralExpiredRow ? 'hover:bg-white/50' : status.rowClassName || 'hover:bg-white/50';
              const statusDotClassName = isRenewedCurrent ? 'bg-[#16a34a]' : isNeutralExpiredRow ? 'bg-slate-400' : status.dotClassName;
              const statusLabel = isRenewedCurrent
                ? 'Renewed'
                : tableMode === 'history' && status.key === 'expired' && isSuperseded
                  ? 'Renewed'
                  : status.label;

              return (
                <tr
                  key={record.id}
                  onClick={() => openAutodeskPreview(record.id)}
                  className={`border-t border-white/40 align-top transition-colors ${
                    selectedAutodeskRecordId === record.id
                      ? 'bg-[#e8f5ff]/95 text-[#1f4f80]'
                      : rowClassName
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-inherit">{record.packet || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.contract || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.subscriptionId || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.term || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.manage || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.user || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{formatDisplayDate(record.startDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-inherit">{formatDisplayDate(record.endDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.company || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.vendor || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2 py-1 font-bold">
                      <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
                      {pdfCount}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2 py-1 font-bold">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusDotClassName}`} />
                      {statusLabel}
                    </span>
                  </td>
                  {isMasterAdmin ? (
                    <td className="whitespace-nowrap px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openAutodeskPdfPicker(record.id);
                          }}
                          className="rounded-full border border-[#9bc7eb] bg-[#e8f5ff] px-3 py-1 text-[11px] font-bold text-[#27619d] transition-colors hover:bg-[#d7eeff]"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openAutodeskRenewModal(record);
                          }}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                            isUrgentRenew
                              ? 'border border-[#f2a0a0] bg-[#ffe3e3] text-[#b42318] hover:bg-[#ffd2d2]'
                              : 'border border-[#f4c777] bg-[#fff4dc] text-[#9a6400] hover:bg-[#ffefc9]'
                          }`}
                        >
                          {isUrgentRenew ? 'Renew' : 'Edit'}
                        </button>
                        {tableMode === 'current' && isUrgentRenew ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAutodeskRenewModal(record);
                            }}
                            className="rounded-full border border-[#f4c777] bg-[#fff4dc] px-3 py-1 text-[11px] font-bold text-[#9a6400] transition-colors hover:bg-[#ffefc9]"
                          >
                            Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteAutodeskRenewRecord(record);
                          }}
                          disabled={record.sourceType !== 'renew' || deletingAutodeskRenewId === record.id}
                          className="rounded-full border border-[#f2a0a0] bg-[#ffe3e3] px-3 py-1 text-[11px] font-bold text-[#b42318] transition-colors hover:bg-[#ffd2d2] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {deletingAutodeskRenewId === record.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const renderOfficeGroupMembersTable = (members: Office365GroupMember[]) => (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/35 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-auto text-left">
          <thead className="bg-white/60">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-bold tracking-wide text-[#596064]">à¹€à¸˜ÂŠà¹€à¸˜à¸—à¹€à¸™Âˆà¹€à¸˜à¸</th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-bold tracking-wide text-[#596064]">à¹€à¸˜à¸à¹€à¸˜à¸•à¹€à¸™â‚¬à¹€à¸˜à¸à¹€à¸˜à¸…</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={`${member.email}-${index}`} className="border-t border-white/40 transition-colors hover:bg-white/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-[#2c3437]">{member.name || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[#596064]">{member.email || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderOfficeHistoryTable = (records: OfficeLicenseHistoryItem[]) => (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/35 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-auto text-left">
          <thead className="bg-white/60">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Source</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">License</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Key</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">à¹€à¸˜à¸‹à¹€à¸˜à¸à¹€à¸˜â€à¹€à¸˜à¸à¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸˜à¸˜</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">à¹€à¸˜Âšà¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜â€”à¹€à¸˜à¸–à¹€à¸˜Âà¹€à¸™â‚¬à¹€à¸˜à¸à¹€à¸˜à¸—à¹€à¸™Âˆà¹€à¸˜à¸</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const status = getLicenseStatus(record.endDate);
              const rowClassName =
                record.isSuperseded && status.key === 'expired'
                  ? 'border-t border-white/40 hover:bg-white/50'
                  : `border-t border-white/40 ${status.rowClassName || 'hover:bg-white/50'}`;
              return (
                <tr key={record.id} className={rowClassName}>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-inherit">{record.sourceLabel}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.packet || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{record.keyValue || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-inherit">{formatDisplayDate(record.endDate)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">
                    {formatDisplayDate(record.updatedAt || record.createdAt || '')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const handleSelectOfficeUser = (userId: string) => {
    setSelectedOfficeUserId(userId);
    window.requestAnimationFrame(() => {
      officeUsersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openAddOfficeLicenseModal = () => {
    setOfficeEditingLicenseId('');
    setOfficeEditingSourceName('');
    setOfficeForm({ name: '', email: '', packet: 'MS 365 Family', keyValue: '', endDate: '', color: '' });
    setOfficeModalMode('add');
  };

  const openEditOfficeLicenseModal = (licenseItem: OfficeLicenseItem) => {
    setOfficeEditingLicenseId(licenseItem.recordId || licenseItem.id);
    setOfficeEditingSourceName(licenseItem.name);
    setOfficeForm({
      name: licenseItem.name,
      email: licenseItem.email,
      packet: licenseItem.packet,
      keyValue: licenseItem.keyValue,
      endDate: toInputDate(licenseItem.endDate),
      color: licenseItem.color,
    });
    setOfficeModalMode('edit');
  };

  const openRenewOfficeLicenseModal = (licenseItem: OfficeLicenseItem) => {
    setOfficeEditingLicenseId(licenseItem.recordId || licenseItem.id);
    setOfficeEditingSourceName(licenseItem.name);
    setOfficeForm({
      name: licenseItem.name,
      email: licenseItem.email,
      packet: licenseItem.packet,
      keyValue: licenseItem.keyValue,
      endDate: toInputDate(licenseItem.endDate),
      color: licenseItem.color,
    });
    setOfficeModalMode('renew');
  };

  const openDeleteOfficeLicenseModal = (licenseItem: OfficeLicenseItem) => {
    setOfficeDeleteTarget(licenseItem.recordId ? { ...licenseItem, id: licenseItem.recordId } : licenseItem);
  };

  const closeOfficeLicenseModal = () => {
    if (isSavingOfficeLicense) return;
    setOfficeModalMode(null);
    setOfficeEditingLicenseId('');
    setOfficeEditingSourceName('');
  };

const handleOfficeLicenseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const name = officeForm.name.trim();
    const email = officeForm.email.trim();
    const packet = officeForm.packet.trim();
    const keyValue = officeForm.keyValue.trim();
    const endDate = officeForm.endDate.trim();
    const color = officeForm.color.trim();

    if (!name || !packet || !keyValue || !endDate) {
      alert('à¹€à¸˜Âà¹€à¸˜à¸ƒà¹€à¸˜à¸˜à¹€à¸˜â€œà¹€à¸˜à¸’à¹€à¸˜Âà¹€à¸˜à¸ƒà¹€à¸˜à¸à¹€à¸˜Âà¹€à¸˜ÂŠà¹€à¸˜à¸—à¹€à¸™Âˆà¹€à¸˜à¸, License, Key à¹€à¸™Âà¹€à¸˜à¸…à¹€à¸˜à¸à¹€à¸˜à¸‡à¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜à¸‹à¹€à¸˜à¸à¹€à¸˜â€à¹€à¸˜à¸à¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸˜à¸˜à¹€à¸™Âƒà¹€à¸˜à¸‹à¹€à¸™Â‰à¹€à¸˜Â„à¹€à¸˜à¸ƒà¹€à¸˜Âš');
      return;
    }

    const existingRecord = officeLicenseRecords.find(
      (record) =>
        normalizePacket(record.name || record.packet) === normalizePacket(name) &&
        normalizePacket(record.email) === normalizePacket(email),
    );

    const editingNameChanged =
      officeModalMode === 'edit' && normalizePacket(name) !== normalizePacket(officeEditingSourceName);

    if (
      officeModalMode !== 'renew' &&
      (officeModalMode === 'add' || editingNameChanged) &&
      existingRecord &&
      existingRecord.id !== officeEditingLicenseId
    ) {
      alert('à¹€à¸˜à¸à¹€à¸˜à¸•à¹€à¸˜à¸ƒà¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸˜Âà¹€à¸˜à¸’à¹€à¸˜à¸ƒà¹€à¸˜Â™à¹€à¸˜à¸•à¹€à¸™Â‰à¹€à¸˜à¸à¹€à¸˜à¸‚à¹€à¸˜à¸™à¹€à¸™Âˆà¹€à¸™Âà¹€à¸˜à¸…à¹€à¸™Â‰à¹€à¸˜à¸‡');
      return;
    }

    const docId = officeEditingLicenseId || existingRecord?.id || buildOfficeLicenseId(name, email);
    const timestamp = new Date().toISOString();
    const matchingPrimaryUser = officePrimaryUsers.find(
      (user) => normalizePacket(user.name) === normalizePacket(name) && normalizePacket(user.email) === normalizePacket(email),
    );

    setIsSavingOfficeLicense(true);
    try {
      const payload = {
        name,
        email,
        packet,
        keyValue,
        endDate,
        color,
        updatedAt: timestamp,
      };

      if (officeModalMode === 'renew') {
        const renewedDoc = await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, OFFICE_LICENSE_COLLECTION), {
          ...payload,
          renewedFromId: officeEditingLicenseId || existingRecord?.id || matchingPrimaryUser?.id || '',
          createdAt: timestamp,
        });

        setSelectedOfficeUserId(matchingPrimaryUser?.id || renewedDoc.id);
      } else {
        await setDoc(
          doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, OFFICE_LICENSE_COLLECTION, docId),
          {
            ...payload,
            createdAt: existingRecord?.createdAt ?? timestamp,
          },
          { merge: true },
        );

        if (officeModalMode === 'edit' && editingNameChanged && officeEditingLicenseId) {
          await deleteDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, OFFICE_LICENSE_COLLECTION, officeEditingLicenseId));
        }

        setSelectedOfficeUserId(matchingPrimaryUser?.id || docId);
      }

      setOfficeModalMode(null);
      setOfficeEditingLicenseId('');
      setOfficeEditingSourceName('');
    } catch (error) {
      console.error('Failed to save Microsoft 365 license:', error);
      alert('à¹€à¸˜Âšà¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜â€”à¹€à¸˜à¸–à¹€à¸˜Âà¹€à¸˜Â‚à¹€à¸™Â‰à¹€à¸˜à¸à¹€à¸˜à¸à¹€à¸˜à¸™à¹€à¸˜à¸… License à¹€à¸™Â„à¹€à¸˜à¸à¹€à¸™Âˆà¹€à¸˜à¸Šà¹€à¸˜à¸“à¹€à¸™â‚¬à¹€à¸˜à¸ƒà¹€à¸™Â‡à¹€à¸˜Âˆ');
    } finally {
      setIsSavingOfficeLicense(false);
    }
  };

  const handleDeleteOfficeLicense = async () => {
    if (!officeDeleteTarget) return;

    setIsDeletingOfficeLicense(true);
    try {
      await deleteDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, OFFICE_LICENSE_COLLECTION, officeDeleteTarget.id));
      if (selectedOfficeUserId === officeDeleteTarget.id) {
        setSelectedOfficeUserId('');
      }
      setOfficeDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete Microsoft 365 license:', error);
      alert('à¹€à¸˜à¸…à¹€à¸˜Âšà¹€à¸˜Â‚à¹€à¸™Â‰à¹€à¸˜à¸à¹€à¸˜à¸à¹€à¸˜à¸™à¹€à¸˜à¸… License à¹€à¸™Â„à¹€à¸˜à¸à¹€à¸™Âˆà¹€à¸˜à¸Šà¹€à¸˜à¸“à¹€à¸™â‚¬à¹€à¸˜à¸ƒà¹€à¸™Â‡à¹€à¸˜Âˆ');
    } finally {
      setIsDeletingOfficeLicense(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen px-8 pb-12 pt-8">
      <div className="mx-auto max-w-[95%]">
        <header className="mb-10 flex flex-col gap-6">
          <div>
            <h1 className="mb-2 font-display text-4xl font-extrabold tracking-tight text-[#2c3437]">License Center</h1>
            <p className="max-w-3xl font-body text-[#596064]">
              Manage license data from Excel snapshots together with renewal records saved in the system, so current usage and license history can be reviewed directly on this page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveView('licenseSoftwareIso')}
              className={`${topButtonBase} ${
                activeView === 'licenseSoftwareIso'
                  ? 'border-[#9bc7eb] bg-[#e8f5ff] text-[#27619d]'
                  : 'border-white/50 bg-white/40 text-[#596064] hover:bg-white/60'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">license</span>
              <span>License:</span>
              <span className="font-bold">Autodesk License</span>
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('office365Registry')}
              className={`${topButtonBase} ${
                activeView === 'office365Registry'
                  ? 'border-[#9bc7eb] bg-[#e8f5ff] text-[#27619d]'
                  : 'border-white/50 bg-white/40 text-[#596064] hover:bg-white/60'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">table_view</span>
              <span>Registry:</span>
              <span className="font-bold">Microsoft 365 Registry</span>
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
            <p className="text-sm font-medium text-[#596064]">Loading license data from Excel snapshot...</p>
          </div>
        ) : activeView === 'licenseSoftwareIso' ? (
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/40 bg-white/45 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#C7E7FF]/80 px-3 py-1 text-sm font-bold text-[#27619D]">
                    <span className="material-symbols-outlined text-sm">database</span>
                    Excel snapshot + Renew history
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#2c3437]">Autodesk License</h2>
                  <p className="mt-2 font-body text-sm text-[#596064]">
                    Source: {licenseWorkbook?.sourceFileName} | Updated: {licenseWorkbook?.sourceLastWriteTime} | Synced:{' '}
                    {licenseWorkbook?.syncedAt}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold text-[#2c3437] shadow-sm">
                  {selectedAutodeskGroup?.currentRecords.length ?? autodeskLicenseRecords.length} licenses
                </div>
              </div>
            </div>

            {autodeskLicenseGroups.length ? (
              <>
                <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg font-bold text-[#2c3437]">License List</h3>
                    {isMasterAdmin ? (
                      <button
                        type="button"
                        onClick={openAutodeskAddModal}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#27619d] px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#1f4f80]"
                      >
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        Add Item
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {autodeskLicenseGroups.map((item) => (
                      <button
                        key={item.packet}
                        type="button"
                        onClick={() => setSelectedLicensePacket(item.packet)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          selectedLicensePacket === item.packet
                            ? 'border-[#27619d] bg-[#e8f5ff] shadow-md shadow-[#27619d]/10'
                            : 'border-white/50 bg-white/60 hover:bg-white'
                        }`}
                      >
                        <div className="text-sm font-bold text-[#2c3437]">{item.packet}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {item.currentRecords.map((record) => {
                            const status = getLicenseStatus(record.endDate);
                            return (
                              <span
                                key={`${item.packet}-${record.id}`}
                                className={`h-2.5 w-2.5 rounded-full ${status.dotClassName}`}
                                title={`${record.user || item.packet} â€¢ ${status.label}`}
                              />
                            );
                          })}
                        </div>
                        <div className="mt-2 text-[11px] font-medium text-[#596064]">{item.currentRecords.length} licenses</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#2c3437]">
                        {selectedLicensePacket || 'Selected License'}
                      </h3>
                      <p className="font-body text-sm text-[#596064]">View current licenses and renewal history for the selected Autodesk package in one place.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-bold text-[#166534]">
                        Active {selectedAutodeskGroup?.activeCount ?? 0}
                      </div>
                      <div className="rounded-full bg-[#ffedd5] px-3 py-1 text-xs font-bold text-[#c2410c]">
                        Near Expiry {selectedAutodeskGroup?.warningCount ?? 0}
                      </div>
                      <div className="rounded-full bg-[#fee2e2] px-3 py-1 text-xs font-bold text-[#b91c1c]">
                        Expired {selectedAutodeskGroup?.expiredCount ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedAutodeskCurrentRecords.length ? (
                  <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                    <div className="mb-4">
                      <h3 className="font-display text-lg font-bold text-[#2c3437]">Current License</h3>
                      <p className="font-body text-sm text-[#596064]">Shows the licenses that are currently active for this Autodesk package.</p>
                    </div>
                    {renderAutodeskTable(selectedAutodeskCurrentRecords, 'current')}
                  </div>
                ) : null}

                <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#2c3437]">License History</h3>
                      <p className="font-body text-sm text-[#596064]">When a license is renewed, the previous record will move to this history section.</p>
                    </div>
                    {isMasterAdmin ? (
                      <button
                        type="button"
                        onClick={openAutodeskAddModal}
                        className="inline-flex items-center gap-2 self-start rounded-full bg-[#27619d] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1f4f80]"
                      >
                        <span className="material-symbols-outlined text-base">add_circle</span>
                        Add Item
                      </button>
                    ) : null}
                  </div>
                  {selectedAutodeskHistoryRecords.length ? (
                    renderAutodeskTable(selectedAutodeskHistoryRecords, 'history')
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/50 bg-white/30 px-4 py-6 text-sm text-[#596064]">
                      No renewal history for this license yet.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
                <p className="text-sm font-medium text-[#596064]">No Autodesk license data found.</p>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/40 bg-white/45 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#C7E7FF]/80 px-3 py-1 text-sm font-bold text-[#27619D]">
                    <span className="material-symbols-outlined text-sm">table_chart</span>
                    Excel snapshot + Firebase
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#2c3437]">Microsoft 365 Registry</h2>
                  <p className="mt-2 font-body text-sm text-[#596064]">
                    Source: {officeWorkbook?.sourceFileName} | Updated: {officeWorkbook?.sourceLastWriteTime} | Synced:{' '}
                    {officeWorkbook?.syncedAt}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">Key</div>
                    <div className="mt-1 font-semibold text-[#2c3437]">{selectedOfficeLicenseItem?.keyValue || '-'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">Users</div>
                    <div className="mt-1 font-semibold text-[#2c3437]">{selectedOfficeGroupMembers.length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#2c3437]">License Microsoft 365+</h3>
                  <p className="font-body text-sm text-[#596064]">Manage Microsoft 365 license keys, expiry dates, and grouped users from this section.</p>
                </div>

                {isMasterAdmin ? (
                  <button
                    type="button"
                    onClick={openAddOfficeLicenseModal}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#27619d] px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#1f4f80]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Add License
                  </button>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/35 shadow-sm">
                <div
                  ref={tableContainerRef}
                  className={`overflow-x-auto ${dragState.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                >
                  <table className="w-full min-w-[980px] table-auto text-left">
                    <thead className="bg-white/60">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Name</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Email</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">License</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Key</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Expiry</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Users</th>
                        {isMasterAdmin ? (
                          <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Action</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {officeLicenseItems.map((item) => {
                        const status = getLicenseStatus(item.endDate);
                        const isActive = item.id === selectedOfficeUserId;

                        return (
                          <tr
                            key={item.id}
                            onClick={() => handleSelectOfficeUser(item.id)}
                            className={`cursor-pointer border-t border-white/40 transition-colors ${
                              isActive ? 'bg-[#e8f5ff]/90' : status.rowClassName || 'hover:bg-white/50'
                            }`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-inherit">{item.name || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{item.email || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{item.packet || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{item.keyValue || '-'}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-inherit">{formatDisplayDate(item.endDate)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-[11px] text-inherit">{item.userCount}</td>
                            {isMasterAdmin ? (
                              <td className="whitespace-nowrap px-3 py-2 text-[11px]">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openRenewOfficeLicenseModal(item);
                                    }}
                                    className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                                      status.key === 'expired'
                                        ? 'border border-[#f2a0a0] bg-[#ffe3e3] text-[#b42318] hover:bg-[#ffd2d2]'
                                        : 'border border-[#f4c777] bg-[#fff4dc] text-[#9a6400] hover:bg-[#ffefc9]'
                                    }`}
                                    title="Renew License"
                                  >
                                    {status.key === 'expired' ? 'Renew Now' : 'Renew'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEditOfficeLicenseModal(item);
                                    }}
                                    className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-100"
                                    title="Edit License"
                                  >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openDeleteOfficeLicenseModal(item);
                                    }}
                                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100"
                                    title="Delete License"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div ref={officeUsersSectionRef} className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#2c3437]">
                    {selectedOfficeLicenseItem?.name || 'Selected License'}
                  </h3>
                  <p className="font-body text-sm text-[#596064]">
                    {selectedOfficeLicenseItem?.email || 'à¹€à¸˜Â„à¹€à¸˜à¸…à¹€à¸˜à¸”à¹€à¸˜Âà¹€à¸˜ÂŠà¹€à¸˜à¸—à¹€à¸™Âˆà¹€à¸˜à¸à¹€à¸˜Âˆà¹€à¸˜à¸’à¹€à¸˜Âà¹€à¸˜à¸ƒà¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸˜Âà¹€à¸˜à¸’à¹€à¸˜à¸ƒà¹€à¸˜â€à¹€à¸™Â‰à¹€à¸˜à¸’à¹€à¸˜Â™à¹€à¸˜Âšà¹€à¸˜Â™à¹€à¸™â‚¬à¹€à¸˜Âžà¹€à¸˜à¸—à¹€à¸™Âˆà¹€à¸˜à¸à¹€à¸˜â€à¹€à¸˜à¸™à¹€à¸˜à¸ƒà¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸˜ÂŠà¹€à¸˜à¸—à¹€à¸™Âˆà¹€à¸˜à¸à¹€à¸™Âƒà¹€à¸˜Â™à¹€à¸˜Âà¹€à¸˜à¸…à¹€à¸˜à¸˜à¹€à¸™Âˆà¹€à¸˜à¸à¹€à¸™â‚¬à¹€à¸˜â€à¹€à¸˜à¸•à¹€à¸˜à¸‚à¹€à¸˜à¸‡à¹€à¸˜Âà¹€à¸˜à¸‘à¹€à¸˜Â™'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">Key</div>
                    <div className="mt-1 font-semibold text-[#2c3437]">{selectedOfficeLicenseItem?.keyValue || '-'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">à¹€à¸˜à¸‹à¹€à¸˜à¸à¹€à¸˜â€à¹€à¸˜à¸à¹€à¸˜à¸’à¹€à¸˜à¸‚à¹€à¸˜à¸˜</div>
                    <div className="mt-1 font-semibold text-[#2c3437]">
                      {formatDisplayDate(selectedOfficeLicenseItem?.endDate || '')}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">Users</div>
                    <div className="mt-1 font-semibold text-[#2c3437]">{selectedOfficeLicenseItem?.userCount ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {selectedOfficeCurrentRecord ? (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-display text-lg font-bold text-[#2c3437]">Current License</h3>
                  <p className="font-body text-sm text-[#596064]">Shows the active Microsoft 365 license currently selected.</p>
                </div>
                {renderOfficeHistoryTable([selectedOfficeCurrentRecord])}
              </div>
            ) : null}

            {selectedOfficePastRecords.length ? (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-display text-lg font-bold text-[#2c3437]">License History</h3>
                  <p className="font-body text-sm text-[#596064]">Shows previous Microsoft 365 license records for the selected user or renewal chain.</p>
                </div>
                {renderOfficeHistoryTable(selectedOfficePastRecords)}
              </div>
            ) : null}

            {selectedOfficeGroupMembers.length > 0 ? (
              renderOfficeGroupMembersTable(selectedOfficeGroupMembers)
            ) : (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
                <p className="text-sm font-medium text-[#596064]">No grouped users found for this license.</p>
              </div>
            )}
          </section>
        )}
      </div>

      <input
        ref={autodeskPdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleAutodeskPdfUpload}
      />

      {isAutodeskPreviewOpen && selectedAutodeskRecord ? (
        <div className="fixed inset-0 z-[99985] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2c3437]/40 backdrop-blur-sm" onClick={closeAutodeskPreview} />
          <div className="relative flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/60 px-6 py-5">
              <div>
                <h3 className="font-display text-2xl font-extrabold text-[#2c3437]">Preview</h3>
                <p className="font-body text-sm text-[#596064]">{selectedAutodeskRecord.packet} - {selectedAutodeskRecord.user || '-'}</p>
              </div>
              <button
                type="button"
                onClick={closeAutodeskPreview}
                className="rounded-full p-2 text-[#596064] transition-colors hover:bg-[#edf1f4]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/40 bg-white/50 p-6 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h4 className="font-display text-lg font-bold text-[#2c3437]">PDF Preview</h4>
                      <p className="font-body text-sm text-[#596064]">Preview the PDF files attached to this license record.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedAutodeskPdfFiles.map((file, index) => (
                        <button
                          key={`${file.url}-${index}`}
                          type="button"
                          onClick={() => setSelectedAutodeskPdfIndex(index)}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                            selectedAutodeskPdfIndex === index
                              ? 'bg-[#27619d] text-white'
                              : 'bg-white/80 text-[#596064] hover:bg-white'
                          }`}
                        >
                          {file.name}
                        </button>
                      ))}
                      {isMasterAdmin ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openAutodeskPdfPicker(selectedAutodeskRecord.id, 'append')}
                            disabled={isUploadingAutodeskPdf || isUpdatingAutodeskPdf}
                            className="rounded-full bg-[#27619d] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1f4f80] disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {isUploadingAutodeskPdf && autodeskPdfUploadMode === 'append' ? 'Uploading...' : 'Upload PDF'}
                          </button>
                          {selectedAutodeskPdfFile ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openAutodeskPdfPicker(selectedAutodeskRecord.id, 'replace')}
                                disabled={isUploadingAutodeskPdf || isUpdatingAutodeskPdf}
                                className="rounded-full border border-[#f4c777] bg-[#fff4dc] px-4 py-2 text-sm font-bold text-[#9a6400] transition-colors hover:bg-[#ffefc9] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                {isUploadingAutodeskPdf && autodeskPdfUploadMode === 'replace' ? 'Replacing...' : 'Replace PDF'}
                              </button>
                              <button
                                type="button"
                                onClick={handleDeleteAutodeskPdf}
                                disabled={isUploadingAutodeskPdf || isUpdatingAutodeskPdf}
                                className="rounded-full border border-[#f2a0a0] bg-[#ffe3e3] px-4 py-2 text-sm font-bold text-[#b42318] transition-colors hover:bg-[#ffd2d2] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                {isUpdatingAutodeskPdf ? 'Deleting...' : 'Delete PDF'}
                              </button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-white/50 bg-slate-100">
                    {selectedAutodeskPdfFile ? (
                      <iframe
                        src={selectedAutodeskPdfFile.url}
                        title={selectedAutodeskPdfFile.name}
                        className="h-[360px] w-full border-0 bg-white"
                      />
                    ) : (
                      <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm font-medium text-[#596064]">
                        No PDF file has been attached to this license record yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/40 bg-white/50 p-6 shadow-sm">
                  <div className="mb-4">
                    <h4 className="font-display text-lg font-bold text-[#2c3437]">Autodesk License Details</h4>
                    <p className="font-body text-sm text-[#596064]">Review the full details of the selected Autodesk license record.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['License', selectedAutodeskRecord.packet],
                      ['Contract', selectedAutodeskRecord.contract],
                      ['Subscription ID', selectedAutodeskRecord.subscriptionId],
                      ['Term', selectedAutodeskRecord.term],
                      ['Manage', selectedAutodeskRecord.manage],
                      ['User', selectedAutodeskRecord.user],
                      ['Start', formatDisplayDate(selectedAutodeskRecord.startDate)],
                      ['End', formatDisplayDate(selectedAutodeskRecord.endDate)],
                      ['Company', selectedAutodeskRecord.company],
                      ['Vendor', selectedAutodeskRecord.vendor],
                      ['Source', selectedAutodeskRecord.sourceLabel],
                      ['PDF Files', String(selectedAutodeskPdfFiles.length)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">{label}</div>
                        <div className="mt-1 text-sm font-semibold text-[#2c3437]">{value || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {autodeskModalMode ? (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2c3437]/25 backdrop-blur-sm" onClick={closeAutodeskRenewModal} />
          <div className="relative w-full max-w-4xl rounded-3xl border border-white/60 bg-white/95 p-8 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-extrabold text-[#2c3437]">
                  {autodeskModalMode === 'add' ? 'Add Autodesk License' : 'Edit Autodesk License'}
                </h3>
                <p className="mt-2 font-body text-sm text-[#596064]">
                  {autodeskModalMode === 'add'
                    ? 'Add a new Autodesk license record to the License List.'
                    : 'Update the selected Autodesk license record details.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeAutodeskRenewModal}
                className="rounded-full p-2 text-[#596064] transition-colors hover:bg-[#edf1f4]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="grid gap-5 md:grid-cols-2" onSubmit={handleAutodeskRenewSubmit}>
              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">License</label>
                <input
                  type="text"
                  value={autodeskRenewForm.packet}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, packet: e.target.value }))}
                  disabled={autodeskModalMode === 'renew'}
                  className={`w-full rounded-2xl border border-white/50 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all ${
                    autodeskModalMode === 'renew'
                      ? 'bg-slate-100'
                      : 'bg-white/80 focus:border-[#9bc7eb] focus:bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Term</label>
                <input
                  type="text"
                  value={autodeskRenewForm.term}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, term: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Contract</label>
                <input
                  type="text"
                  value={autodeskRenewForm.contract}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, contract: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Subscription ID</label>
                <input
                  type="text"
                  value={autodeskRenewForm.subscriptionId}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, subscriptionId: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Manage</label>
                <input
                  type="text"
                  value={autodeskRenewForm.manage}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, manage: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">User</label>
                <input
                  type="text"
                  value={autodeskRenewForm.user}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, user: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Start</label>
                <input
                  type="date"
                  value={autodeskRenewForm.startDate}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">End</label>
                <input
                  type="date"
                  value={autodeskRenewForm.endDate}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Company</label>
                <input
                  type="text"
                  value={autodeskRenewForm.company}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, company: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Vendor</label>
                <input
                  type="text"
                  value={autodeskRenewForm.vendor}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Sale</label>
                <input
                  type="text"
                  value={autodeskRenewForm.sale}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, sale: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Tel.</label>
                <input
                  type="text"
                  value={autodeskRenewForm.tel}
                  onChange={(e) => setAutodeskRenewForm((prev) => ({ ...prev, tel: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAutodeskRenewModal}
                  disabled={isSavingAutodeskRenew}
                  className="rounded-full border border-white/50 bg-white px-5 py-2.5 text-sm font-bold text-[#596064] transition-colors hover:bg-[#edf1f4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAutodeskRenew}
                  className="rounded-full bg-[#27619d] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1f4f80] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingAutodeskRenew
                    ? 'Saving...'
                    : autodeskModalMode === 'add'
                      ? 'Save License'
                      : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {officeModalMode ? (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2c3437]/25 backdrop-blur-sm" onClick={closeOfficeLicenseModal} />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/60 bg-white/95 p-8 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-extrabold text-[#2c3437]">
                  {officeModalMode === 'add'
                    ? 'Add License'
                    : officeModalMode === 'renew'
                      ? 'Renew License'
                      : 'Edit License'}
                </h3>
                <p className="mt-2 font-body text-sm text-[#596064]">
                  {officeModalMode === 'add'
                    ? 'Add a new Microsoft 365 license record with key and expiry date.'
                    : officeModalMode === 'renew'
                      ? 'Update the key and expiry date for this license.'
                      : 'Edit the license name, key, and expiry date for this record.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeOfficeLicenseModal}
                className="rounded-full p-2 text-[#596064] transition-colors hover:bg-[#edf1f4]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleOfficeLicenseSubmit}>
              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Name</label>
                <input
                  type="text"
                  value={officeForm.name}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={officeModalMode === 'renew'}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white disabled:bg-slate-100"
                  placeholder="Enter the license holder name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Email</label>
                <input
                  type="text"
                  value={officeForm.email}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={officeModalMode === 'renew'}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white disabled:bg-slate-100"
                  placeholder="Enter the license holder email"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">License</label>
                <input
                  type="text"
                  value={officeForm.packet}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, packet: e.target.value }))}
                  disabled={officeModalMode === 'renew'}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                  placeholder="e.g. Microsoft 365 Family"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Color Group</label>
                <input
                  type="text"
                  value={officeForm.color}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, color: e.target.value }))}
                  disabled={officeModalMode === 'renew'}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white disabled:bg-slate-100"
                  placeholder="e.g. 14083324"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Key</label>
                <input
                  type="text"
                  value={officeForm.keyValue}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, keyValue: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                  placeholder="Enter license key"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Expiry Date</label>
                <input
                  type="date"
                  value={officeForm.endDate}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeOfficeLicenseModal}
                  disabled={isSavingOfficeLicense}
                  className="rounded-full border border-white/50 bg-white px-5 py-2.5 text-sm font-bold text-[#596064] transition-colors hover:bg-[#edf1f4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOfficeLicense}
                  className="rounded-full bg-[#27619d] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1f4f80] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingOfficeLicense
                    ? 'Saving...'
                    : officeModalMode === 'add'
                      ? 'Save License'
                      : officeModalMode === 'renew'
                        ? 'Save Renew'
                        : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {officeDeleteTarget ? (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#2c3437]/25 backdrop-blur-sm"
            onClick={() => (isDeletingOfficeLicense ? null : setOfficeDeleteTarget(null))}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/95 p-8 shadow-2xl">
            <h3 className="font-display text-2xl font-extrabold text-[#2c3437]">à¹€à¸˜à¸…à¹€à¸˜Âš License</h3>
            <p className="mt-3 font-body text-sm text-[#596064]">
              à¹€à¸˜â€¢à¹€à¸™Â‰à¹€à¸˜à¸à¹€à¸˜Â‡à¹€à¸˜Âà¹€à¸˜à¸’à¹€à¸˜à¸ƒà¹€à¸˜à¸…à¹€à¸˜Âš License à¹€à¸˜Â‚à¹€à¸˜à¸à¹€à¸˜Â‡ <span className="font-bold text-[#2c3437]">{officeDeleteTarget.name}</span> à¹€à¸™Âƒà¹€à¸˜ÂŠà¹€à¸™Âˆà¹€à¸˜à¸‹à¹€à¸˜à¸ƒà¹€à¸˜à¸—à¹€à¸˜à¸à¹€à¸™Â„à¹€à¸˜à¸à¹€à¸™Âˆ
            </p>
            <p className="mt-2 font-body text-xs text-[#7a8286]">
              à¹€à¸˜Âà¹€à¸˜à¸’à¹€à¸˜à¸ƒà¹€à¸˜à¸…à¹€à¸˜Âšà¹€à¸˜Âˆà¹€à¸˜à¸à¹€à¸˜à¸…à¹€à¸˜Âšà¹€à¸™â‚¬à¹€à¸˜Â‰à¹€à¸˜Âžà¹€à¸˜à¸’à¹€à¸˜à¸à¹€à¸˜Â‚à¹€à¸™Â‰à¹€à¸˜à¸à¹€à¸˜à¸à¹€à¸˜à¸™à¹€à¸˜à¸…à¹€à¸˜â€”à¹€à¸˜à¸•à¹€à¸™Âˆà¹€à¸˜Âšà¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜â€”à¹€à¸˜à¸–à¹€à¸˜Âà¹€à¸™Â„à¹€à¸˜à¸‡à¹€à¸™Â‰à¹€à¸™Âƒà¹€à¸˜Â™à¹€à¸˜à¸ƒà¹€à¸˜à¸à¹€à¸˜Âšà¹€à¸˜Âš à¹€à¸™Âà¹€à¸˜â€¢à¹€à¸™Âˆà¹€à¸˜Â‚à¹€à¸™Â‰à¹€à¸˜à¸à¹€à¸˜à¸à¹€à¸˜à¸™à¹€à¸˜à¸…à¹€à¸˜Âœà¹€à¸˜à¸™à¹€à¸™Â‰à¹€à¸™Âƒà¹€à¸˜ÂŠà¹€à¸™Â‰à¹€à¸˜Âˆà¹€à¸˜à¸’à¹€à¸˜Â Excel snapshot à¹€à¸˜Âˆà¹€à¸˜à¸à¹€à¸˜à¸‚à¹€à¸˜à¸‘à¹€à¸˜Â‡à¹€à¸˜à¸à¹€à¸˜à¸‚à¹€à¸˜à¸™à¹€à¸™Âˆ
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOfficeDeleteTarget(null)}
                disabled={isDeletingOfficeLicense}
                className="rounded-full border border-white/50 bg-white px-5 py-2.5 text-sm font-bold text-[#596064] transition-colors hover:bg-[#edf1f4] disabled:cursor-not-allowed disabled:opacity-60"
              >
                à¹€à¸˜à¸‚à¹€à¸˜Âà¹€à¸™â‚¬à¹€à¸˜à¸…à¹€à¸˜à¸”à¹€à¸˜Â
              </button>
              <button
                type="button"
                onClick={handleDeleteOfficeLicense}
                disabled={isDeletingOfficeLicense}
                className="rounded-full bg-[#c84b4b] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#b53c3c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingOfficeLicense ? 'à¹€à¸˜Âà¹€à¸˜à¸“à¹€à¸˜à¸…à¹€à¸˜à¸‘à¹€à¸˜Â‡à¹€à¸˜à¸…à¹€à¸˜Âš...' : 'à¹€à¸˜à¸‚à¹€à¸˜à¸—à¹€à¸˜Â™à¹€à¸˜à¸‚à¹€à¸˜à¸‘à¹€à¸˜Â™à¹€à¸˜Âà¹€à¸˜à¸’à¹€à¸˜à¸ƒà¹€à¸˜à¸…à¹€à¸˜Âš'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default License;

