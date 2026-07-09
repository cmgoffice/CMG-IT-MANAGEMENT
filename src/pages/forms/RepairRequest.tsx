import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../lib/firebase';
import { generateDocNo, ROOT_COLLECTION, ROOT_DOCUMENT } from '../../lib/db';
import { collection, addDoc, Timestamp, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { buildReporterSubmissionMeta } from '../../lib/formSubmission';
// import { useNavigate } from 'react-router-dom';

const RepairRequest = () => {
  const { userProfile } = useAuth();
  // const navigate = useNavigate();

  const [reporterName, setReporterName] = useState('');
  const [reporterDepartment, setReporterDepartment] = useState('');
  const [reporterJobTitle, setReporterJobTitle] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');

  const [docNo, setDocNo] = useState('');
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [eqComputer, setEqComputer] = useState(false);
  const [eqPrinter, setEqPrinter] = useState(false);
  const [eqRadio, setEqRadio] = useState(false);
  const [eqCctv, setEqCctv] = useState(false);
  const [eqOther, setEqOther] = useState(false);
  const [eqOtherText, setEqOtherText] = useState('');

  const [symptomWontTurnOn, setSymptomWontTurnOn] = useState(false);
  const [symptomSlow, setSymptomSlow] = useState(false);
  const [symptomNoPower, setSymptomNoPower] = useState(false);
  const [symptomBroken, setSymptomBroken] = useState(false);
  const [symptomOther, setSymptomOther] = useState(false);
  const [detailedDescription, setDetailedDescription] = useState('');

  const [assetId, setAssetId] = useState('');
  const [assetBrand, setAssetBrand] = useState('');
  const [assetModel, setAssetModel] = useState('');
  const [assetSerial, setAssetSerial] = useState('');
  const [assetPurchaseDate, setAssetPurchaseDate] = useState('');
  const [assetCaretaker, setAssetCaretaker] = useState('');
  const [assetReceiveDate, setAssetReceiveDate] = useState('');
  const [repairCount, setRepairCount] = useState('');

  const [assignedAssets, setAssignedAssets] = useState<Array<{ id: string; make: string; model: string; serial: string; warrantyExpiryDate?: string }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDocNo = async () => {
      try {
        const nextDocNo = await generateDocNo('FM-IT-001', 'repairRequests');
        if (!cancelled) {
          setDocNo(nextDocNo);
        }
      } catch (error) {
        console.error('Failed to generate FM-IT-001 number:', error);
      }
    };

    loadDocNo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (userProfile) {
      console.log('userProfile:', userProfile);
      setReporterName(`${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim());
      setReporterDepartment(userProfile.department || '');
      setReporterJobTitle(userProfile.position || '');
    }
  }, [userProfile]);


  useEffect(() => {
    const loadAssignedAssets = async () => {
      if (!userProfile) return;
      const userFullName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
      try {
        const snap = await getDocs(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'assets'));
        const assets = snap.docs
          .map((d) => ({
            id: d.id,
            make: d.data().make || '',
            model: d.data().model || '',
            serial: d.data().serial || '',
            warrantyExpiryDate: d.data().warrantyExpiryDate || '',
            user: d.data().user || '',
          }))
          .filter((a) => a.user === userFullName);
        setAssignedAssets(assets);
      } catch (err) {
        console.error('Failed to load assigned assets:', err);
      }
    };
    loadAssignedAssets();
  }, [userProfile]);

  const handleAssetSelect = (selectedId: string) => {
    setAssetId(selectedId);
    const asset = assignedAssets.find((a) => a.id === selectedId);
    if (asset) {
      setAssetBrand(asset.make);
      setAssetModel(asset.model);
      setAssetSerial(asset.serial);
      setAssetPurchaseDate(asset.warrantyExpiryDate || '');
    } else {
      setAssetBrand('');
      setAssetModel('');
      setAssetSerial('');
      setAssetPurchaseDate('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: Array<{ name: string; url: string }> = [];
    for (const file of Array.from(files)) {
      try {
        const storageRef = ref(storage, `repairRequests/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploaded.push({ name: file.name, url });
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      alert('Please login first');
      return;
    }
    setIsSubmitting(true);
    try {
      const latestDocNo = await generateDocNo('FM-IT-001', 'repairRequests');
      setDocNo(latestDocNo);

      const submissionMeta = buildReporterSubmissionMeta(userProfile, {
        department: reporterDepartment,
        jobTitle: reporterJobTitle,
        phone: reporterPhone,
      });

      await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'repairRequests'), {
        docNo: latestDocNo,
        requestDate,
        equipmentCategory: {
          computer: eqComputer,
          printer: eqPrinter,
          radio: eqRadio,
          cctv: eqCctv,
          other: eqOther,
          otherText: eqOtherText,
        },
        reporter: submissionMeta.reporter,
        issueDescription: {
          wontTurnOn: symptomWontTurnOn,
          slow: symptomSlow,
          noPower: symptomNoPower,
          broken: symptomBroken,
          other: symptomOther,
          detailedDescription,
        },
        asset: {
          assetId,
          brand: assetBrand,
          model: assetModel,
          serialNumber: assetSerial,
          purchaseDate: assetPurchaseDate,
          caretaker: assetCaretaker,
          receiveDate: assetReceiveDate,
          repairCount: repairCount,
        },
        attachments: attachments.map((a) => a.url),
        status: 'pending',
        submittedBy: submissionMeta.submittedBy,
        createdAt: Timestamp.now(),
      });

      if (assetId) {
        const assetRef = doc(db, 'CMG-IT-MANAGEMENT', 'root', 'assets', assetId);
        const assetSnap = await getDoc(assetRef);
        if (assetSnap.exists()) {
          const existingHistory = (assetSnap.data().history || []) as Array<{ date: string; action: string; detail: string }>;
          const symptoms = [
            symptomWontTurnOn && "Won't Turn On",
            symptomSlow && 'Slow / Laggy',
            symptomNoPower && 'No Power',
            symptomBroken && 'Broken / Cracked',
            symptomOther && 'Other Symptom',
          ].filter(Boolean).join(', ');
          const baseDetail = symptoms || 'Repair request submitted.';
          const normalizedDesc = (detailedDescription || '').trim();
          const composedDetail = normalizedDesc && normalizedDesc !== baseDetail
            ? `${baseDetail} | Detail: ${normalizedDesc}`
            : baseDetail;
          const newEntry = {
            date: new Date().toLocaleString('sv-SE').replace('T', ' '),
            action: 'Repair requested',
            detail: `${latestDocNo || 'N/A'}: ${composedDetail} | Requester: ${submissionMeta.reporterName}`,
          };
          await updateDoc(assetRef, {
            history: [...existingHistory, newEntry],
          });
        }
      }

      // Write to logs collection
      await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'logs'), {
        name: submissionMeta.reporterName,
        email: submissionMeta.reporterEmail,
        action: 'Repair Requested',
        module: 'Repair Form (FM-IT-001)',
        ip: 'Internal', // เก็บค่า IP จริงหากมี
        ok: true,
        createdAt: Timestamp.now(),
      });

      // Send Line Notification
      import('../../lib/lineNotify').then(({ sendLineNotification }) => {
        const symptoms = [
          symptomWontTurnOn && "เปิดเครื่องไม่ติด",
          symptomSlow && 'เครื่องช้า/กระตุก',
          symptomNoPower && 'ไฟไม่เข้า',
          symptomBroken && 'แตก/หัก',
          symptomOther && 'อื่นๆ',
        ].filter(Boolean).join(', ');
        const todayStr = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const lineMessage = `\n📢 แจ้งซ่อม/บำรุงรักษา (FM-IT-001)\n───────────────────\n📅 วันที่แจ้ง : ${todayStr}\n📄 เลขที่ใบแจ้ง : ${latestDocNo}\n👤 ผู้แจ้ง : ${submissionMeta.reporterName} (${reporterDepartment})\n📍 ตำแหน่ง : ${reporterJobTitle || '-'}\n───────────────────\n🔧 ประเภท : อุปกรณ์ IT\n⚙️ อุปกรณ์ : ${assetId || 'ไม่ระบุ'}\n🏷️ ยี่ห้อ/รุ่น : ${assetBrand || '-'} ${assetModel || '-'}\n📌 อาการหลัก : ${symptoms || '-'}\n⚠️ รายละเอียด : ${detailedDescription || '-'}\n───────────────────`;
        sendLineNotification(lineMessage);
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      alert('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-[95%] mx-auto p-8 md:p-12">
        <div className="glass-card p-10 rounded-2xl shadow-xl text-center">
          <span className="material-symbols-outlined text-6xl text-green-500 mb-4">check_circle</span>
          <h2 className="text-3xl font-bold text-on-surface mb-2">Submitted Successfully</h2>
          <p className="text-on-surface-variant mb-6">Your repair request has been saved.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-[1.02] transition-all"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <>

      <div className="max-w-5xl mx-auto p-8 md:p-12">
        {/*  Header Section  */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-secondary-container/80 backdrop-blur-md text-on-secondary-container px-3 py-1 rounded-full text-sm font-bold mb-4 shadow-sm">
              <span className="material-symbols-outlined text-sm">build</span>
              เอกสารหน่วยงาน IT/CMG (เอกสารต้นฉบับ-สำเนา)
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">ใบแจ้งซ่อม / ชำรุด อุปกรณ์ IT</h1>
          </div>
          {/*  Formal Trackers  */}
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">เลขที่ WR</label>
              <input className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30" placeholder="FM-IT-001-XXXXXXX" type="text" value={docNo} readOnly />
            </div>
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">วันที่</label>
              <input className="w-full bg-transparent border-none p-0 text-lg font-bold text-on-surface focus:ring-0" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
            </div>
          </div>
        </header>
        {/*  Main Form Canvas  */}
        <div>
          <section className="space-y-8">
            <div className="glass-card p-8 md:p-10 rounded-2xl shadow-xl shadow-blue-900/5 border-2 border-primary/20">
              <form className="space-y-10" onSubmit={handleSubmit}>
                {/*  1. Equipment Category  */}
                <section>
                  <h3 className="text-sm font-bold text-primary mb-6 border-b border-primary-container/30 pb-2">ประเภท</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqComputer} onChange={(e) => setEqComputer(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">คอมพิวเตอร์/โน๊ตบุ๊ค</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqPrinter} onChange={(e) => setEqPrinter(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">เครื่องพิมพ์/ถ่ายเอกสาร</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqRadio} onChange={(e) => setEqRadio(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">วิทยุสื่อสาร</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqCctv} onChange={(e) => setEqCctv(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">กล้องวงจรปิด</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group col-span-2 md:col-span-1">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqOther} onChange={(e) => setEqOther(e.target.checked)} />
                      <input className="flex-1 bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-base py-0 h-6" placeholder="อื่นๆ" type="text" value={eqOtherText} onChange={(e) => setEqOtherText(e.target.value)} />
                    </label>
                  </div>
                </section>
                {/*  2. Reporter Information  */}
                <section>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ผู้แจ้งซ่อม</label>
                      <input className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ฝ่าย</label>
                      <input className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" value={reporterDepartment} onChange={(e) => setReporterDepartment(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">JOB</label>
                      <input className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" value={reporterJobTitle} onChange={(e) => setReporterJobTitle(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เบอร์โทร</label>
                      <input className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} />
                    </div>
                  </div>
                </section>
                {/*  3. Symptom Checklist  */}
                <section>
                  <div className="flex gap-4">
                    <h3 className="text-sm font-bold text-on-surface-variant whitespace-nowrap">อาการ</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomWontTurnOn} onChange={(e) => setSymptomWontTurnOn(e.target.checked)} />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">เปิดเครื่องไม่ติด</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomSlow} onChange={(e) => setSymptomSlow(e.target.checked)} />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">เครื่องช้า/กระตุก</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomNoPower} onChange={(e) => setSymptomNoPower(e.target.checked)} />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ไฟไม่เข้า</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomBroken} onChange={(e) => setSymptomBroken(e.target.checked)} />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">แตก/หัก</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomOther} onChange={(e) => setSymptomOther(e.target.checked)} />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">อื่นๆ</span>
                      </label>
                    </div>
                  </div>
                </section>
                {/*  4. Asset Details  */}
                <section>
                  <div className="mb-6 pb-2">
                    <h3 className="text-lg font-bold text-blue-700 underline underline-offset-4">1.ส่วนกรอกข้อมูลเครื่องอุปกรณ์</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เลขทะเบียนประจำตัวเครื่อง</label>
                      {assignedAssets.length > 0 ? (
                        <select
                          className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                          value={assetId}
                          onChange={(e) => handleAssetSelect(e.target.value)}
                        >
                          <option value="">เลือกอุปกรณ์...</option>
                          {assignedAssets.map((a) => (
                            <option key={a.id} value={a.id}>{a.id}</option>
                          ))}
                        </select>
                      ) : (
                        <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="text" value={assetId} onChange={(e) => setAssetId(e.target.value)} />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ยี่ห้อ</label>
                      <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="text" value={assetBrand} onChange={(e) => setAssetBrand(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">รุ่น</label>
                      <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="text" value={assetModel} onChange={(e) => setAssetModel(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">หมายเลข S/N</label>
                      <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="text" value={assetSerial} onChange={(e) => setAssetSerial(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">วันที่ซื้อ</label>
                      <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="date" value={assetPurchaseDate} onChange={(e) => setAssetPurchaseDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ชื่อผู้ดูแลอุปกรณ์</label>
                      <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="text" value={assetCaretaker} onChange={(e) => setAssetCaretaker(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">วันที่รับเครื่อง</label>
                      <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="date" value={assetReceiveDate} onChange={(e) => setAssetReceiveDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">แจ้งซ่อมครั้งที่</label>
                      <input className="w-full rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-base shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20" type="text" value={repairCount} onChange={(e) => setRepairCount(e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-6">
                    <label className="block text-sm font-bold text-on-surface-variant mb-2">อธิบายอาการโดยละเอียด <span className="text-red-500 font-normal">(การอธิบายอาการอย่างละเอียดช่วยให้การประเมินการซ่อมทำได้รวดเร็วยิ่งขึ้น)</span></label>
                    <textarea className="w-full bg-white/40 border-white/50 border rounded-xl p-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base shadow-sm" rows={2} value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)}></textarea>
                  </div>
                </section>
                {/*  5. Attachments  */}
                <section>
                  <h3 className="text-lg font-bold text-blue-700 underline underline-offset-4 mb-6">2. แนบรูปภาพอุปกรณ์</h3>
                  <div className="border-2 border-black rounded-xl p-10 text-center bg-white/20 hover:bg-white/40 transition-all cursor-pointer group shadow-inner min-h-[200px]">
                    <input className="hidden" id="file-upload" accept="image/*" multiple type="file" onChange={handleFileChange} />
                    <label className="cursor-pointer flex flex-col items-center justify-center h-full" htmlFor="file-upload">
                      {!attachments.length && (
                        <>
                          <span className="material-symbols-outlined text-4xl text-primary opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all mb-2 inline-block">{uploading ? 'sync' : 'cloud_upload'}</span>
                          <p className="text-on-surface font-semibold">{uploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดรูปภาพ'}</p>
                        </>
                      )}
                    </label>
                    {attachments.length > 0 && (
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {attachments.map((a, i) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-white/40 shadow-sm">
                            <img src={a.url} alt={a.name} className="w-full h-32 object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
                {/*  6. Approval/Signature Section  */}
                <section className="pt-6">
                  <div className="text-red-500 font-bold text-sm mb-6 space-y-1">
                    <p>หมายเหตุ : 1.การประเมินอาการเสียจะใช้เวลา 1-2 ทำการ โดยจะแจ้งและติดต่อกลับผู้แจ้ง</p>
                    <p className="ml-14">2.การส่งมอบงานซ่อมจะดำเนินการไม่เกิน 7 วัน</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 md:px-12">
                    <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface">ผู้แจ้ง</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2">
                        <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                    <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface">ผู้รับแจ้ง</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2">
                        <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                  </div>
                </section>
                {/*  Form Actions  */}
                <div className="pt-8 flex flex-wrap items-center justify-center gap-4">
                  <button className="text-outline font-bold hover:text-error transition-colors px-4 py-2 text-base" type="reset">ยกเลิก</button>
                  <button className="bg-primary text-on-primary px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูล'}
                    <span className="material-symbols-outlined text-lg">send</span>
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>

    </>
  );
};

export default RepairRequest;
