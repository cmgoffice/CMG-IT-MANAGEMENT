import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ROOT_COLLECTION, ROOT_DOCUMENT } from '../lib/db';
import { useAuth, type UserProfile } from '../contexts/AuthContext';

type AssetStatus = string;
type AssetCategory = string;
type AssetSection = 'Computer' | 'Accessory';
type ActiveFilterSource = 'category' | 'accessory';

type AssetHistory = {
  date: string;
  action: string;
  detail: string;
};

type AssetItem = {
  docId: string;
  id: string;
  assetSection: AssetSection;
  name: string;
  spec: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  serial: string;
  user: string | null;
  userAvatar: string | null;
  status: AssetStatus;
  category: AssetCategory;
  make: string;
  model: string;
  processorType: string;
  ram: string;
  storageCapacity: string;
  operatingSystem: string;
  location: string;
  condition: string;
  warrantyExpiryDate: string;
  remark: string;
  healthScore?: number;
  history: AssetHistory[];
};

type AssetPayload = Omit<AssetItem, 'id' | 'docId'> & {
  requestedAssetId?: string;
};

type AssetFormState = {
  id: string;
  serial: string;
  user: string;
  status: AssetStatus;
  category: AssetCategory;
  make: string;
  model: string;
  processorType: string;
  ram: string;
  storageCapacity: string;
  operatingSystem: string;
  location: string;
  condition: string;
  warrantyExpiryDate: string;
  remark: string;
  healthScore: string;
};

type DropdownOptions = {
  categories: string[];
  ramOptions: string[];
  storageOptions: string[];
};

const statusStyles: Record<string, string> = {
  Active: 'bg-[#c7e7ff] text-[#36556a]',
  Repair: 'bg-[#fa746f] text-[#6e0a12]',
  Retired: 'bg-[#dce4e8]/80 text-[#596064]',
};

const categoryIconMap: Record<string, { icon: string; iconBg: string; iconColor: string }> = {
  Laptop:     { icon: 'laptop_mac',        iconBg: 'bg-[#86b9fb]/30',  iconColor: 'text-[#27619d]' },
  Monitor:    { icon: 'desktop_windows',   iconBg: 'bg-[#d4c8f9]/30',  iconColor: 'text-[#625983]' },
  Printer:    { icon: 'print',             iconBg: 'bg-[#dce4e8]/50',  iconColor: 'text-[#446378]' },
  Phone:      { icon: 'smartphone',        iconBg: 'bg-[#fde68a]/40',  iconColor: 'text-[#92400e]' },
  Mouse:      { icon: 'mouse',             iconBg: 'bg-[#cffafe]/60',  iconColor: 'text-[#0f766e]' },
  Keyboard:   { icon: 'keyboard',          iconBg: 'bg-[#e0e7ff]/60',  iconColor: 'text-[#3730a3]' },
  Tablet:     { icon: 'tablet_mac',        iconBg: 'bg-[#a7f3d0]/40',  iconColor: 'text-[#065f46]' },
  Server:     { icon: 'dns',               iconBg: 'bg-[#fca5a5]/30',  iconColor: 'text-[#7f1d1d]' },
  Network:    { icon: 'router',            iconBg: 'bg-[#6ee7b7]/30',  iconColor: 'text-[#064e3b]' },
  Storage:    { icon: 'storage',           iconBg: 'bg-[#fb923c]/20',  iconColor: 'text-[#7c2d12]' },
  Camera:     { icon: 'photo_camera',      iconBg: 'bg-[#f9a8d4]/30',  iconColor: 'text-[#831843]' },
  Projector:  { icon: 'connected_tv',      iconBg: 'bg-[#c4b5fd]/30',  iconColor: 'text-[#4c1d95]' },
  UPS:        { icon: 'battery_charging_full', iconBg: 'bg-[#bbf7d0]/40', iconColor: 'text-[#14532d]' },
  Peripheral: { icon: 'keyboard',         iconBg: 'bg-[#e0e7ff]/60',  iconColor: 'text-[#3730a3]' },
};

// Fallback palette for unknown categories (cycles through distinct hues)
const fallbackCategoryPalette: Array<{ iconBg: string; iconColor: string }> = [
  { iconBg: 'bg-[#86b9fb]/30',  iconColor: 'text-[#27619d]' },
  { iconBg: 'bg-[#d4c8f9]/30',  iconColor: 'text-[#625983]' },
  { iconBg: 'bg-[#fde68a]/40',  iconColor: 'text-[#92400e]' },
  { iconBg: 'bg-[#a7f3d0]/40',  iconColor: 'text-[#065f46]' },
  { iconBg: 'bg-[#fca5a5]/30',  iconColor: 'text-[#7f1d1d]' },
  { iconBg: 'bg-[#f9a8d4]/30',  iconColor: 'text-[#831843]' },
  { iconBg: 'bg-[#c4b5fd]/30',  iconColor: 'text-[#4c1d95]' },
  { iconBg: 'bg-[#fb923c]/20',  iconColor: 'text-[#7c2d12]' },
];

const getCategoryMeta = (cat: string): { icon: string; iconBg: string; iconColor: string } => {
  if (categoryIconMap[cat]) return categoryIconMap[cat];
  // Hash the category name to a palette index so the same name always gets the same color
  const hash = Array.from(cat).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const palette = fallbackCategoryPalette[hash % fallbackCategoryPalette.length];
  return { icon: 'devices', ...palette };
};

// Badge style for Category column — soft pill bg + matching text color
const categoryBadgeMap: Record<string, string> = {
  Laptop:     'bg-[#dbeafe] text-[#1e40af]',
  Monitor:    'bg-[#ede9fe] text-[#5b21b6]',
  Printer:    'bg-[#e2e8f0] text-[#334155]',
  Phone:      'bg-[#fef9c3] text-[#854d0e]',
  Mouse:      'bg-[#ccfbf1] text-[#115e59]',
  Keyboard:   'bg-[#e0e7ff] text-[#3730a3]',
  Tablet:     'bg-[#d1fae5] text-[#065f46]',
  Server:     'bg-[#fee2e2] text-[#7f1d1d]',
  Network:    'bg-[#ccfbf1] text-[#134e4a]',
  Storage:    'bg-[#ffedd5] text-[#7c2d12]',
  Camera:     'bg-[#fce7f3] text-[#831843]',
  Projector:  'bg-[#f3e8ff] text-[#4c1d95]',
  UPS:        'bg-[#dcfce7] text-[#14532d]',
  Peripheral: 'bg-[#e0e7ff] text-[#3730a3]',
};

const fallbackBadgePalette: string[] = [
  'bg-[#dbeafe] text-[#1e40af]',
  'bg-[#ede9fe] text-[#5b21b6]',
  'bg-[#fef9c3] text-[#854d0e]',
  'bg-[#d1fae5] text-[#065f46]',
  'bg-[#fee2e2] text-[#7f1d1d]',
  'bg-[#fce7f3] text-[#831843]',
  'bg-[#f3e8ff] text-[#4c1d95]',
  'bg-[#ffedd5] text-[#7c2d12]',
];

