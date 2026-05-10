import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../lib/firebase';
import { generateDocNo } from '../../lib/db';
import { collection, addDoc, Timestamp, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const RepairRequest = () => {
  const { userProfile } = useAuth();

  const [reporterName, setReporterName] = useState('');
  const [reporterDepartment, setReporterDepartment] = useState('');
  const [reporterJobTitle, setReporterJobTitle] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');

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

  const [assignedAssets, setAssignedAssets] = useState<Array<{ id: string; make: string; model: string; serial: string; warrantyExpiryDate?: string }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      console.log('userProfile:', userProfile);
      setReporterName(`${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim());
      setReporterDepartment(userProfile.department || '');
      setReporterJobTitle(userProfile.position || '');
      setReporterEmail(userProfile.email || '');
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

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      alert('Please login first');
      return;
    }
    setIsSubmitting(true);
    try {
      const newDocNo = await generateDocNo('FM-IT-001', 'repairRequests');
      setDocNo(newDocNo);
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT/root/repairRequests'), {
        docNo: newDocNo,
        requestDate,
        equipmentCategory: {
          computer: eqComputer,
          printer: eqPrinter,
          radio: eqRadio,
          cctv: eqCctv,
          other: eqOther,
          otherText: eqOtherText,
        },
        reporter: {
          name: reporterName,
          department: reporterDepartment,
          jobTitle: reporterJobTitle,
          phone: reporterPhone,
          email: reporterEmail,
        },
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
        },
        attachments: attachments.map((a) => a.url),
        status: 'pending',
        submittedBy: userProfile.email,
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
            detail: `${newDocNo || 'N/A'}: ${composedDetail} | Requester: ${reporterName}`,
          };
          await updateDoc(assetRef, {
            history: [...existingHistory, newEntry],
          });
        }
      }

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
          <span className="material-symbols-outlined text-6xl text-primary mb-4">check_circle</span>
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

      <div className="max-w-[95%] mx-auto p-8 md:p-12">
        {/*  Header Section  */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-secondary-container/80 backdrop-blur-md text-on-secondary-container px-3 py-1 rounded-full text-sm font-bold mb-4 shadow-sm">
              <span className="material-symbols-outlined text-sm">build</span>
              MAINTENANCE PORTAL
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-on-surface mb-4">Repair Request</h1>
            <p className="text-on-surface-variant text-xl max-w-2xl leading-relaxed">
              IT Maintenance Form (FM-IT-001). Please provide accurate technical details to expedite the service.
            </p>
          </div>
          {/*  Formal Trackers  */}
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">Doc No.</label>
              <input className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30" placeholder="FM-IT-001-XXXXXXX" type="text" value={docNo} readOnly />
            </div>
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">Request Date</label>
              <input className="w-full bg-transparent border-none p-0 text-lg font-bold text-on-surface focus:ring-0" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
            </div>
          </div>
        </header>
        {/*  Main Form Canvas  */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 space-y-8">
            <div className="glass-card p-8 md:p-10 rounded-2xl shadow-xl shadow-blue-900/5">
              <form className="space-y-10" onSubmit={handleSubmit}>
                {/*  1. Equipment Category  */}
                <section>
                  <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-6 border-b border-primary-container/30 pb-2">Equipment Category</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqComputer} onChange={(e) => setEqComputer(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">Computer / Laptop</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqPrinter} onChange={(e) => setEqPrinter(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">Printer / Copier</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqRadio} onChange={(e) => setEqRadio(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">Radio Comm.</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqCctv} onChange={(e) => setEqCctv(e.target.checked)} />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">CCTV System</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group col-span-2 md:col-span-1">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={eqOther} onChange={(e) => setEqOther(e.target.checked)} />
                      <input className="flex-1 bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-base py-0 h-6" placeholder="Other..." type="text" value={eqOtherText} onChange={(e) => setEqOtherText(e.target.value)} />
                    </label>
                  </div>
                </section>
                {/*  2. Reporter Information  */}
                <section>
                  <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-6 border-b border-primary-container/30 pb-2">Reporter Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">FULL NAME</label>
                      <input className="w-full bg-white/40 border-white/50 border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm" placeholder="Enter reporter name" type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">DEPARTMENT</label>
                      <input className="w-full bg-white/40 border-white/50 border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm" placeholder="e.g., Engineering" type="text" value={reporterDepartment} onChange={(e) => setReporterDepartment(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">EMAIL</label>
                      <input className="w-full bg-white/40 border-white/50 border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm" placeholder="user@cmg.com" type="email" value={reporterEmail} onChange={(e) => setReporterEmail(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">JOB TITLE</label>
                      <input className="w-full bg-white/40 border-white/50 border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm" placeholder="e.g., Site Supervisor" type="text" value={reporterJobTitle} onChange={(e) => setReporterJobTitle(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">PHONE / EXT.</label>
                      <input className="w-full bg-white/40 border-white/50 border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm" placeholder="033-XXX-XXXX" type="text" value={reporterPhone} onChange={(e) => setReporterPhone(e.target.value)} />
                    </div>
                  </div>
                </section>
                {/*  3. Symptom Checklist & Description  */}
                <section>
                  <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-6 border-b border-primary-container/30 pb-2">Issue Description</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomWontTurnOn} onChange={(e) => setSymptomWontTurnOn(e.target.checked)} />
                      <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">Won't Turn On</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomSlow} onChange={(e) => setSymptomSlow(e.target.checked)} />
                      <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">Slow / Laggy</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomNoPower} onChange={(e) => setSymptomNoPower(e.target.checked)} />
                      <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">No Power</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomBroken} onChange={(e) => setSymptomBroken(e.target.checked)} />
                      <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">Broken / Cracked</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" checked={symptomOther} onChange={(e) => setSymptomOther(e.target.checked)} />
                      <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">Other Symptom</span>
                    </label>
                  </div>
                  <label className="block text-sm font-bold text-on-surface-variant mb-2">DETAILED DESCRIPTION</label>
                  <textarea className="w-full bg-white/40 border-white/50 border rounded-xl p-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all placeholder:text-outline text-base shadow-sm" placeholder="Please describe the issue in detail (e.g., error codes, when it happened)..." rows={4} value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)}></textarea>
                  <p className="text-xs text-error mt-2 italic font-medium">Detailed descriptions help our technicians diagnose and repair issues faster.</p>
                </section>
                {/*  4. Asset Details  */}
                <section>
                  <div className="flex items-center justify-between mb-6 border-b border-primary-container/30 pb-2">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-widest">Asset Information</h3>
                    <span className="text-sm text-on-surface-variant font-bold">SECTION 1: EQUIPMENT DATA</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ASSET ID / REG. NO</label>
                      {assignedAssets.length > 0 ? (
                        <select
                          className="w-full bg-white/40 border-white/50 border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm"
                          value={assetId}
                          onChange={(e) => handleAssetSelect(e.target.value)}
                        >
                          <option value="">Select an asset...</option>
                          {assignedAssets.map((a) => (
                            <option key={a.id} value={a.id}>{a.id}</option>
                          ))}
                        </select>
                      ) : (
                        <input className="w-full bg-white/40 border-white/50 border rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm" placeholder="IT-0482" type="text" value={assetId} onChange={(e) => setAssetId(e.target.value)} />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">BRAND</label>
                      <input className="w-full bg-white/20 border-white/50 border rounded-xl py-3 px-4 cursor-not-allowed opacity-70 shadow-sm" placeholder="e.g., Dell, Apple" type="text" value={assetBrand} readOnly />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">MODEL</label>
                      <input className="w-full bg-white/20 border-white/50 border rounded-xl py-3 px-4 cursor-not-allowed opacity-70 shadow-sm" placeholder="e.g., Precision 5570" type="text" value={assetModel} readOnly />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">SERIAL NUMBER (S/N)</label>
                      <input className="w-full bg-white/20 border-white/50 border rounded-xl py-3 px-4 cursor-not-allowed opacity-70 shadow-sm" placeholder="Enter device serial number" type="text" value={assetSerial} readOnly />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">PURCHASE DATE</label>
                      <input className="w-full bg-white/20 border-white/50 border rounded-xl py-3 px-4 cursor-not-allowed opacity-70 shadow-sm" type="date" value={assetPurchaseDate} readOnly />
                    </div>
                  </div>
                </section>
                {/*  5. Attachments  */}
                <section>
                  <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-6 border-b border-primary-container/30 pb-2">2. Photo Attachments</h3>
                  <div className="border-2 border-dashed border-white/60 rounded-2xl p-10 text-center bg-white/20 hover:bg-white/40 transition-all cursor-pointer group shadow-inner">
                    <input className="hidden" id="file-upload" accept="image/*" multiple type="file" onChange={handleFileChange} />
                    <label className="cursor-pointer" htmlFor="file-upload">
                      <span className="material-symbols-outlined text-4xl text-primary opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all mb-2 inline-block">{uploading ? 'sync' : 'cloud_upload'}</span>
                      <p className="text-on-surface font-semibold">{uploading ? 'Uploading...' : 'Upload photos of equipment damage'}</p>
                      <p className="text-on-surface-variant text-sm mt-1">Include serial number photos if possible (Images only)</p>
                    </label>
                    {attachments.length > 0 && (
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {attachments.map((a, i) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-white/40 shadow-sm">
                            <img src={a.url} alt={a.name} className="w-full h-24 object-cover" />
                            <button
                              type="button"
                              onClick={() => removeAttachment(i)}
                              className="absolute top-1 right-1 bg-error/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
                {/*  6. Approval/Signature Section  */}
                <section className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <div className="h-24 border-b-2 border-white/50 relative flex items-end justify-center pb-2 bg-white/10 rounded-t-xl backdrop-blur-sm">
                        <p className="text-xs text-outline uppercase font-bold absolute bottom-2">Applicant Signature</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-on-surface">Reporter</p>
                        <p className="text-sm text-on-surface-variant">Date: ____/____/____</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-24 border-b-2 border-white/50 relative flex items-end justify-center pb-2 bg-white/20 rounded-t-xl backdrop-blur-sm shadow-inner">
                        <p className="text-xs text-outline uppercase font-bold absolute bottom-2">Receiver Signature</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold text-on-surface">IT Receiver</p>
                        <p className="text-sm text-on-surface-variant">Date: ____/____/____</p>
                      </div>
                    </div>
                  </div>
                </section>
                {/*  Form Actions  */}
                <div className="pt-8 border-t border-white/30 flex items-center justify-between">
                  <button className="text-outline font-bold hover:text-error transition-colors px-4 py-2 text-base" type="reset">Cancel / Reset</button>
                  <button className="bg-primary text-on-primary px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Finalize & Submit'}
                    <span className="material-symbols-outlined text-lg">verified</span>
                  </button>
                </div>
              </form>
            </div>
          </section>
          {/*  Sidebar Contextual Cards  */}
          <aside className="space-y-6">
            {/*  Status Widget  */}
            <div className="glass-card p-8 rounded-2xl shadow-xl shadow-blue-900/5 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-fixed opacity-30 rounded-full blur-3xl"></div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                SLA Targets
              </h3>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-on-surface-variant font-bold uppercase tracking-wider">Assessment</p>
                    <p className="text-2xl font-black text-on-surface">1-2 <span className="text-base font-medium opacity-60">Days</span></p>
                  </div>
                  <div className="w-16 h-1 bg-white/40 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-primary rounded-full"></div>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-on-surface-variant font-bold uppercase tracking-wider">Resolution</p>
                    <p className="text-2xl font-black text-on-surface">&lt; 7 <span className="text-base font-medium opacity-60">Days</span></p>
                  </div>
                  <span className="material-symbols-outlined text-primary text-3xl opacity-30 animate-pulse">schedule</span>
                </div>
              </div>
            </div>
            {/*  Guidelines Card  */}
            <div className="bg-[#C7E7FF]/40 backdrop-blur-md p-8 rounded-2xl border border-white/50 shadow-sm">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-on-secondary-container">
                <span className="material-symbols-outlined">info</span>
                Filing Tips
              </h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">barcode_scanner</span>
                  <p className="text-base text-on-surface-variant">Asset ID must match the sticker on the back of the device.</p>
                </li>
                <li className="flex gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">priority_high</span>
                  <p className="text-base text-on-surface-variant">Mark "No Power" if the device does not respond to a charger.</p>
                </li>
              </ul>
            </div>
            {/*  Technician Preview  */}
            <div className="rounded-2xl overflow-hidden shadow-xl shadow-blue-900/5 border border-white/40 group">
              <div className="h-48 relative">
                <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDICd0dV2SUv7dcvjlrTxSnqKLMzitq9a1Rqqu-a48FQzU4EOyEWrJxvxB-F5VTfOF4ybLEND_T_VidKZ_lE0sTyJUnQJa1RRWRpoUE_WjNy3PRVmLnEdVS3G3XkoJPH--JdL0S94v8gK7gG2UNKH9__uKh3siyjavIkQbV3l16x42rL57sR-H5r5b8QzbAMoIG1OpVP1WUyIgLdu8QRiAvQArnLzVhjZSxtRoU300qT_cTS1CytbsyLgEJ11SwPtmQRkfAdLozhzT" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                  <div>
                    <p className="text-white/70 text-sm font-bold uppercase tracking-widest">On-Duty Technician</p>
                    <p className="text-white font-bold text-lg">Marcus Chen</p>
                    <p className="text-white/80 text-sm">Senior Systems Hardware Lead</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

    </>
  );
};

export default RepairRequest;

