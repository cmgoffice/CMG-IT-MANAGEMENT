import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
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

type AutodeskLicenseGroup = {
  packet: string;
  records: AutodeskLicenseRecord[];
  activeCount: number;
  warningCount: number;
  expiredCount: number;
};

const AUTODESK_RENEWAL_COLLECTION = 'licenseAutodeskRenewals';
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

const buildAutodeskRecords = (workbook: WorkbookData | null, renewRecords: AutodeskRenewRecord[]) => {
  const records: AutodeskLicenseRecord[] = [];

  workbook?.sheets
    .filter((sheet) => sheet.name === 'AutoCAD Revit LT Suite (2)')
    .forEach((sheet) => {
      const { headers, rows } = getAutodeskSheetRows(sheet);
      const packetIndex = findColumnIndex(headers, ['Packet', 'ชื่อโปรแกรม']);
      const contractIndex = findColumnIndex(headers, ['Contract']);
      const subscriptionIndex = findColumnIndex(headers, ['Subscription ID']);
      const termIndex = findColumnIndex(headers, ['term']);
      const manageIndex = findColumnIndex(headers, ['Manage', 'ผู้กำหนดสิทธ์']);
      const userIndex = findColumnIndex(headers, ['User', 'ผู้ถือลายเซ้น']);
      const startIndex = findColumnIndex(headers, ['Start', 'วันที่เริ่ม']);
      const endIndex = findColumnIndex(headers, ['End', 'สิ้นสุด']);
      const companyIndex = findColumnIndex(headers, ['Company', 'บริษัทใช้งาน']);
      const vendorIndex = findColumnIndex(headers, ['Vender', 'บริษัทที่ขาย']);
      const saleIndex = findColumnIndex(headers, ['Sale', 'ผู้ขาย']);
      const telIndex = findColumnIndex(headers, ['Tel.', 'เบอโทรศัพท์']);

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
  const [officeLicenseRecords, setOfficeLicenseRecords] = useState<OfficeLicenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAutodeskRenew, setIsSavingAutodeskRenew] = useState(false);
  const [isSavingOfficeLicense, setIsSavingOfficeLicense] = useState(false);
  const [isDeletingOfficeLicense, setIsDeletingOfficeLicense] = useState(false);
  const [selectedLicensePacket, setSelectedLicensePacket] = useState('');
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
        const counts = records.reduce(
          (summary, record) => {
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
          ...counts,
        };
      })
      .sort((left, right) => left.packet.localeCompare(right.packet, 'th'));
  }, [autodeskLicenseRecords]);

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

  const officePrimaryUsers = useMemo(
    () => officeDetailData?.primaryUsers.filter((user) => user.name) ?? [],
    [officeDetailData],
  );

  const officeLicenseItems = useMemo(() => {
    const itemMap = new Map<string, OfficeLicenseItem>();

    officePrimaryUsers.forEach((user) => {
      const matchingRecords = officeLicenseRecords
        .filter(
          (record) =>
            (normalizePacket(record.name) === normalizePacket(user.name) &&
              normalizePacket(record.email) === normalizePacket(user.email)) ||
            (!record.email && normalizePacket(record.name || record.packet) === normalizePacket(user.name)),
        )
        .sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left));
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

    officeLicenseRecords.forEach((record) => {
      const recordName = record.name || record.packet;
      const alreadyExists = Array.from(itemMap.values()).some(
        (item) =>
          normalizePacket(item.name) === normalizePacket(recordName) &&
          normalizePacket(item.email) === normalizePacket(record.email),
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
  }, [officeDetailData, officeLicenseRecords, officePrimaryUsers]);

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
      (user) =>
        normalizePacket(user.name) === normalizePacket(selectedOfficeLicenseItem.name) &&
        normalizePacket(user.email) === normalizePacket(selectedOfficeLicenseItem.email),
    );

    officeLicenseRecords
      .filter(
        (record) =>
          normalizePacket(record.name || record.packet) === normalizePacket(selectedOfficeLicenseItem.name) &&
          normalizePacket(record.email) === normalizePacket(selectedOfficeLicenseItem.email),
      )
      .sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left))
      .forEach((record, index) => {
        historyItems.push({
          id: record.id,
          name: record.name || selectedOfficeLicenseItem.name,
          email: record.email || selectedOfficeLicenseItem.email,
          packet: record.packet,
          keyValue: record.keyValue,
          endDate: record.endDate,
          color: record.color || selectedOfficeLicenseItem.color,
          sourceLabel: index === 0 ? 'Current Renew' : 'Renew History',
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
  }, [officeLicenseRecords, officePrimaryUsers, selectedOfficeLicenseItem]);

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
      alert('กรุณากรอก License, User, วันเริ่ม และวันหมดอายุให้ครบ');
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
      alert('บันทึกการ Renew ไม่สำเร็จ');
    } finally {
      setIsSavingAutodeskRenew(false);
    }
  };

  const renderAutodeskTable = (records: AutodeskLicenseRecord[]) => (
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
              {['License', 'Contract', 'Subscription ID', 'Term', 'Manage', 'User', 'Start', 'End', 'Company', 'Vendor', 'Status']
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
            {records.map((record) => {
              const status = getLicenseStatus(record.endDate);

              return (
                <tr
                  key={record.id}
                  className={`border-t border-white/40 align-top ${status.rowClassName || 'hover:bg-white/50'}`}
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
                      <span className={`h-2.5 w-2.5 rounded-full ${status.dotClassName}`} />
                      {status.label}
                    </span>
                  </td>
                  {isMasterAdmin ? (
                    <td className="whitespace-nowrap px-3 py-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => openAutodeskRenewModal(record)}
                        className="rounded-full border border-[#f4c777] bg-[#fff4dc] px-3 py-1 text-[11px] font-bold text-[#9a6400] transition-colors hover:bg-[#ffefc9]"
                      >
                        Renew
                      </button>
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

  const renderOfficeGroupMembersTable = (members: Office365GroupMember[]) => (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/35 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-auto text-left">
          <thead className="bg-white/60">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-bold tracking-wide text-[#596064]">ชื่อ</th>
              <th className="whitespace-nowrap px-4 py-3 text-xs font-bold tracking-wide text-[#596064]">อีเมล</th>
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
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">หมดอายุ</th>
              <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">บันทึกเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const status = getLicenseStatus(record.endDate);
              return (
                <tr key={record.id} className={`border-t border-white/40 ${status.rowClassName || 'hover:bg-white/50'}`}>
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
      alert('กรุณากรอกชื่อ, License, Key และวันหมดอายุให้ครบ');
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
      alert('มีรายการนี้อยู่แล้ว');
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
      alert('บันทึกข้อมูล License ไม่สำเร็จ');
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
      alert('ลบข้อมูล License ไม่สำเร็จ');
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
              หน้า License นี้แสดงข้อมูลจาก Excel snapshot และข้อมูลที่บันทึกเพิ่มในระบบ เพื่อให้ใช้งานได้ทันทีบนหน้าเว็บ
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
              <span className="font-bold">ทะเบียน Office 365 CMG</span>
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
            <p className="text-sm font-medium text-[#596064]">กำลังโหลดข้อมูลจาก Excel snapshot...</p>
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
                  {selectedAutodeskGroup?.records.length ?? autodeskLicenseRecords.length} licenses
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
                        เพิ่มรายการ
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
                            : item.expiredCount > 0
                              ? 'border-[#f2b5b5] bg-[#fff1f1] hover:bg-[#ffe8e8]'
                              : 'border-white/50 bg-white/60 hover:bg-white'
                        }`}
                      >
                        <div className="text-sm font-bold text-[#2c3437]">{item.packet}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {item.records.map((record) => {
                            const status = getLicenseStatus(record.endDate);
                            return (
                              <span
                                key={`${item.packet}-${record.id}`}
                                className={`h-2.5 w-2.5 rounded-full ${status.dotClassName}`}
                                title={`${record.user || item.packet} • ${status.label}`}
                              />
                            );
                          })}
                        </div>
                        <div className="mt-2 text-[11px] font-medium text-[#596064]">{item.records.length} licenses</div>
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
                      <p className="font-body text-sm text-[#596064]">แสดงรายการเดิมและประวัติ Renew ของ License นี้ในที่เดียว</p>
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

                {selectedAutodeskGroup ? renderAutodeskTable(selectedAutodeskGroup.records) : null}
              </>
            ) : (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
                <p className="text-sm font-medium text-[#596064]">ไม่พบข้อมูล Autodesk License</p>
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
                  <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#2c3437]">ทะเบียน Office 365 CMG</h2>
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
                  <p className="font-body text-sm text-[#596064]">เก็บ Key และวันหมดอายุ พร้อมจัดการรายการ License ได้จากหน้านี้</p>
                </div>

                {isMasterAdmin ? (
                  <button
                    type="button"
                    onClick={openAddOfficeLicenseModal}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#27619d] px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#1f4f80]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    เพิ่ม License
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
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">ชื่อ</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">อีเมล</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">License</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">Key</th>
                        <th className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]">หมดอายุ</th>
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
                            className={`border-t border-white/40 transition-colors ${
                              isActive ? 'bg-[#e8f5ff]/90' : status.rowClassName || 'hover:bg-white/50'
                            }`}
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold text-inherit">
                              <button
                                type="button"
                                onClick={() => handleSelectOfficeUser(item.id)}
                                className="text-left text-inherit underline-offset-2 transition-opacity hover:opacity-80 hover:underline"
                              >
                                {item.name || '-'}
                              </button>
                            </td>
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
                                    onClick={() => openRenewOfficeLicenseModal(item)}
                                    className="rounded-full border border-[#f4c777] bg-[#fff4dc] px-3 py-1 text-[11px] font-bold text-[#9a6400] transition-colors hover:bg-[#ffefc9]"
                                    title="Renew License"
                                  >
                                    Renew
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditOfficeLicenseModal(item)}
                                    className="rounded-lg p-2 text-amber-600 transition-colors hover:bg-amber-100"
                                    title="Edit License"
                                  >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDeleteOfficeLicenseModal(item)}
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
                    {selectedOfficeLicenseItem?.email || 'คลิกชื่อจากรายการด้านบนเพื่อดูรายชื่อในกลุ่มเดียวกัน'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">Key</div>
                    <div className="mt-1 font-semibold text-[#2c3437]">{selectedOfficeLicenseItem?.keyValue || '-'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#596064]">หมดอายุ</div>
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

            {selectedOfficeHistory.length ? (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-display text-lg font-bold text-[#2c3437]">Renew History</h3>
                  <p className="font-body text-sm text-[#596064]">ข้อมูลเก่าและข้อมูลที่ Renew จะถูกเก็บไว้ทั้งหมดในรายการนี้</p>
                </div>
                {renderOfficeHistoryTable(selectedOfficeHistory)}
              </div>
            ) : null}

            {selectedOfficeGroupMembers.length > 0 ? (
              renderOfficeGroupMembersTable(selectedOfficeGroupMembers)
            ) : (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
                <p className="text-sm font-medium text-[#596064]">ยังไม่มีรายชื่อในกลุ่มเดียวกันสำหรับรายการนี้</p>
              </div>
            )}
          </section>
        )}
      </div>

      {autodeskModalMode ? (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2c3437]/25 backdrop-blur-sm" onClick={closeAutodeskRenewModal} />
          <div className="relative w-full max-w-4xl rounded-3xl border border-white/60 bg-white/95 p-8 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-extrabold text-[#2c3437]">
                  {autodeskModalMode === 'add' ? 'เพิ่มรายการ Autodesk License' : 'Renew Autodesk License'}
                </h3>
                <p className="mt-2 font-body text-sm text-[#596064]">
                  {autodeskModalMode === 'add'
                    ? 'เพิ่มรายการใหม่เข้า License List ของ Autodesk'
                    : 'บันทึกรายการต่ออายุเป็นประวัติใหม่ โดยเก็บข้อมูลเดิมไว้เหมือนเดิม'}
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
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingAutodeskRenew}
                  className="rounded-full bg-[#27619d] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1f4f80] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingAutodeskRenew
                    ? 'กำลังบันทึก...'
                    : autodeskModalMode === 'add'
                      ? 'บันทึกรายการ'
                      : 'บันทึกการ Renew'}
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
                    ? 'เพิ่ม License'
                    : officeModalMode === 'renew'
                      ? 'Renew License'
                      : 'แก้ไข License'}
                </h3>
                <p className="mt-2 font-body text-sm text-[#596064]">
                  {officeModalMode === 'add'
                    ? 'เพิ่มรายการ License Microsoft 365 ใหม่พร้อม Key และวันหมดอายุ'
                    : officeModalMode === 'renew'
                      ? 'อัปเดต Key ใหม่และวันหมดอายุใหม่ของ License นี้'
                      : 'แก้ไขชื่อ License, Key และวันหมดอายุของรายการนี้'}
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
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">ชื่อ</label>
                <input
                  type="text"
                  value={officeForm.name}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={officeModalMode === 'renew'}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white disabled:bg-slate-100"
                  placeholder="กรอกชื่อผู้ถือ License"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">อีเมล</label>
                <input
                  type="text"
                  value={officeForm.email}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={officeModalMode === 'renew'}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white disabled:bg-slate-100"
                  placeholder="กรอกอีเมลผู้ถือ License"
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
                  placeholder="เช่น Microsoft 365 Family"
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
                  placeholder="เช่น 14083324"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">Key</label>
                <input
                  type="text"
                  value={officeForm.keyValue}
                  onChange={(e) => setOfficeForm((prev) => ({ ...prev, keyValue: e.target.value }))}
                  className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-sm text-[#2c3437] outline-none transition-all focus:border-[#9bc7eb] focus:bg-white"
                  placeholder="กรอก License Key"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[#2c3437]">วันหมดอายุ</label>
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
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingOfficeLicense}
                  className="rounded-full bg-[#27619d] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1f4f80] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingOfficeLicense
                    ? 'กำลังบันทึก...'
                    : officeModalMode === 'add'
                      ? 'บันทึก License'
                      : officeModalMode === 'renew'
                        ? 'บันทึกการ Renew'
                        : 'บันทึกการแก้ไข'}
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
            <h3 className="font-display text-2xl font-extrabold text-[#2c3437]">ลบ License</h3>
            <p className="mt-3 font-body text-sm text-[#596064]">
              ต้องการลบ License ของ <span className="font-bold text-[#2c3437]">{officeDeleteTarget.name}</span> ใช่หรือไม่
            </p>
            <p className="mt-2 font-body text-xs text-[#7a8286]">
              การลบจะลบเฉพาะข้อมูลที่บันทึกไว้ในระบบ แต่ข้อมูลผู้ใช้จาก Excel snapshot จะยังอยู่
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOfficeDeleteTarget(null)}
                disabled={isDeletingOfficeLicense}
                className="rounded-full border border-white/50 bg-white px-5 py-2.5 text-sm font-bold text-[#596064] transition-colors hover:bg-[#edf1f4] disabled:cursor-not-allowed disabled:opacity-60"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteOfficeLicense}
                disabled={isDeletingOfficeLicense}
                className="rounded-full bg-[#c84b4b] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#b53c3c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingOfficeLicense ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default License;