const getCategoryBadge = (cat: string): string => {
  if (categoryBadgeMap[cat]) return categoryBadgeMap[cat];
  const hash = Array.from(cat).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return fallbackBadgePalette[hash % fallbackBadgePalette.length];
};

const defaultCategories = ['Laptop', 'Monitor', 'Printer', 'Phone'];
const accessoryTypeOptions: AssetCategory[] = ['All Accessories', 'Mouse', 'Keyboard'];
const accessoryFormCategories: AssetCategory[] = ['Mouse', 'Keyboard'];
const accessoryCategories = new Set<AssetCategory>(['Mouse', 'Keyboard']);

const getAssetSection = (category: AssetCategory, assetSection?: string): AssetSection => {
  if (assetSection === 'Accessory' || assetSection === 'Computer') return assetSection;
  return accessoryCategories.has(category) ? 'Accessory' : 'Computer';
};

const getAssetFormContent = (category: AssetCategory) => {
  if (category === 'Mouse') {
    return {
      idPlaceholder: 'e.g. IT-MOU-001',
      serialPlaceholder: 'e.g. MSE-LOGI-MX3-001',
      sectionTitle: 'Mouse Specifications',
      makeLabel: 'Brand/Manufacturer',
      makePlaceholder: 'e.g. Logitech, Razer',
      modelLabel: 'Model',
      modelPlaceholder: 'e.g. MX Master 3S',
      processorLabel: 'Connection Type',
      processorPlaceholder: 'e.g. Wireless, Bluetooth, USB',
      ramLabel: 'DPI / Sensitivity',
      ramPlaceholder: 'e.g. 8000 DPI',
      storageLabel: 'Button Count',
      storagePlaceholder: 'e.g. 6 Buttons',
      operatingSystemLabel: 'Compatibility',
      operatingSystemPlaceholder: 'e.g. Windows, macOS',
    };
  }

  if (category === 'Keyboard') {
    return {
      idPlaceholder: 'e.g. IT-KBD-001',
      serialPlaceholder: 'e.g. KBD-LOGI-MXK-001',
      sectionTitle: 'Keyboard Specifications',
      makeLabel: 'Brand/Manufacturer',
      makePlaceholder: 'e.g. Logitech, Keychron',
      modelLabel: 'Model',
      modelPlaceholder: 'e.g. K8 Pro',
      processorLabel: 'Switch Type',
      processorPlaceholder: 'e.g. Red, Brown, Blue',
      ramLabel: 'Layout',
      ramPlaceholder: 'e.g. Full Size, TKL, 75%',
      storageLabel: 'Connection Type',
      storagePlaceholder: 'e.g. Wired, Bluetooth, 2.4GHz',
      operatingSystemLabel: 'Compatibility',
      operatingSystemPlaceholder: 'e.g. Windows, macOS',
    };
  }

  return {
    idPlaceholder: 'e.g. IT-LAP-025',
    serialPlaceholder: 'e.g. C02FX123GH67',
    sectionTitle: 'Hardware Specifications',
    makeLabel: 'Make/Manufacturer',
    makePlaceholder: 'e.g. Apple, Dell, HP',
    modelLabel: 'Model',
    modelPlaceholder: 'e.g. MacBook Pro 16"',
    processorLabel: 'Processor Type and Speed',
    processorPlaceholder: 'e.g. Intel i7 2.6GHz',
    ramLabel: 'RAM',
    ramPlaceholder: 'e.g. 16GB',
    storageLabel: 'Storage Capacity',
    storagePlaceholder: 'e.g. 512GB SSD',
    operatingSystemLabel: 'Operating System',
    operatingSystemPlaceholder: 'e.g. Windows 11, macOS',
  };
};

const defaultDropdownOptions: DropdownOptions = {
  categories: defaultCategories,
  ramOptions: ['4GB', '8GB', '16GB', '32GB', '64GB'],
  storageOptions: ['128GB SSD', '256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD', '1TB HDD', '2TB HDD'],
};

const defaultForm: AssetFormState = {
  id: '',
  serial: '',
  user: '',
  status: 'Active',
  category: 'Laptop',
  make: '',
  model: '',
  processorType: '',
  ram: '',
  storageCapacity: '',
  operatingSystem: '',
  location: '',
  condition: '',
  warrantyExpiryDate: '',
  remark: '',
  healthScore: '100',
};

