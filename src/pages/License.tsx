import { useEffect, useMemo, useRef, useState } from 'react';

type LicenseView = 'licenseSoftwareIso' | 'office365Registry';

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

const topButtonBase =
  'inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all font-body';

const formatPrefaceRow = (values: string[]) => values.filter(Boolean).join(' | ');

const License = () => {
  const [activeView, setActiveView] = useState<LicenseView>('licenseSoftwareIso');
  const [licenseWorkbook, setLicenseWorkbook] = useState<WorkbookData | null>(null);
  const [officeWorkbook, setOfficeWorkbook] = useState<WorkbookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLicensePacket, setSelectedLicensePacket] = useState('');
  const [selectedOfficePacket, setSelectedOfficePacket] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState({ isDragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);

      try {
        const [licenseResponse, officeResponse] = await Promise.all([
          fetch('/license-data/license-software-iso.json'),
          fetch('/license-data/office365-cmg.json'),
        ]);

        if (!licenseResponse.ok || !officeResponse.ok) {
          throw new Error('Failed to load license data JSON files.');
        }

        const [licenseJson, officeJson] = await Promise.all([
          licenseResponse.json() as Promise<WorkbookData>,
          officeResponse.json() as Promise<WorkbookData>,
        ]);

        if (cancelled) return;

        setLicenseWorkbook(licenseJson);
        setOfficeWorkbook(officeJson);

        const licenseSheet = licenseJson.sheets.find((sheet) => sheet.name === 'AutoCAD Revit LT Suite (2)');
        const licensePacketIndex = licenseSheet?.headers.findIndex((header) => header === 'Packet') ?? -1;
        const firstLicensePacket =
          licensePacketIndex >= 0
            ? licenseSheet?.rows.find((row) => row.values[licensePacketIndex])?.values[licensePacketIndex] ?? ''
            : '';
        setSelectedLicensePacket(firstLicensePacket);

        const firstOfficeSheet = officeJson.sheets[0];
        const officePacketIndex = firstOfficeSheet?.headers.findIndex((header) => header === 'Packet') ?? -1;
        const firstOfficePacket =
          officePacketIndex >= 0
            ? firstOfficeSheet?.rows.find((row) => row.values[officePacketIndex] && row.values[1])?.values[officePacketIndex] ?? ''
            : '';
        setSelectedOfficePacket(firstOfficePacket);
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

  const activeLicenseSheet = useMemo(
    () => licenseWorkbook?.sheets.find((sheet) => sheet.name === 'AutoCAD Revit LT Suite (2)') ?? null,
    [licenseWorkbook],
  );

  const officeSheet = officeWorkbook?.sheets[0] ?? null;

  const packetColumnIndex = activeLicenseSheet?.headers.findIndex((header) => header === 'Packet') ?? -1;
  const officePacketColumnIndex = officeSheet?.headers.findIndex((header) => header === 'Packet') ?? -1;

  const licensePacketItems = useMemo(() => {
    if (!activeLicenseSheet || packetColumnIndex < 0) return [];

    const packetMap = new Map<string, number>();
    activeLicenseSheet.rows.forEach((row) => {
      const packet = row.values[packetColumnIndex] || '';
      if (!packet) return;
      packetMap.set(packet, (packetMap.get(packet) ?? 0) + 1);
    });

    return Array.from(packetMap.entries()).map(([packet, count]) => ({ packet, count }));
  }, [activeLicenseSheet, packetColumnIndex]);

  const filteredLicenseSheet = useMemo(() => {
    if (!activeLicenseSheet || packetColumnIndex < 0 || !selectedLicensePacket) {
      return activeLicenseSheet;
    }

    return {
      ...activeLicenseSheet,
      rows: activeLicenseSheet.rows.filter((row) => row.values[packetColumnIndex] === selectedLicensePacket),
    };
  }, [activeLicenseSheet, packetColumnIndex, selectedLicensePacket]);

  const officePacketItems = useMemo(() => {
    if (!officeSheet || officePacketColumnIndex < 0) return [];

    const packetMap = new Map<string, number>();
    officeSheet.rows.forEach((row) => {
      const packet = row.values[officePacketColumnIndex] || '';
      const name = row.values[1] || '';
      if (!packet || !name) return;
      packetMap.set(packet, (packetMap.get(packet) ?? 0) + 1);
    });

    return Array.from(packetMap.entries()).map(([packet, count]) => ({ packet, count }));
  }, [officeSheet, officePacketColumnIndex]);

  const filteredOfficeSheet = useMemo(() => {
    if (!officeSheet || officePacketColumnIndex < 0 || !selectedOfficePacket) {
      return officeSheet
        ? {
            ...officeSheet,
            rows: officeSheet.rows.filter((row) => (row.values[1] || '') !== ''),
          }
        : officeSheet;
    }

    return {
      ...officeSheet,
      rows: officeSheet.rows.filter((row) => {
        const packet = row.values[officePacketColumnIndex] || '';
        const name = row.values[1] || '';
        return packet === selectedOfficePacket && name !== '';
      }),
    };
  }, [officeSheet, officePacketColumnIndex, selectedOfficePacket]);

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

  const renderWorkbookTable = (sheet: WorkbookSheet) => (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/35 shadow-sm">
      <div
        ref={tableContainerRef}
        className={`overflow-x-auto ${dragState.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <table className="w-full min-w-[920px] table-auto text-left">
          <thead className="bg-white/60">
            <tr>
              {sheet.headers.map((header, index) => (
                <th
                  key={`${sheet.name}-header-${index}`}
                  className="whitespace-nowrap px-3 py-2 text-[11px] font-bold tracking-wide text-[#596064]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={`${sheet.name}-row-${rowIndex}`} className="border-t border-white/40 align-top">
                {row.values.map((value, valueIndex) => (
                  <td
                    key={`${sheet.name}-row-${rowIndex}-value-${valueIndex}`}
                    className="whitespace-nowrap px-3 py-2 text-[11px] leading-4 text-on-surface-variant"
                  >
                    {value || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 min-h-screen px-8 pb-12 pt-8">
      <div className="mx-auto max-w-[95%]">
        <header className="mb-10 flex flex-col gap-6">
          <div>
            <h1 className="mb-2 font-display text-4xl font-extrabold tracking-tight text-[#2c3437]">License Center</h1>
            <p className="max-w-3xl font-body text-[#596064]">
              หน้า License นี้แสดงข้อมูลจาก Excel snapshot เพื่อให้ใช้งานได้ทันทีบนหน้าเว็บโดยไม่ต้องเปิดไฟล์ต้นทาง
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
              <span className="font-bold">License Software iso</span>
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
                    Excel snapshot
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#2c3437]">License Software iso</h2>
                  <p className="mt-2 font-body text-sm text-[#596064]">
                    Source: {licenseWorkbook?.sourceFileName} | Updated: {licenseWorkbook?.sourceLastWriteTime} | Synced:{' '}
                    {licenseWorkbook?.syncedAt}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold text-[#2c3437] shadow-sm">
                  {filteredLicenseSheet?.rows.length ?? 0} users
                </div>
              </div>
            </div>

            {activeLicenseSheet ? (
              <>
                <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                  <h3 className="mb-4 font-display text-lg font-bold text-[#2c3437]">License List</h3>
                  <div className="flex flex-wrap gap-3">
                    {licensePacketItems.map((item) => (
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
                        <div className="mt-1 text-[11px] font-medium text-[#596064]">{item.count} users</div>
                      </button>
                    ))}
                  </div>
                </div>

                {filteredLicenseSheet?.prefaceRows.length ? (
                  <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                    <h3 className="mb-4 font-display text-lg font-bold text-[#2c3437]">Workbook Notes</h3>
                    <div className="space-y-2 font-body text-sm text-[#596064]">
                      {filteredLicenseSheet.prefaceRows.map((row, index) => (
                        <p key={`${filteredLicenseSheet.name}-preface-${index}`}>{formatPrefaceRow(row)}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#2c3437]">
                        {selectedLicensePacket || 'Selected License'}
                      </h3>
                      <p className="font-body text-sm text-[#596064]">แสดงรายชื่อผู้ใช้งาน License รายการนี้</p>
                    </div>

                    <div className="rounded-full bg-[#C7E7FF]/80 px-3 py-1 text-xs font-bold text-[#27619D]">
                      {filteredLicenseSheet?.rows.length ?? 0} users
                    </div>
                  </div>
                </div>

                {filteredLicenseSheet ? renderWorkbookTable(filteredLicenseSheet) : null}
              </>
            ) : (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
                <p className="text-sm font-medium text-[#596064]">ไม่พบข้อมูล AutoCAD จาก License Software iso</p>
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
                    Excel snapshot
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#2c3437]">ทะเบียน Office 365 CMG</h2>
                  <p className="mt-2 font-body text-sm text-[#596064]">
                    Source: {officeWorkbook?.sourceFileName} | Updated: {officeWorkbook?.sourceLastWriteTime} | Synced:{' '}
                    {officeWorkbook?.syncedAt}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold text-[#2c3437] shadow-sm">
                  {filteredOfficeSheet?.rows.length ?? 0} users
                </div>
              </div>
            </div>

            {officeSheet ? (
              <>
                <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                  <h3 className="mb-4 font-display text-lg font-bold text-[#2c3437]">License List</h3>
                  <div className="flex flex-wrap gap-3">
                    {officePacketItems.map((item) => (
                      <button
                        key={item.packet}
                        type="button"
                        onClick={() => setSelectedOfficePacket(item.packet)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          selectedOfficePacket === item.packet
                            ? 'border-[#27619d] bg-[#e8f5ff] shadow-md shadow-[#27619d]/10'
                            : 'border-white/50 bg-white/60 hover:bg-white'
                        }`}
                      >
                        <div className="text-sm font-bold text-[#2c3437]">{item.packet}</div>
                        <div className="mt-1 text-[11px] font-medium text-[#596064]">{item.count} users</div>
                      </button>
                    ))}
                  </div>
                </div>

                {officeSheet.prefaceRows.length ? (
                  <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                    <h3 className="mb-4 font-display text-lg font-bold text-[#2c3437]">Workbook Notes</h3>
                    <div className="space-y-2 font-body text-sm text-[#596064]">
                      {officeSheet.prefaceRows.map((row, index) => (
                        <p key={`office-preface-${index}`}>{formatPrefaceRow(row)}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#2c3437]">
                        {selectedOfficePacket || 'Selected License'}
                      </h3>
                      <p className="font-body text-sm text-[#596064]">แสดงรายชื่อผู้ใช้งาน License รายการนี้</p>
                    </div>

                    <div className="rounded-full bg-[#C7E7FF]/80 px-3 py-1 text-xs font-bold text-[#27619D]">
                      {filteredOfficeSheet?.rows.length ?? 0} users
                    </div>
                  </div>
                </div>

                {filteredOfficeSheet ? renderWorkbookTable(filteredOfficeSheet) : null}
              </>
            ) : (
              <div className="rounded-3xl border border-white/40 bg-white/40 p-10 text-center shadow-sm">
                <p className="text-sm font-medium text-[#596064]">ไม่พบข้อมูลทะเบียน Office 365 CMG</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default License;
