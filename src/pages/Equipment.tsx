import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ROOT_COLLECTION, ROOT_DOCUMENT } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';

type AssetHistory = {
  date: string;
  action: string;
  detail: string;
};

type AssetItem = {
  id: string;
  name: string;
  spec: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  serial: string;
  user: string | null;
  userAvatar: string | null;
  status: string;
  category: string;
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

type TimelineEvent = {
  icon: string;
  iconBg: string;
  iconColor: string;
  fill: boolean;
  title: string;
  date: string;
  content: string;
  meta: Array<{ icon: string; text: string; avatar?: string }>;
};

const statusStyles: Record<string, string> = {
  Active: 'bg-[#dcfce7]/80 backdrop-blur-sm text-[#166534]',
  Repair: 'bg-[#fa746f] text-[#6e0a12]',
  Retired: 'bg-[#f3f4f6]/80 text-[#6b7280]',
};

const statusDotColors: Record<string, string> = {
  Active: 'bg-[#22c55e]',
  Repair: 'bg-[#dc2626]',
  Retired: 'bg-[#9ca3af]',
};

const getHealthScoreColor = (score: number): string => {
  const normalized = Math.max(40, Math.min(100, score));
  const hue = ((normalized - 40) / 60) * 120;
  return `hsl(${hue}, 75%, 42%)`;
};

const getHealthScoreBg = (score: number): string => {
  const normalized = Math.max(40, Math.min(100, score));
  const hue = ((normalized - 40) / 60) * 120;
  return `hsl(${hue}, 75%, 95%)`;
};

const getEventMeta = (action: string) => {
  const a = action.toLowerCase();
  if (a.includes('assign')) return { icon: 'person_add', iconBg: 'bg-[#27619d]', iconColor: 'text-[#f8f8ff]', fill: false };
  if (a.includes('request')) return { icon: 'warning', iconBg: 'bg-[#fa746f]/20', iconColor: 'text-[#a83836]', fill: true };
  if (a.includes('repair')) return { icon: 'build', iconBg: 'bg-[#c7e7ff]', iconColor: 'text-[#155590]', fill: false };
  if (a.includes('mainten')) return { icon: 'build', iconBg: 'bg-[#c7e7ff]', iconColor: 'text-[#155590]', fill: false };
  if (a.includes('complete')) return { icon: 'task_alt', iconBg: 'bg-[#c7e7ff]', iconColor: 'text-[#155590]', fill: true };
  if (a.includes('register') || a.includes('import')) return { icon: 'app_registration', iconBg: 'bg-[#86b9fb]', iconColor: 'text-[#003662]', fill: false };
  return { icon: 'task_alt', iconBg: 'bg-[#c7e7ff]', iconColor: 'text-[#155590]', fill: true };
};

const Equipment = () => {
  const { userProfile } = useAuth();
  const isMasterAdmin = userProfile?.role?.includes('MasterAdmin') ?? false;

  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [showLogsheetModal, setShowLogsheetModal] = useState(false);
  const [logsheetRows, setLogsheetRows] = useState<Array<{ id: number; date: string; action: string; user: string; docNo: string }>>([]);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const hasAutoSelected = useRef(false);

  const loadAssets = async () => {
    const snap = await getDocs(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssetItem, 'id'>) }));
    setAssets(rows);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (!assets.length) return;
    const assetId = (location.state as { assetId?: string })?.assetId;
    if (assetId) {
      const found = assets.find((a) => a.id === assetId);
      if (found) {
        setSelectedAsset(found);
        hasAutoSelected.current = true;
        window.history.replaceState({}, document.title);
      }
    }
  }, [assets]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return assets
      .filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.serial.toLowerCase().includes(q) ||
          (a.user ?? '').toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [assets, searchQuery]);

  const handleSelectAsset = (asset: AssetItem) => {
    setSelectedAsset(asset);
    setSearchQuery('');
    setShowResults(false);
  };

  const parseHistoryToRows = (history: AssetHistory[]) => {
    return history.map((h, idx) => {
      const docNoMatch = h.detail.match(/\b(FM-IT-\d{3}-\d{7})\b/);
      const requesterMatch = h.detail.match(/\|\s*Requester:\s*([^|]+)/i);
      return {
        id: idx,
        date: h.date,
        action: h.action,
        user: requesterMatch?.[1]?.trim() ?? '',
        docNo: docNoMatch?.[1]?.trim() ?? '',
      };
    });
  };

  const composeDetail = (action: string, user: string, docNo: string) => {
    let detail = '';
    if (docNo) detail = `${docNo}: `;
    detail += `${action} record.`;
    if (user) detail += ` | Requester: ${user}`;
    return detail;
  };

  const openLogsheet = () => {
    if (!selectedAsset) return;
    const rows = parseHistoryToRows(selectedAsset.history || []);
    setLogsheetRows(rows.map((r, i) => ({ ...r, id: i })));
    setShowLogsheetModal(true);
    setEditingRowId(null);
  };

  const saveLogsheet = async () => {
    if (!selectedAsset) return;
    const newHistory: AssetHistory[] = logsheetRows.map((r) => ({
      date: r.date,
      action: r.action,
      detail: composeDetail(r.action, r.user, r.docNo),
    }));
    const assetRef = doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'assets', selectedAsset.id);
    await updateDoc(assetRef, { history: newHistory });
    setSelectedAsset({ ...selectedAsset, history: newHistory });
    setShowLogsheetModal(false);
  };

  const splitRepairDetail = (content: string): { summary: string; detail?: string } => {
    const parts = content.split('| Detail:');
    const hasDetail = parts.length >= 2;
    let summary = hasDetail ? parts[0]?.trim() ?? content : content;
    const detail = hasDetail ? parts.slice(1).join('| Detail:').trim() : undefined;
    // Remove Requester info from summary for cleaner display
    summary = summary.replace(/\|\s*Requester:[^|]*/i, '').trim();
    return detail ? { summary, detail } : { summary };
  };

  const events = useMemo<TimelineEvent[]>(() => {
    if (!selectedAsset?.history?.length) return [];
    return [...selectedAsset.history]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((h) => {
        const meta = getEventMeta(h.action);
        const isRepairRequested = h.action.toLowerCase().includes('repair requested');
        const metaItems: Array<{ icon: string; text: string; avatar?: string }> = [];
        if (isRepairRequested) {
          const match = /\b(FM-IT-\d{3}-\d{7})\b/.exec(h.detail);
          if (match?.[1]) {
            metaItems.push({ icon: 'receipt', text: match[1].trim() });
          }
          const requesterMatch = h.detail.match(/\|\s*Requester:\s*([^|]+)/i);
          if (requesterMatch?.[1]) {
            metaItems.push({ icon: 'person', text: requesterMatch[1].trim() });
          }
        }
        return {
          ...meta,
          title: h.action,
          date: h.date,
          content: h.detail,
          meta: metaItems,
        };
      });
  }, [selectedAsset]);

  return (
    <div className="pt-8 pb-12 px-8 min-h-screen">
      <div className="max-w-[95%] mx-auto">
        {/* Search Bar */}
        <div ref={searchRef} className="mb-8 relative">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747c80] group-focus-within:text-[#27619d] transition-colors text-[20px]">
              search
            </span>
            <input
              className="pl-10 pr-4 py-3 bg-white/60 backdrop-blur-md border border-white/50 rounded-xl focus:ring-2 focus:ring-[#27619d]/20 focus:bg-white transition-all text-sm w-full shadow-sm font-body outline-none"
              placeholder="Search by Asset ID, Serial Number, or Assigned User..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
            />
          </div>
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/80 backdrop-blur-md border border-white/50 rounded-xl shadow-xl z-50 overflow-hidden">
              {searchResults.map((asset) => (
                <button
                  key={asset.id}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#c7e7ff]/30 transition-colors text-left border-b border-white/30 last:border-0"
                  onClick={() => handleSelectAsset(asset)}
                >
                  <div
                    className={`w-8 h-8 rounded-lg ${asset.iconBg || 'bg-[#dce4e8]/50'} flex items-center justify-center ${asset.iconColor || 'text-[#446378]'} border border-white/50 shadow-sm`}
                  >
                    <span className="material-symbols-outlined text-sm">{asset.icon || 'devices'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-[#2c3437] truncate">
                      {asset.id} {asset.name}
                    </div>
                    <div className="text-xs text-[#596064] truncate">
                      SN: {asset.serial}
                      {asset.user ? ` • ${asset.user}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showResults && searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/80 backdrop-blur-md border border-white/50 rounded-xl shadow-xl z-50 px-4 py-3 text-sm text-[#596064]">
              No assets found.
            </div>
          )}
        </div>

        {selectedAsset ? (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#27619d] font-semibold text-sm tracking-widest uppercase font-body">
                  <span>Asset Intelligence</span>
                  <span className="h-px w-12 bg-[#86b9fb]" />
                </div>
                <h1 className="text-5xl font-extrabold font-display text-[#2c3437] tracking-tight leading-none">
                  {selectedAsset.name} <span className="text-[#86b9fb]">SN:{selectedAsset.serial}</span>
                </h1>
              </div>
              <div className="flex gap-3">
                <span
                  className={`px-4 py-1.5 backdrop-blur-sm rounded-full text-xs font-bold flex items-center gap-2 border border-white/50 shadow-sm ${
                    statusStyles[selectedAsset.status] || 'bg-[#dce4e8]/80 text-[#596064]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full animate-pulse ${statusDotColors[selectedAsset.status] || 'bg-[#27619d]'}`} />
                  {selectedAsset.status.toUpperCase()} DEPLOYMENT
                </span>
                <button className="p-2 border border-white/50 bg-white/40 backdrop-blur-md rounded-lg hover:bg-white/60 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[#596064]">print</span>
                </button>
                {isMasterAdmin && (
                  <button onClick={openLogsheet} className="p-2 border border-white/50 bg-white/40 backdrop-blur-md rounded-lg hover:bg-white/60 transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-[#596064]">list_alt</span>
                  </button>
                )}
                <button className="p-2 border border-white/50 bg-white/40 backdrop-blur-md rounded-lg hover:bg-white/60 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[#596064]">share</span>
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Panel: Asset Summary */}
              <div className="lg:col-span-4 space-y-6">
                {/* Asset Card */}
                <div className="bg-white/60 backdrop-blur-[12px] border border-white/50 rounded-2xl p-6 shadow-xl shadow-blue-900/5">
                  <img
                    alt={selectedAsset.name}
                    className="w-full aspect-video object-cover rounded-xl mb-6 bg-[#eaeff2]"
                    src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=338&fit=crop"
                  />
                  <div className="space-y-4">
                    {[
                      {
                        label: 'Model',
                        value:
                          selectedAsset.make && selectedAsset.model
                            ? `${selectedAsset.make} ${selectedAsset.model}`
                            : selectedAsset.name,
                      },
                      { label: 'Category', value: selectedAsset.category },
                      { label: 'Location', value: selectedAsset.location || 'N/A' },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center pb-4 border-b border-white/50">
                        <span className="text-[#596064] text-sm font-medium font-body">{item.label}</span>
                        <span className="text-[#2c3437] font-bold font-display text-sm">{item.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pb-4 border-b border-white/50">
                      <span className="text-[#596064] text-sm font-medium font-body">Assigned To</span>
                      <div className="flex items-center gap-2">
                        {selectedAsset.user ? (
                          <>
                            <img
                              alt={selectedAsset.user}
                              className="w-6 h-6 rounded-full object-cover border border-white shadow-sm"
                              src={
                                selectedAsset.userAvatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedAsset.user)}&background=c7e7ff&color=27619d&size=40`
                              }
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  selectedAsset.user!,
                                )}&background=c7e7ff&color=27619d&size=40`;
                              }}
                            />
                            <span className="text-[#2c3437] font-bold text-sm font-body">{selectedAsset.user}</span>
                          </>
                        ) : (
                          <span className="text-[#596064] text-sm font-body italic">Unassigned</span>
                        )}
                      </div>
                    </div>
                    <div className="pt-2">
                      <span className="text-[#596064] text-xs mb-2 block font-body">Quick Actions</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="bg-white/60 hover:bg-white py-2 rounded-lg text-xs font-semibold text-[#27619d] transition-all border border-white/50 shadow-sm font-body">
                          Request Maintenance
                        </button>
                        <button className="bg-white/60 hover:bg-white py-2 rounded-lg text-xs font-semibold text-[#2c3437] transition-all border border-white/50 shadow-sm font-body">
                          Audit Device
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Health Score */}
                <div
                  className="rounded-2xl p-6 border border-white/50 backdrop-blur-sm relative overflow-hidden shadow-lg shadow-blue-900/5"
                  style={{ backgroundColor: getHealthScoreBg(selectedAsset.healthScore ?? 100) }}
                >
                  <div
                    className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 opacity-20"
                    style={{ backgroundColor: getHealthScoreColor(selectedAsset.healthScore ?? 100) }}
                  />
                  <h3
                    className="font-display font-bold mb-2"
                    style={{ color: getHealthScoreColor(selectedAsset.healthScore ?? 100) }}
                  >
                    Health Score
                  </h3>
                  <div className="flex items-end gap-2">
                    <span
                      className="text-4xl font-extrabold leading-none"
                      style={{ color: getHealthScoreColor(selectedAsset.healthScore ?? 100) }}
                    >
                      {selectedAsset.healthScore ?? 'N/A'}
                    </span>
                    <span className="text-[#596064] text-sm mb-1">/ 100</span>
                  </div>
                  <p className="text-[#596064] text-xs mt-4 leading-relaxed font-body">
                    {selectedAsset.warrantyExpiryDate
                      ? `Warranty expires on ${selectedAsset.warrantyExpiryDate}.`
                      : 'No warranty information available.'}
                  </p>
                </div>
              </div>

              {/* Right Panel: Timeline */}
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-white/60 backdrop-blur-[12px] border border-white/50 rounded-2xl shadow-xl shadow-blue-900/5 overflow-hidden">
                  <div className="bg-white/40 border-b border-white/50 px-8 py-6 flex justify-between items-center">
                    <h2 className="font-display font-extrabold text-2xl text-[#2c3437]">Lifecycle Events</h2>
                    <div className="flex gap-2">
                      <button className="bg-white px-4 py-2 rounded-lg text-xs font-bold border border-white/50 shadow-sm hover:bg-[#86b9fb]/20 transition-all">
                        All Logs
                      </button>
                      <button className="text-[#596064] px-4 py-2 rounded-lg text-xs font-bold hover:bg-white transition-colors">
                        Filters
                      </button>
                    </div>
                  </div>
                  <div className="p-8 relative">
                    {events.length > 0 ? (
                      <>
                        {/* Vertical line */}
                        <div className="absolute left-12 top-8 bottom-8 w-px bg-white/60" />
                        <div className="space-y-10">
                          {events.map((ev, i) => (
                            <div key={i} className="relative flex gap-10">
                              <div
                                className={`z-10 w-8 h-8 rounded-full ${ev.iconBg} flex items-center justify-center ${ev.iconColor} shadow-md mt-1 ring-4 ring-white/60 flex-shrink-0`}
                              >
                                <span
                                  className="material-symbols-outlined text-sm"
                                  style={ev.fill ? { fontVariationSettings: "'FILL' 1" } : {}}
                                >
                                  {ev.icon}
                                </span>
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                                  <h4 className="font-display font-bold text-lg text-[#2c3437]">{ev.title}</h4>
                                  <span className="text-xs font-medium text-[#596064] px-2 py-1 bg-white/60 backdrop-blur-md rounded border border-white/40 shadow-sm font-body">
                                    {ev.date}
                                  </span>
                                </div>
                                {ev.meta.length > 0 || ev.title.toLowerCase().includes('repair requested') || ev.title.toLowerCase().includes('assign') ? (
                                  <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-sm">
                                    {ev.title.toLowerCase().includes('repair requested') ? (
                                      (() => {
                                        const { summary, detail } = splitRepairDetail(ev.content);
                                        return (
                                          <div className="mb-3">
                                            <p className="text-[#596064] text-sm font-body">{summary}</p>
                                            {detail && (
                                              <p className="text-[#596064] text-sm font-body mt-2">
                                                {detail}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })()
                                    ) : ev.title.toLowerCase().includes('assign') ? (
                                      (() => {
                                        const isAssign = ev.title.toLowerCase().includes('assigned');
                                        if (!isAssign) {
                                          return <p className="text-[#596064] text-sm font-body">{ev.content}</p>;
                                        }
                                        const nameMatch = ev.content.match(/Assigned to\s+([^|]+)/i);
                                        const emailMatch = ev.content.match(/Email:\s*([^|]+)/i);
                                        const photoMatch = ev.content.match(/UserPhoto:\s*([^|]+)/i);
                                        const name = nameMatch?.[1]?.trim() ?? '';
                                        const email = emailMatch?.[1]?.trim() ?? '';
                                        const photo = photoMatch?.[1]?.trim() ?? '';
                                        return (
                                          <div className="flex items-center gap-3">
                                            {photo && (
                                              <img
                                                src={photo}
                                                alt=""
                                                className="w-12 h-12 rounded-full object-cover border border-white shadow-sm"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              />
                                            )}
                                            <div>
                                              <p className="text-[#2c3437] font-bold text-sm font-body">{name}</p>
                                              {email && <p className="text-[#596064] text-xs font-body">{email}</p>}
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <p className="text-[#596064] text-sm mb-3 font-body">{ev.content}</p>
                                    )}
                                    {ev.meta.length > 0 && !ev.title.toLowerCase().includes('assign') && (
                                      <div className="flex flex-wrap items-center gap-4">
                                        {ev.meta.map((m, j) => (
                                          <div key={j} className="flex items-center gap-2">
                                            {m.avatar ? (
                                              <img
                                                src={m.avatar}
                                                alt=""
                                                className="w-6 h-6 rounded-full object-cover border border-white shadow-sm"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              />
                                            ) : (
                                              <span className="material-symbols-outlined text-[#747c80] text-lg">
                                                {m.icon}
                                              </span>
                                            )}
                                            <span className="text-xs font-medium text-[#405f74] font-body">{m.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-[#596064] text-sm font-body">{ev.content}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-[#596064] font-body">
                        No lifecycle events recorded for this asset.
                      </div>
                    )}
                  </div>
                  <div className="bg-white/40 px-8 py-4 text-center border-t border-white/50">
                    <button className="text-[#27619d] font-bold text-sm hover:underline transition-all font-body">
                      View Older Records
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Demo / Sample View */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#27619d] font-semibold text-sm tracking-widest uppercase font-body">
                  <span>Asset Intelligence</span>
                  <span className="h-px w-12 bg-[#86b9fb]" />
                </div>
                <h1 className="text-5xl font-extrabold font-display text-[#2c3437] tracking-tight leading-none">
                  MacBook Pro <span className="text-[#86b9fb]">SN:12345</span>
                </h1>
              </div>
              <div className="flex gap-3">
                <span className="px-4 py-1.5 bg-[#dcfce7]/80 backdrop-blur-sm text-[#166534] rounded-full text-xs font-bold flex items-center gap-2 border border-white/50 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                  ACTIVE DEPLOYMENT
                </span>
                <button className="p-2 border border-white/50 bg-white/40 backdrop-blur-md rounded-lg hover:bg-white/60 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[#596064]">print</span>
                </button>
                <button className="p-2 border border-white/50 bg-white/40 backdrop-blur-md rounded-lg hover:bg-white/60 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[#596064]">share</span>
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Panel: Asset Summary */}
              <div className="lg:col-span-4 space-y-6">
                {/* Asset Card */}
                <div className="bg-white/60 backdrop-blur-[12px] border border-white/50 rounded-2xl p-6 shadow-xl shadow-blue-900/5">
                  <img
                    alt="MacBook Pro"
                    className="w-full aspect-video object-cover rounded-xl mb-6 bg-[#eaeff2]"
                    src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=338&fit=crop"
                  />
                  <div className="space-y-4">
                    {[
                      { label: 'Model', value: 'MacBook Pro 16" M2' },
                      { label: 'Department', value: 'Design Ops' },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center pb-4 border-b border-white/50">
                        <span className="text-[#596064] text-sm font-medium font-body">{item.label}</span>
                        <span className="text-[#2c3437] font-bold font-display text-sm">{item.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pb-4 border-b border-white/50">
                      <span className="text-[#596064] text-sm font-medium font-body">Assigned To</span>
                      <div className="flex items-center gap-2">
                        <img
                          alt="Sarah Jenkins"
                          className="w-6 h-6 rounded-full object-cover border border-white shadow-sm"
                          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop"
                        />
                        <span className="text-[#2c3437] font-bold text-sm font-body">Sarah Jenkins</span>
                      </div>
                    </div>
                    <div className="pt-2">
                      <span className="text-[#596064] text-xs mb-2 block font-body">Quick Actions</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="bg-white/60 hover:bg-white py-2 rounded-lg text-xs font-semibold text-[#27619d] transition-all border border-white/50 shadow-sm font-body">
                          Request Maintenance
                        </button>
                        <button className="bg-white/60 hover:bg-white py-2 rounded-lg text-xs font-semibold text-[#2c3437] transition-all border border-white/50 shadow-sm font-body">
                          Audit Device
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Health Score */}
                <div
                  className="rounded-2xl p-6 border border-white/50 backdrop-blur-sm relative overflow-hidden shadow-lg shadow-blue-900/5"
                  style={{ backgroundColor: getHealthScoreBg(98) }}
                >
                  <div
                    className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 opacity-20"
                    style={{ backgroundColor: getHealthScoreColor(98) }}
                  />
                  <h3
                    className="font-display font-bold mb-2"
                    style={{ color: getHealthScoreColor(98) }}
                  >
                    Health Score
                  </h3>
                  <div className="flex items-end gap-2">
                    <span
                      className="text-4xl font-extrabold leading-none"
                      style={{ color: getHealthScoreColor(98) }}
                    >
                      98
                    </span>
                    <span className="text-[#596064] text-sm mb-1">/ 100</span>
                  </div>
                  <p className="text-[#596064] text-xs mt-4 leading-relaxed font-body">
                    Last system diagnostic performed 48 hours ago. No hardware anomalies detected.
                  </p>
                </div>
              </div>

              {/* Right Panel: Timeline */}
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-white/60 backdrop-blur-[12px] border border-white/50 rounded-2xl shadow-xl shadow-blue-900/5 overflow-hidden">
                  <div className="bg-white/40 border-b border-white/50 px-8 py-6 flex justify-between items-center">
                    <h2 className="font-display font-extrabold text-2xl text-[#2c3437]">Lifecycle Events</h2>
                    <div className="flex gap-2">
                      <button className="bg-white px-4 py-2 rounded-lg text-xs font-bold border border-white/50 shadow-sm hover:bg-[#86b9fb]/20 transition-all">All Logs</button>
                      <button className="text-[#596064] px-4 py-2 rounded-lg text-xs font-bold hover:bg-white transition-colors">Filters</button>
                    </div>
                  </div>
                  <div className="p-8 relative">
                    {/* Vertical line */}
                    <div className="absolute left-12 top-8 bottom-8 w-px bg-white/60" />
                    <div className="space-y-10">
                      {[
                        {
                          icon: 'task_alt',
                          iconBg: 'bg-[#c7e7ff]',
                          iconColor: 'text-[#155590]',
                          fill: true,
                          title: 'Repair completed',
                          date: 'Oct 24, 2023 • 14:20',
                          content: 'Logic board components stabilized. Fan assembly cleaned and heat sink paste reapplied. Full diagnostic pass: Green.',
                          meta: [
                            { icon: 'person', text: 'Technician: Mike R.' },
                            { icon: 'receipt', text: 'Case #88219' },
                          ],
                        },
                        {
                          icon: 'warning',
                          iconBg: 'bg-[#fa746f]/20',
                          iconColor: 'text-[#a83836]',
                          fill: true,
                          title: 'Repair requested',
                          date: 'Oct 21, 2023 • 09:15',
                          content: 'User reported thermal throttling and excessive fan noise during rendering tasks. Device flagged for urgent inspection.',
                          meta: [{ icon: 'person', text: 'Requester: Sarah Jenkins' }],
                        },
                        {
                          icon: 'person_add',
                          iconBg: 'bg-[#27619d]',
                          iconColor: 'text-[#f8f8ff]',
                          fill: false,
                          title: 'Assigned to Sarah Jenkins',
                          date: 'May 12, 2023 • 10:00',
                          content: 'Asset moved from IT Storage to Design Ops. Onboarding kit included. User acknowledgment signed digitally.',
                          meta: [],
                        },
                        {
                          icon: 'build',
                          iconBg: 'bg-[#c7e7ff]',
                          iconColor: 'text-[#155590]',
                          fill: false,
                          title: 'Routine Maintenance',
                          date: 'Jan 15, 2023 • 11:30',
                          content: 'Quarterly OS updates applied. Battery health verified at 100%. Exterior cleaned and inspected for physical damage.',
                          meta: [],
                        },
                        {
                          icon: 'app_registration',
                          iconBg: 'bg-[#86b9fb]',
                          iconColor: 'text-[#003662]',
                          fill: false,
                          title: 'Asset Registration',
                          date: 'Dec 02, 2022 • 16:45',
                          content: 'New inventory entry created. Warranty coverage verified through Dec 2025. Standard corporate security image installed.',
                          meta: [],
                        },
                      ].map((ev, i) => (
                        <div key={i} className="relative flex gap-10">
                          <div className={`z-10 w-8 h-8 rounded-full ${ev.iconBg} flex items-center justify-center ${ev.iconColor} shadow-md mt-1 ring-4 ring-white/60 flex-shrink-0`}>
                            <span
                              className="material-symbols-outlined text-sm"
                              style={ev.fill ? { fontVariationSettings: "'FILL' 1" } : {}}
                            >
                              {ev.icon}
                            </span>
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                              <h4 className="font-display font-bold text-lg text-[#2c3437]">{ev.title}</h4>
                              <span className="text-xs font-medium text-[#596064] px-2 py-1 bg-white/60 backdrop-blur-md rounded border border-white/40 shadow-sm font-body">
                                {ev.date}
                              </span>
                            </div>
                            {ev.meta.length > 0 ? (
                              <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-sm">
                                <p className="text-[#596064] text-sm mb-3 font-body">{ev.content}</p>
                                <div className="flex flex-wrap items-center gap-4">
                                  {ev.meta.map((m, j) => (
                                    <div key={j} className="flex items-center gap-2">
                                      <span className="material-symbols-outlined text-[#747c80] text-lg">{m.icon}</span>
                                      <span className="text-xs font-medium text-[#405f74] font-body">{m.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[#596064] text-sm font-body">{ev.content}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/40 px-8 py-4 text-center border-t border-white/50">
                    <button className="text-[#27619d] font-bold text-sm hover:underline transition-all font-body">
                      View Older Records
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {showLogsheetModal && selectedAsset && createPortal(
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-display font-bold text-xl text-[#2c3437]">Logsheet</h3>
                <button onClick={() => setShowLogsheetModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <span className="material-symbols-outlined text-[#596064]">close</span>
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                <div className="mb-3 flex justify-end">
                  <button
                    onClick={() => {
                      const newId = logsheetRows.length > 0 ? Math.max(...logsheetRows.map(r => r.id)) + 1 : 0;
                      setLogsheetRows([...logsheetRows, { id: newId, date: new Date().toLocaleString('sv-SE').replace('T', ' '), action: '', user: '', docNo: '' }]);
                      setEditingRowId(newId);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#27619d] text-white text-xs font-bold rounded-lg hover:bg-[#1e4d7a] transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span> Add Entry
                  </button>
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs font-bold text-[#596064] uppercase border-b border-gray-200">
                      <th className="pb-2 pl-2 pr-4">Date time</th>
                      <th className="pb-2 px-4">Type</th>
                      <th className="pb-2 px-4">User</th>
                      <th className="pb-2 px-4">Doc No.</th>
                      <th className="pb-2 pr-2 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsheetRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 last:border-0">
                        {editingRowId === row.id ? (
                          <>
                            <td className="py-2 pl-2 pr-4"><input className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={row.date} onChange={e => setLogsheetRows(rows => rows.map(r => r.id === row.id ? { ...r, date: e.target.value } : r))} /></td>
                            <td className="py-2 px-4"><input className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={row.action} onChange={e => setLogsheetRows(rows => rows.map(r => r.id === row.id ? { ...r, action: e.target.value } : r))} /></td>
                            <td className="py-2 px-4"><input className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={row.user} onChange={e => setLogsheetRows(rows => rows.map(r => r.id === row.id ? { ...r, user: e.target.value } : r))} /></td>
                            <td className="py-2 px-4"><input className="w-full px-2 py-1 rounded border border-gray-200 text-xs" value={row.docNo} onChange={e => setLogsheetRows(rows => rows.map(r => r.id === row.id ? { ...r, docNo: e.target.value } : r))} /></td>
                            <td className="py-2 pr-2 pl-4 text-right">
                              <button onClick={() => setEditingRowId(null)} className="text-xs text-[#27619d] font-bold hover:underline">Done</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 pl-2 pr-4 text-[#2c3437] font-medium">{row.date}</td>
                            <td className="py-3 px-4 text-[#2c3437] font-medium">{row.action}</td>
                            <td className="py-3 px-4 text-[#596064]">{row.user || '-'}</td>
                            <td className="py-3 px-4 text-[#596064]">{row.docNo || '-'}</td>
                            <td className="py-3 pr-2 pl-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => setEditingRowId(row.id)} className="p-1 hover:bg-[#c7e7ff]/50 rounded transition-colors">
                                  <span className="material-symbols-outlined text-[#27619d] text-sm">edit</span>
                                </button>
                                <button onClick={() => setLogsheetRows(rows => rows.filter(r => r.id !== row.id))} className="p-1 hover:bg-[#fa746f]/10 rounded transition-colors">
                                  <span className="material-symbols-outlined text-[#a83836] text-sm">delete</span>
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => setShowLogsheetModal(false)} className="px-4 py-2 rounded-lg text-xs font-bold text-[#596064] hover:bg-gray-100 transition-colors">Cancel</button>
                <button onClick={saveLogsheet} className="px-4 py-2 rounded-lg text-xs font-bold bg-[#27619d] text-white hover:bg-[#1e4d7a] transition-colors shadow-sm">Save Changes</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default Equipment;