const Asset = () => {
  const { userProfile } = useAuth();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilterSource, setActiveFilterSource] = useState<ActiveFilterSource>('category');
  const [category, setCategory] = useState('All Assets');
  const [accessoryType, setAccessoryType] = useState<AssetCategory>('All Accessories');
  const [status, setStatus] = useState('All Statuses');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [formData, setFormData] = useState<AssetFormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof AssetFormState, string>>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<AssetItem[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<DropdownOptions>(defaultDropdownOptions);
  const [usersList, setUsersList] = useState<Array<{ email: string; name: string; photoURL?: string }>>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddRam, setShowAddRam] = useState(false);
  const [showAddStorage, setShowAddStorage] = useState(false);
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [newRamValue, setNewRamValue] = useState('');
  const [newStorageValue, setNewStorageValue] = useState('');

  const pageSize = 20;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledHistoryKeyRef = useRef('');

  const isMasterAdmin = userProfile && (
    Array.isArray(userProfile.role)
      ? userProfile.role.includes('MasterAdmin')
      : userProfile.role === 'MasterAdmin'
  );

  const uniqueCategories = useMemo(() => {
    const cats = new Set([
      ...dropdownOptions.categories,
      ...assets
        .filter((a) => getAssetSection(a.category, a.assetSection) === 'Computer')
        .map((a) => a.category)
        .filter(Boolean),
    ]);
    return Array.from(cats).sort();
  }, [assets, dropdownOptions.categories]);

  const isAccessoryForm = accessoryCategories.has(formData.category);
  const formContent = getAssetFormContent(formData.category);
  const accessoryFilterValue = accessoryType;
  const formCategoryOptions = isAccessoryForm ? accessoryFormCategories : dropdownOptions.categories;
  const firstValidationError = Object.values(errors).find(Boolean);
  const defaultAddCategory = activeFilterSource === 'accessory'
    ? (accessoryType !== 'All Accessories' ? accessoryType : accessoryFormCategories[0])
    : (category !== 'All Assets' ? category : defaultForm.category);

  const filtered = useMemo(
    () =>
      assets.filter((a) => {
        const q = search.trim().toLowerCase();
        const matchSearch =
          q.length === 0 ||
          a.name.toLowerCase().includes(q) ||
          a.serial.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          (a.user ?? '').toLowerCase().includes(q);
        const assetSection = getAssetSection(a.category, a.assetSection);
        const matchCategory =
          activeFilterSource === 'accessory'
            ? (assetSection === 'Accessory' && (accessoryType === 'All Accessories' || a.category === accessoryType))
            : (assetSection === 'Computer' && (category === 'All Assets' || a.category === category));
        const matchStatus = status === 'All Statuses' || a.status === status;
        return matchSearch && matchCategory && matchStatus;
      }),
    [assets, search, activeFilterSource, category, accessoryType, status],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const loadAssets = async () => {
    const snap = await getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets'));
    const rows = snap.docs.map((d) => {
      const data = d.data() as AssetPayload;
      const resolvedCategory = data.category ?? '';
      return {
        ...data,
        docId: d.id,
        assetSection: getAssetSection(resolvedCategory, data.assetSection),
        id: data.requestedAssetId ?? d.id,
      } as AssetItem;
    });
    setAssets(rows);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'users'));
    const rows = snap.docs
      .map((d) => {
        const data = d.data() as UserProfile;
        return {
          email: data.email,
          name: `${data.firstName} ${data.lastName}`.trim() || data.email,
          photoURL: data.photoURL,
        };
      })
      .filter((u) => u.name);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    console.log('Loaded usersList:', rows.map((u) => ({ name: u.name, photoURL: u.photoURL })));
    setUsersList(rows);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const serial = searchParams.get('serial')?.trim();
    const shouldOpenHistory = searchParams.get('history') === '1';
    const historyKey = shouldOpenHistory && serial ? `${serial.toLowerCase()}::history` : '';

    if (!historyKey || handledHistoryKeyRef.current === historyKey || assets.length === 0) {
      return;
    }

    const matchedAsset = assets.find((asset) => asset.serial.trim().toLowerCase() === serial!.toLowerCase());
    if (!matchedAsset) {
      return;
    }

    handledHistoryKeyRef.current = historyKey;
    setSearch(serial!);
    setCategory('All Assets');
    setStatus('All Statuses');
    setCurrentPage(1);
    openHistoryModal(matchedAsset);
  }, [assets, searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, status, assets.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedAssets = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const openAddModal = (presetCategory: AssetCategory = defaultForm.category) => {
    setModalMode('add');
    setSelectedAsset(null);
    setFormData({ ...defaultForm, category: presetCategory });
    setErrors({});
    setShowAddCategory(false);
    setShowAddRam(false);
    setShowAddStorage(false);
    setShowFormModal(true);
  };

  const handleAccessoryFilter = (assetCategory: AssetCategory) => {
    setActiveFilterSource('accessory');
    setCategory('All Assets');
    setAccessoryType(assetCategory);
    setCurrentPage(1);
  };

  const openEditModal = (asset: AssetItem) => {
    setModalMode('edit');
    setSelectedAsset(asset);
    setFormData({
      id: asset.id,
      serial: asset.serial,
      user: asset.user ?? '',
      status: asset.status,
      category: asset.category,
      make: asset.make ?? '',
      model: asset.model ?? '',
      processorType: asset.processorType ?? '',
      ram: asset.ram ?? '',
      storageCapacity: asset.storageCapacity ?? '',
      operatingSystem: asset.operatingSystem ?? '',
      location: asset.location ?? '',
      condition: asset.condition ?? '',
      warrantyExpiryDate: asset.warrantyExpiryDate ?? '',
      remark: asset.remark ?? '',
      healthScore: String(asset.healthScore ?? 100),
    });
    setErrors({});
    setShowFormModal(true);
  };

  const openDeleteModal = (asset: AssetItem) => {
    setSelectedAsset(asset);
    setShowDeleteModal(true);
  };

  const openHistoryModal = (asset: AssetItem) => {
    setSelectedAsset(asset);
    setShowHistoryModal(true);
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    const serial = searchParams.get('serial');
    const shouldOpenHistory = searchParams.get('history') === '1';
    if (serial || shouldOpenHistory) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('serial');
      nextParams.delete('history');
      setSearchParams(nextParams);
    }
  };

  const handleFormChange = (field: keyof AssetFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const generateUniqueAssetId = (baseId: string) => {
    const trimmedBase = baseId.trim();
    const existingIds = new Set(assets.map((a) => a.id.toLowerCase()));
    let candidate = trimmedBase;
    let suffix = 1;
    while (existingIds.has(candidate.toLowerCase())) {
      candidate = `${trimmedBase}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof AssetFormState, string>> = {};
    if (!formData.status) nextErrors.status = 'Status is required.';
    if (!formData.category) nextErrors.category = 'Category is required.';
    if (
      formData.id.trim() &&
      modalMode === 'edit' &&
      assets.some((a) => a.id.toLowerCase() === formData.id.trim().toLowerCase() && a.docId !== selectedAsset?.docId)
    ) {
      nextErrors.id = 'Asset ID already exists.';
    }
    if (
      formData.serial.trim() &&
      assets.some(
        (a) => a.serial.toLowerCase() === formData.serial.trim().toLowerCase() && (modalMode === 'add' || a.docId !== selectedAsset?.docId),
      )
    ) {
      nextErrors.serial = 'Serial Number already exists.';
    }
    setErrors(nextErrors);
    return nextErrors;
  };

  const handleSaveAsset = async () => {
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      const modalElement = document.querySelector('[data-asset-form-modal="true"]');
      if (modalElement instanceof HTMLElement) {
        modalElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const iconMeta = categoryIconMap[formData.category] || { icon: 'devices', iconBg: 'bg-[#dce4e8]/50', iconColor: 'text-[#446378]' };
    const normalizedUser = formData.user.trim() || null;

    // Auto-generate name from make and model
    const autoName = [formData.make.trim(), formData.model.trim()].filter(Boolean).join(' ') || 'Unnamed Asset';
    
    // Auto-generate spec from processor, RAM, and storage
    const specParts = [formData.processorType.trim(), formData.ram.trim(), formData.storageCapacity.trim()].filter(Boolean);
    const autoSpec = specParts.length > 0 ? specParts.join(' / ') : 'No specification';

    const assetId = formData.id.trim();
    const finalDisplayAssetId = assetId ? generateUniqueAssetId(assetId) : '';
    const duplicateAssetIdResolved = modalMode === 'add' && !!assetId && finalDisplayAssetId !== assetId;
    const finalDocId = modalMode === 'add'
      ? (assetId ? finalDisplayAssetId : doc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets')).id)
      : (selectedAsset?.docId ?? selectedAsset?.id ?? doc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets')).id);
    const matchedUser = normalizedUser ? usersList.find((u) => u.name === normalizedUser) : undefined;
    console.log('Saving asset - matchedUser:', matchedUser, 'userAvatar:', matchedUser?.photoURL ?? null, 'finalDocId:', finalDocId);

    const previousUser = modalMode === 'edit' ? (selectedAsset?.user ?? null) : null;
    const userChanged = previousUser !== normalizedUser;
    const assignmentHistory: AssetHistory[] = [];
    if (userChanged && normalizedUser) {
      assignmentHistory.push({
        date: new Date().toLocaleString('sv-SE').replace('T', ' '),
        action: 'Assigned',
        detail: `Assigned to ${normalizedUser}${matchedUser?.email ? ` | Email: ${matchedUser.email}` : ''}${matchedUser?.photoURL ? ` | UserPhoto: ${matchedUser.photoURL}` : ''}`,
      });
    } else if (userChanged && !normalizedUser && previousUser) {
      assignmentHistory.push({
        date: new Date().toLocaleString('sv-SE').replace('T', ' '),
        action: 'Unassigned',
        detail: `Unassigned from ${previousUser}`,
      });
    }

    const payload: AssetPayload = {
      assetSection: getAssetSection(formData.category),
      name: autoName,
      spec: autoSpec,
      serial: formData.serial.trim(),
      user: normalizedUser,
      userAvatar: matchedUser?.photoURL ?? null,
      status: formData.status,
      category: formData.category,
      make: formData.make.trim(),
      model: formData.model.trim(),
      processorType: formData.processorType.trim(),
      ram: formData.ram.trim(),
      storageCapacity: formData.storageCapacity.trim(),
      operatingSystem: formData.operatingSystem.trim(),
      location: formData.location.trim(),
      condition: formData.condition.trim(),
      warrantyExpiryDate: formData.warrantyExpiryDate.trim(),
      remark: formData.remark.trim(),
      healthScore: parseInt(formData.healthScore) || 100,
      icon: iconMeta.icon,
      iconBg: iconMeta.iconBg,
      iconColor: iconMeta.iconColor,
      history:
        modalMode === 'add'
          ? [
              {
                date: new Date().toLocaleString('sv-SE').replace('T', ' '),
                action: 'Registered',
                detail: duplicateAssetIdResolved
                    ? `Asset ID "${assetId}" already existed. Assigned new Asset ID "${finalDisplayAssetId}".`
                    : 'Asset created from Asset page.',
              },
              ...assignmentHistory,
            ]
          : [
              ...(userChanged ? [] : [{ date: new Date().toLocaleString('sv-SE').replace('T', ' '), action: 'Updated', detail: 'Asset information updated.' }]),
              ...assignmentHistory,
              ...(selectedAsset?.history ?? []),
            ],
      requestedAssetId: modalMode === 'add' ? finalDisplayAssetId : assetId,
    };

    try {
      await setDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets', finalDocId), payload);
      setShowFormModal(false);
      setSelectedAsset(null);
      await loadAssets();
    } catch (err) {
      console.error('Error saving asset:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to save asset: ${message}`);
    }
  };

  const handleDeleteAsset = () => {
    if (!selectedAsset) return;
    void deleteDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets', selectedAsset.docId || selectedAsset.id)).then(async () => {
      setShowDeleteModal(false);
      setSelectedAsset(null);
      await loadAssets();
    });
  };

  const downloadTemplate = () => {
    const headers = [
      'Asset ID',
      'User',
      'Category',
      'Serial Number',
      'Make/Manufact',
      'Model',
      'Processor Type and Speed',
      'RAM',
      'Storage Capacity',
      'Operating System',
      'Location',
      'Condition',
      'Warranty Expiry Date',
      'Remark',
      'Status',
    ];

    const rows = assets.map((asset) => [
      asset.id,
      asset.user || '',
      asset.category,
      asset.serial,
      asset.make || '',
      asset.model || '',
      asset.processorType || '',
      asset.ram || '',
      asset.storageCapacity || '',
      asset.operatingSystem || '',
      asset.location || '',
      asset.condition || '',
      asset.warrantyExpiryDate || '',
      asset.remark || '',
      asset.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `asset-inventory-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        // Skip header row
        const dataLines = lines.slice(1);

        const parsedAssets: AssetItem[] = [];
        const errors: string[] = [];
        const skippedIds: string[] = [];
        const existingIds = new Set(assets.map((a) => a.id.toLowerCase()));

        dataLines.forEach((line, index) => {
          // Better CSV parsing that handles quoted fields with commas
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                current += '"';
                i++; // Skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim()); // Push last value
          
          const id = values[0];
          if (!id || !id.trim()) {
            errors.push(`Row ${index + 2}: Asset ID is required`);
            return;
          }

          const user = values[1] || '';
          const category = values[2] || '';
          const serial = values[3] || '';
          const make = values[4] || '';
          const model = values[5] || '';
          const processorType = values[6] || '';
          const ram = values[7] || '';
          const storageCapacity = values[8] || '';
          const operatingSystem = values[9] || '';
          const location = values[10] || '';
          const condition = values[11] || '';
          const warrantyExpiryDate = values[12] || '';
          const remark = values[13] || '';
          const status = values[14] || '';

          // Check for duplicate Asset ID
          if (existingIds.has(id.trim().toLowerCase())) {
            skippedIds.push(id.trim());
            return;
          }

          const categoryValue = category.trim() || 'Uncategorized';
          const statusValue = status.trim() || 'Active';

          const iconMeta = categoryIconMap[categoryValue] || { icon: 'devices', iconBg: 'bg-[#dce4e8]/50', iconColor: 'text-[#446378]' };
          const autoName = [make, model].filter(Boolean).join(' ') || 'Unnamed Asset';
          const specParts = [processorType, ram, storageCapacity].filter(Boolean);
          const autoSpec = specParts.length > 0 ? specParts.join(' / ') : 'No specification';

          parsedAssets.push({
            docId: id.trim(),
            id: id.trim(),
            assetSection: getAssetSection(categoryValue),
            name: autoName,
            spec: autoSpec,
            serial: serial.trim(),
            user: user.trim() || null,
            userAvatar: null,
            status: statusValue,
            category: categoryValue,
            make: make || '',
            model: model || '',
            processorType: processorType || '',
            ram: ram || '',
            storageCapacity: storageCapacity || '',
            operatingSystem: operatingSystem || '',
            location: location || '',
            condition: condition || '',
            warrantyExpiryDate: warrantyExpiryDate || '',
            remark: remark || '',
            icon: iconMeta.icon,
            iconBg: iconMeta.iconBg,
            iconColor: iconMeta.iconColor,
            history: [
              {
                date: new Date().toLocaleString('sv-SE').replace('T', ' '),
                action: 'Imported',
                detail: 'Asset imported from CSV file.',
              },
            ],
          });
        });

        // Add info about skipped duplicates
        if (skippedIds.length > 0) {
          errors.push(`Skipped ${skippedIds.length} duplicate Asset ID(s): ${skippedIds.slice(0, 5).join(', ')}${skippedIds.length > 5 ? '...' : ''}`);
        }

        setImportPreview(parsedAssets);
        setImportErrors(errors);
      } catch (error) {
        setImportErrors(['Failed to parse CSV file: ' + (error as Error).message]);
      }
    };
    reader.readAsText(file);
  };

  const handleImportAssets = async () => {
    if (importPreview.length === 0) return;

    try {
      const promises = importPreview.map((asset) => {
        const { docId, id, ...data } = asset;
        return setDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets', docId), {
          ...data,
          requestedAssetId: id,
        });
      });

      await Promise.all(promises);
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview([]);
      setImportErrors([]);
      await loadAssets();
    } catch (error) {
      setImportErrors(['Failed to import assets: ' + (error as Error).message]);
    }
  };

  const handleAddCategory = () => {
    if (newCategoryValue.trim() && !dropdownOptions.categories.includes(newCategoryValue.trim())) {
      setDropdownOptions((prev) => ({
        ...prev,
        categories: [...prev.categories, newCategoryValue.trim()],
      }));
      setNewCategoryValue('');
      setShowAddCategory(false);
    }
  };

  const handleDeleteCategory = (category: string) => {
    if (dropdownOptions.categories.length > 1) {
      setDropdownOptions((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c !== category),
      }));
    }
  };

  const handleAddRam = () => {
    if (newRamValue.trim() && !dropdownOptions.ramOptions.includes(newRamValue.trim())) {
      setDropdownOptions((prev) => ({
        ...prev,
        ramOptions: [...prev.ramOptions, newRamValue.trim()],
      }));
      setNewRamValue('');
      setShowAddRam(false);
    }
  };

  const handleDeleteRam = (ram: string) => {
    if (dropdownOptions.ramOptions.length > 1) {
      setDropdownOptions((prev) => ({
        ...prev,
        ramOptions: prev.ramOptions.filter((r) => r !== ram),
      }));
    }
  };

  const handleAddStorage = () => {
    if (newStorageValue.trim() && !dropdownOptions.storageOptions.includes(newStorageValue.trim())) {
      setDropdownOptions((prev) => ({
        ...prev,
        storageOptions: [...prev.storageOptions, newStorageValue.trim()],
      }));
      setNewStorageValue('');
      setShowAddStorage(false);
    }
  };

  const handleDeleteStorage = (storage: string) => {
    if (dropdownOptions.storageOptions.length > 1) {
      setDropdownOptions((prev) => ({
        ...prev,
        storageOptions: prev.storageOptions.filter((s) => s !== storage),
      }));
    }
  };

  return (
    <div className="pt-8 pb-12 px-8 min-h-screen relative z-10">
      <div className="max-w-[95%] mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#2c3437] mb-2 font-display">Asset Inventory</h1>
            <p className="text-[#596064] max-w-lg font-body">
              Manage and track your organization's digital and physical infrastructure with architectural precision.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747c80] group-focus-within:text-[#27619d] transition-colors text-[20px]">
                search
              </span>
              <input
                className="pl-10 pr-4 py-2 bg-white/40 backdrop-blur-md border border-white/40 rounded-lg focus:ring-2 focus:ring-[#27619d]/20 focus:bg-white transition-all text-sm w-56 shadow-sm font-body outline-none"
                placeholder="Search by ID, serial, name, user..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-white/60 text-[#27619d] px-4 py-2 rounded-lg font-semibold text-sm border border-[#27619d]/20 hover:bg-white transition-colors active:scale-[0.98] font-body"
              title="Download CSV Template"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Template
            </button>
            {isMasterAdmin && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 bg-[#625983] text-[#f8f8ff] px-4 py-2 rounded-lg font-semibold text-sm shadow-lg shadow-[#625983]/20 hover:opacity-90 transition-opacity active:scale-[0.98] font-body"
                  title="Import from CSV"
                >
                  <span className="material-symbols-outlined text-sm">upload</span>
                  Import
                </button>
                <button
                  onClick={() => openAddModal(defaultAddCategory)}
                  className="flex items-center gap-2 bg-[#27619d] text-[#f8f8ff] px-4 py-2 rounded-lg font-semibold text-sm shadow-lg shadow-[#27619d]/20 hover:opacity-90 transition-opacity active:scale-[0.98] font-body"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  New Asset
                </button>
              </>
            )}
          </div>
        </header>

        <section className="flex flex-wrap gap-3 mb-8">
          <div className="inline-flex w-fit shrink-0 items-center gap-2 bg-white/40 backdrop-blur-md px-3 py-2 rounded-full text-sm font-medium text-[#596064] border border-white/50 shadow-sm">
            <span className="material-symbols-outlined text-lg">filter_list</span>
            Category:
            <select
              className="w-auto min-w-0 bg-transparent border-none p-0 pr-1 text-[#27619d] font-bold focus:ring-0 cursor-pointer outline-none text-sm"
              value={category}
              onChange={(e) => {
                setActiveFilterSource('category');
                setAccessoryType('All Accessories');
                setCategory(e.target.value);
              }}
            >
              <option value="All Assets">All Assets</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="inline-flex w-fit shrink-0 items-center gap-2 bg-white/40 backdrop-blur-md px-3 py-2 rounded-full text-sm font-medium text-[#596064] border border-white/50 shadow-sm">
            Status:
            <select
              className="w-auto min-w-0 bg-transparent border-none p-0 pr-1 text-[#27619d] font-bold focus:ring-0 cursor-pointer outline-none text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>All Statuses</option>
              <option>Active</option>
              <option>Repair</option>
              <option>Retired</option>
            </select>
          </div>
          <div className="inline-flex w-fit shrink-0 items-center gap-2 bg-white/40 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium text-[#596064] border border-white/50 shadow-sm">
            <span className="material-symbols-outlined text-lg">inventory_2</span>
            Accessory:
            <div className="relative inline-flex w-fit items-center">
              <select
                className="w-auto min-w-0 appearance-none bg-transparent border-none p-0 pr-7 text-[#27619d] font-bold focus:ring-0 cursor-pointer outline-none text-sm"
                value={accessoryFilterValue}
                onChange={(e) => handleAccessoryFilter(e.target.value)}
              >
                {accessoryTypeOptions.map((assetCategory) => (
                  <option key={assetCategory} value={assetCategory}>
                    {assetCategory}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-1 material-symbols-outlined text-[18px] text-[#27619d]">
                expand_more
              </span>
            </div>
          </div>
        </section>

        <div className="bg-white/40 backdrop-blur-[16px] border border-white/40 rounded-2xl overflow-hidden shadow-xl shadow-blue-900/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/40">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#596064] font-body">Asset Detail</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#596064] font-body">Category</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#596064] font-body">Serial Number</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#596064] font-body">Assigned User</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#596064] font-body">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-[#596064] font-body text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-[#596064] font-body">
                      No assets found.
                    </td>
                  </tr>
                )}
                {paginatedAssets.map((asset) => (
                  <tr key={asset.docId} className="group hover:bg-white/60 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        {(() => {
                          const meta = getCategoryMeta(asset.category);
                          return (
                            <div className={`w-12 h-12 rounded-lg ${meta.iconBg} flex items-center justify-center ${meta.iconColor} border border-white/50 shadow-sm`}>
                              <span className="material-symbols-outlined">{meta.icon}</span>
                            </div>
                          );
                        })()}
                        <div>
                          <button
                            className="font-display font-bold text-sm text-[#27619d] hover:underline cursor-pointer text-left bg-transparent border-none p-0"
                            onClick={() => navigate('/equipment', { state: { assetId: asset.id || asset.docId } })}
                          >
                            {[asset.id, asset.name].filter(Boolean).join(' ')}
                          </button>
                          <div className="text-xs text-[#596064] font-body">{asset.spec}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold font-body ${getCategoryBadge(asset.category)}`}>
                        {asset.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-mono text-sm text-[#596064]">{asset.serial}</td>
                    <td className="px-6 py-5">
                      {asset.user ? (
                        <div className="flex items-center gap-2">
                          {asset.userAvatar ? (
                            <img 
                              alt={asset.user} 
                              className="w-10 h-10 rounded-full border border-white shadow-sm object-cover" 
                              src={asset.userAvatar} 
                              onError={(e) => {
                                console.log('Avatar load failed for', asset.user, 'url:', asset.userAvatar);
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(asset.user || '')}&background=c7e7ff&color=27619d&size=40`;
                              }}
                            />
                          ) : (
                            <img 
                              alt={asset.user} 
                              className="w-10 h-10 rounded-full border border-white shadow-sm object-cover" 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(asset.user || '')}&background=c7e7ff&color=27619d&size=40`} 
                            />
                          )}
                          <span className="text-sm font-medium font-body whitespace-nowrap">{asset.user}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-[#747c80] font-body">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-white/20 shadow-sm ${statusStyles[asset.status] || 'bg-[#dce4e8]/80 text-[#596064]'}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {isMasterAdmin && (
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openHistoryModal(asset)} className="p-2 text-[#27619d] hover:bg-blue-100 rounded-lg transition-colors" title="View History">
                            <span className="material-symbols-outlined text-sm">history</span>
                          </button>
                          <button onClick={() => openEditModal(asset)} className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors" title="Edit Asset">
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button onClick={() => openDeleteModal(asset)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Delete Asset">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#596064] font-body font-bold tracking-wider uppercase opacity-70">
            Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} filtered assets
          </div>
          <div className="flex gap-2">
            <button
              className="p-2 rounded-lg bg-white/40 border border-white/50 hover:bg-white/80 transition-colors disabled:opacity-30 shadow-sm"
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
                  className={`px-4 py-1.5 rounded-lg text-xs border transition-colors shadow-sm ${
                    currentPage === page
                      ? 'bg-[#27619d] text-[#f8f8ff] font-bold border-[#27619d]'
                      : 'bg-white/40 hover:bg-white text-[#2c3437] font-medium border-white/50'
                  }`}
                >
                  {page}
                </button>
              )
            ))}
            <button
              className="p-2 rounded-lg bg-white/40 border border-white/50 hover:bg-white/80 transition-colors disabled:opacity-30 shadow-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </footer>
      </div>

      {showFormModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-[#2c3437]/20 backdrop-blur-sm" onClick={() => setShowFormModal(false)} />
          <div data-asset-form-modal="true" className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 w-full max-w-6xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-extrabold text-[#2c3437] tracking-tight font-display">
                {modalMode === 'add' ? 'Register New Asset' : `Edit ${selectedAsset?.id || selectedAsset?.name || 'Asset'}`}
              </h2>
              <button onClick={() => setShowFormModal(false)} className="p-2 rounded-full hover:bg-[#eaeff2] transition-colors">
                <span className="material-symbols-outlined text-[#596064]">close</span>
              </button>
            </div>

            {firstValidationError && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {firstValidationError}
              </div>
            )}

            <div className="space-y-8">
              {/* Section 1: Basic Information */}
              <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-[#27619d] text-white flex items-center justify-center text-xs font-bold shadow-md shadow-[#27619d]/20">1</div>
                  <h3 className="text-sm font-bold text-[#27619d] uppercase tracking-wider font-body">Basic Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Asset ID</label>
                    <input 
                      type="text" 
                      placeholder={formContent.idPlaceholder}
                      value={formData.id} 
                      onChange={(e) => handleFormChange('id', e.target.value)} 
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium" 
                    />
                    {errors.id && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.id}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Assigned User</label>
                    <select
                      value={formData.user}
                      onChange={(e) => handleFormChange('user', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    >
                      <option value="">Unassigned</option>
                      {usersList.map((u) => (
                        <option key={u.email} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Serial Number</label>
                    <input
                      type="text"
                      placeholder={formContent.serialPlaceholder}
                      value={formData.serial}
                      onChange={(e) => handleFormChange('serial', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                    {errors.serial && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.serial}</p>}
                  </div>
                </div>
              </div>

              {/* Section 2: Category & Classification */}
              <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-[#27619d] text-white flex items-center justify-center text-xs font-bold shadow-md shadow-[#27619d]/20">2</div>
                  <h3 className="text-sm font-bold text-[#27619d] uppercase tracking-wider font-body">
                    {isAccessoryForm ? 'Accessory Type & Classification' : 'Category & Classification'}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">
                      {isAccessoryForm ? 'Accessory Type' : 'Category'} <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 items-center">
                      <select
                        value={formData.category}
                        onChange={(e) => handleFormChange('category', e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                      >
                        {formCategoryOptions.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {!isAccessoryForm && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowAddCategory(!showAddCategory)}
                            className="w-10 h-10 flex items-center justify-center bg-[#c7e7ff]/50 text-[#155590] rounded-xl hover:bg-[#c7e7ff] transition-colors border border-white/50 shadow-sm"
                            title="Add Category"
                          >
                            <span className="material-symbols-outlined text-base">add</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(formData.category)}
                            disabled={dropdownOptions.categories.length <= 1}
                            className="w-10 h-10 flex items-center justify-center bg-[#fa746f]/20 text-[#a83836] rounded-xl hover:bg-[#fa746f]/40 transition-colors border border-white/50 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete Current Category"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                    {showAddCategory && !isAccessoryForm && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          placeholder="New category name"
                          value={newCategoryValue}
                          onChange={(e) => setNewCategoryValue(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                          className="flex-1 px-3 py-2 bg-white/80 rounded-lg border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 text-xs outline-none font-body shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="px-4 py-2 bg-[#27619d] text-white rounded-lg hover:opacity-90 text-xs font-bold shadow-sm transition-opacity"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCategory(false);
                            setNewCategoryValue('');
                          }}
                          className="px-4 py-2 bg-white/80 border border-white/60 text-[#596064] rounded-lg hover:bg-white text-xs font-bold shadow-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {errors.category && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.category}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleFormChange('status', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    >
                      <option>Active</option>
                      <option>Repair</option>
                      <option>Retired</option>
                    </select>
                    {errors.status && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.status}</p>}
                  </div>
                </div>
              </div>

              {/* Section 3: Hardware Specifications */}
              <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-[#27619d] text-white flex items-center justify-center text-xs font-bold shadow-md shadow-[#27619d]/20">3</div>
                  <h3 className="text-sm font-bold text-[#27619d] uppercase tracking-wider font-body">{formContent.sectionTitle}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">{formContent.makeLabel}</label>
                    <input
                      type="text"
                      placeholder={formContent.makePlaceholder}
                      value={formData.make}
                      onChange={(e) => handleFormChange('make', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">{formContent.modelLabel}</label>
                    <input
                      type="text"
                      placeholder={formContent.modelPlaceholder}
                      value={formData.model}
                      onChange={(e) => handleFormChange('model', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">{formContent.processorLabel}</label>
                    <input
                      type="text"
                      placeholder={formContent.processorPlaceholder}
                      value={formData.processorType}
                      onChange={(e) => handleFormChange('processorType', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">{formContent.ramLabel}</label>
                    {isAccessoryForm ? (
                      <input
                        type="text"
                        placeholder={formContent.ramPlaceholder}
                        value={formData.ram}
                        onChange={(e) => handleFormChange('ram', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                      />
                    ) : (
                      <>
                        <div className="flex gap-2 items-center">
                          <select
                            value={formData.ram}
                            onChange={(e) => handleFormChange('ram', e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                          >
                            <option value="">Select RAM</option>
                            {dropdownOptions.ramOptions.map((ram) => (
                              <option key={ram} value={ram}>{ram}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowAddRam(!showAddRam)}
                            className="w-10 h-10 flex items-center justify-center bg-[#c7e7ff]/50 text-[#155590] rounded-xl hover:bg-[#c7e7ff] transition-colors border border-white/50 shadow-sm"
                            title="Add RAM Option"
                          >
                            <span className="material-symbols-outlined text-base">add</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRam(formData.ram)}
                            disabled={dropdownOptions.ramOptions.length <= 1 || !formData.ram}
                            className="w-10 h-10 flex items-center justify-center bg-[#fa746f]/20 text-[#a83836] rounded-xl hover:bg-[#fa746f]/40 transition-colors border border-white/50 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete Current RAM"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                        {showAddRam && (
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. 128GB"
                              value={newRamValue}
                              onChange={(e) => setNewRamValue(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddRam()}
                              className="flex-1 px-3 py-2 bg-white/80 rounded-lg border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 text-xs outline-none font-body shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={handleAddRam}
                              className="px-4 py-2 bg-[#27619d] text-white rounded-lg hover:opacity-90 text-xs font-bold shadow-sm transition-opacity"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddRam(false);
                                setNewRamValue('');
                              }}
                              className="px-4 py-2 bg-white/80 border border-white/60 text-[#596064] rounded-lg hover:bg-white text-xs font-bold shadow-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">{formContent.storageLabel}</label>
                    {isAccessoryForm ? (
                      <input
                        type="text"
                        placeholder={formContent.storagePlaceholder}
                        value={formData.storageCapacity}
                        onChange={(e) => handleFormChange('storageCapacity', e.target.value)}
                        className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                      />
                    ) : (
                      <>
                        <div className="flex gap-2 items-center">
                          <select
                            value={formData.storageCapacity}
                            onChange={(e) => handleFormChange('storageCapacity', e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                          >
                            <option value="">Select Storage</option>
                            {dropdownOptions.storageOptions.map((storage) => (
                              <option key={storage} value={storage}>{storage}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowAddStorage(!showAddStorage)}
                            className="w-10 h-10 flex items-center justify-center bg-[#c7e7ff]/50 text-[#155590] rounded-xl hover:bg-[#c7e7ff] transition-colors border border-white/50 shadow-sm"
                            title="Add Storage Option"
                          >
                            <span className="material-symbols-outlined text-base">add</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStorage(formData.storageCapacity)}
                            disabled={dropdownOptions.storageOptions.length <= 1 || !formData.storageCapacity}
                            className="w-10 h-10 flex items-center justify-center bg-[#fa746f]/20 text-[#a83836] rounded-xl hover:bg-[#fa746f]/40 transition-colors border border-white/50 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete Current Storage"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                        {showAddStorage && (
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              placeholder="e.g. 4TB SSD"
                              value={newStorageValue}
                              onChange={(e) => setNewStorageValue(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleAddStorage()}
                              className="flex-1 px-3 py-2 bg-white/80 rounded-lg border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 text-xs outline-none font-body shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={handleAddStorage}
                              className="px-4 py-2 bg-[#27619d] text-white rounded-lg hover:opacity-90 text-xs font-bold shadow-sm transition-opacity"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddStorage(false);
                                setNewStorageValue('');
                              }}
                              className="px-4 py-2 bg-white/80 border border-white/60 text-[#596064] rounded-lg hover:bg-white text-xs font-bold shadow-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">{formContent.operatingSystemLabel}</label>
                    <input
                      type="text"
                      placeholder={formContent.operatingSystemPlaceholder}
                      value={formData.operatingSystem}
                      onChange={(e) => handleFormChange('operatingSystem', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Location & Condition */}
              <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-[#27619d] text-white flex items-center justify-center text-xs font-bold shadow-md shadow-[#27619d]/20">4</div>
                  <h3 className="text-sm font-bold text-[#27619d] uppercase tracking-wider font-body">Location & Condition</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Office Floor 3"
                      value={formData.location}
                      onChange={(e) => handleFormChange('location', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Condition</label>
                    <input
                      type="text"
                      placeholder="e.g. Excellent, Good, Fair"
                      value={formData.condition}
                      onChange={(e) => handleFormChange('condition', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Health Score</label>
                    <input
                      type="number"
                      min={40}
                      max={100}
                      placeholder="40-100"
                      value={formData.healthScore}
                      onChange={(e) => handleFormChange('healthScore', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Warranty Expiry Date</label>
                    <input
                      type="date"
                      value={formData.warrantyExpiryDate}
                      onChange={(e) => handleFormChange('warrantyExpiryDate', e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Additional Information */}
              <div className="bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-full bg-[#27619d] text-white flex items-center justify-center text-xs font-bold shadow-md shadow-[#27619d]/20">5</div>
                  <h3 className="text-sm font-bold text-[#27619d] uppercase tracking-wider font-body">Additional Information</h3>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wide text-[#596064] mb-2 block font-body uppercase">Remark</label>
                  <textarea
                    placeholder="Additional notes or comments..."
                    value={formData.remark}
                    onChange={(e) => handleFormChange('remark', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white/80 rounded-xl border border-white/60 focus:border-[#86b9fb] focus:ring-2 focus:ring-[#86b9fb]/20 transition-all text-sm outline-none font-body text-[#2c3437] shadow-sm font-medium resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t border-white/60">
              <button 
                onClick={() => setShowFormModal(false)} 
                className="flex-1 py-3.5 rounded-xl border border-white/60 text-[#27619d] bg-white/50 hover:bg-white font-bold text-sm transition-colors shadow-sm font-body"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAsset} 
                className="flex-1 py-3.5 rounded-xl bg-[#27619d] text-[#f8f8ff] font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-[#27619d]/20 font-body"
              >
                {modalMode === 'add' ? 'Register Asset' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && selectedAsset && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-[#2c3437]/20 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white/90 rounded-2xl border border-white/60 w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-extrabold text-[#2c3437] font-display mb-2">Delete Asset</h2>
            <p className="text-sm text-[#596064] font-body mb-6">Confirm delete for <span className="font-bold">{selectedAsset.name}</span> ({selectedAsset.id})?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/40 text-[#27619d] font-bold text-sm hover:bg-[#eaeff2] transition-colors font-body">Cancel</button>
              <button onClick={handleDeleteAsset} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-600/20 hover:opacity-90 transition-opacity font-body">Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showHistoryModal && selectedAsset && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-[#2c3437]/20 backdrop-blur-sm" onClick={closeHistoryModal} />
          <div className="relative bg-white/90 rounded-2xl border border-white/60 w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-extrabold text-[#2c3437] font-display">History - {selectedAsset.id}</h2>
              <button onClick={closeHistoryModal} className="p-2 rounded-full hover:bg-[#eaeff2] transition-colors"><span className="material-symbols-outlined text-[#596064]">close</span></button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {selectedAsset.history.length === 0 && <p className="text-sm text-[#596064] font-body">No history found.</p>}
              {selectedAsset.history.map((event, index) => (
                <div key={`${event.date}-${index}`} className="bg-white/70 border border-white/70 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs uppercase tracking-wider font-bold text-[#27619d]">{event.action}</span>
                    <span className="text-xs text-[#596064]">{event.date}</span>
                  </div>
                  <p className="text-sm text-[#2c3437] font-body">{event.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showImportModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-[#2c3437]/20 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />
          <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 w-full max-w-5xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold text-[#2c3437] tracking-tight font-display">Import Assets from CSV</h2>
              <button onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview([]);
                setImportErrors([]);
              }} className="p-2 rounded-full hover:bg-[#eaeff2] transition-colors">
                <span className="material-symbols-outlined text-[#596064]">close</span>
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-blue-600 text-xl">info</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-blue-900 mb-2 text-sm">CSV Format Requirements:</h3>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>First row must contain headers (will be ignored during import)</li>
                      <li>Required columns: Asset ID, Serial Number</li>
                      <li>Computer categories: Laptop, Monitor, Printer, or Phone</li>
                      <li>Accessory types: Mouse or Keyboard</li>
                      <li>Status must be: Active, Repair, or Retired</li>
                      <li><strong>Duplicate Asset IDs will be automatically skipped</strong></li>
                      <li>Download the template to see the correct format with current data</li>
                    </ul>
                  </div>
                </div>
              </div>

              <label className="block">
                <div className="flex items-center justify-center w-full h-32 px-4 transition bg-white/60 border-2 border-[#27619d] border-dashed rounded-xl appearance-none cursor-pointer hover:bg-white focus:outline-none">
                  <div className="flex flex-col items-center space-y-2">
                    <span className="material-symbols-outlined text-4xl text-[#27619d]">upload_file</span>
                    <span className="font-medium text-[#27619d]">
                      {importFile ? importFile.name : 'Click to select CSV file or drag and drop'}
                    </span>
                    <span className="text-xs text-[#596064]">CSV files only</span>
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

            {importErrors.length > 0 && (
              <div className={`mb-6 ${importErrors.some(e => e.includes('Skipped')) && importErrors.length === 1 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} border rounded-xl p-4`}>
                <div className="flex items-start gap-3">
                  <span className={`material-symbols-outlined ${importErrors.some(e => e.includes('Skipped')) && importErrors.length === 1 ? 'text-yellow-600' : 'text-red-600'} text-xl`}>
                    {importErrors.some(e => e.includes('Skipped')) && importErrors.length === 1 ? 'warning' : 'error'}
                  </span>
                  <div className="flex-1">
                    <h3 className={`font-bold ${importErrors.some(e => e.includes('Skipped')) && importErrors.length === 1 ? 'text-yellow-900' : 'text-red-900'} mb-2 text-sm`}>
                      {importErrors.some(e => e.includes('Skipped')) && importErrors.length === 1 ? 'Import Warnings:' : 'Import Errors:'}
                    </h3>
                    <ul className={`text-xs ${importErrors.some(e => e.includes('Skipped')) && importErrors.length === 1 ? 'text-yellow-800' : 'text-red-800'} space-y-1`}>
                      {importErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-[#2c3437] mb-3 text-sm">Preview ({importPreview.length} assets)</h3>
                <div className="bg-white/60 border border-white/60 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/80 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-bold text-[#596064]">Asset ID</th>
                        <th className="px-3 py-2 font-bold text-[#596064]">Name</th>
                        <th className="px-3 py-2 font-bold text-[#596064]">Category</th>
                        <th className="px-3 py-2 font-bold text-[#596064]">Serial</th>
                        <th className="px-3 py-2 font-bold text-[#596064]">User</th>
                        <th className="px-3 py-2 font-bold text-[#596064]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/40">
                      {importPreview.map((asset, index) => (
                        <tr key={index} className="hover:bg-white/40">
                          <td className="px-3 py-2 font-mono">{asset.id}</td>
                          <td className="px-3 py-2">{asset.name}</td>
                          <td className="px-3 py-2">{asset.category}</td>
                          <td className="px-3 py-2 font-mono">{asset.serial}</td>
                          <td className="px-3 py-2">{asset.user || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusStyles[asset.status]}`}>
                              {asset.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                }}
                className="flex-1 py-3 rounded-xl border border-white/40 text-[#27619d] font-bold text-sm hover:bg-[#eaeff2] transition-colors font-body"
              >
                Cancel
              </button>
              <button
                onClick={handleImportAssets}
                disabled={importPreview.length === 0 || (importErrors.length > 0 && !importErrors.every(e => e.includes('Skipped')))}
                className="flex-1 py-3 rounded-xl bg-[#625983] text-[#f8f8ff] font-bold text-sm shadow-lg shadow-[#625983]/20 hover:opacity-90 transition-opacity font-body disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {importPreview.length} Assets
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Asset;
