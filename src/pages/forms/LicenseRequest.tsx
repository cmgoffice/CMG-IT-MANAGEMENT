import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { generateDocNo, ROOT_COLLECTION, ROOT_DOCUMENT } from '../../lib/db';
import { buildReporterSubmissionMeta } from '../../lib/formSubmission';
// import { useNavigate } from 'react-router-dom';

const LicenseRequest = () => {
  const today = new Date().toISOString().split('T')[0];
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wrNumber, setWrNumber] = useState('');
  const [requestDate, setRequestDate] = useState(today);
  // const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const loadDocNo = async () => {
      try {
        const newDocNo = await generateDocNo('FM-IT-005', 'licenseRequests');
        if (!cancelled) {
          setWrNumber(newDocNo);
        }
      } catch (error) {
        console.error('Failed to generate FM-IT-005 number:', error);
      }
    };

    loadDocNo();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userProfile) return alert('Please login first');
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const latestWrNumber = await generateDocNo('FM-IT-005', 'licenseRequests');
      setWrNumber(latestWrNumber);

      const submissionMeta = buildReporterSubmissionMeta(userProfile, data);

      // Save to specific form collection
      await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'licenseRequests'), {
        ...data,
        docNo: latestWrNumber,
        wrNumber: latestWrNumber,
        requestDate,
        submittedBy: submissionMeta.submittedBy,
        reporter: submissionMeta.reporter,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Save to Logs
      await addDoc(collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'logs'), {
        name: submissionMeta.reporterName,
        email: submissionMeta.reporterEmail,
        action: 'License Requested',
        module: 'License Request Form (FM-IT-005)',
        ip: 'Internal',
        ok: true,
        createdAt: Timestamp.now(),
      });

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit.');
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
          <p className="text-on-surface-variant mb-6">Your license request has been saved.</p>
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
              <span className="material-symbols-outlined text-sm">assignment_add</span>
              เอกสารหน่วยงาน IT/CMG (เอกสารต้นฉบับ-สำเนา)
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">ใบขอเปิดสิทธิ์ License / ขอต่อ License</h1>
          </div>
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">เลขที่ WR</label>
              <input name="wrNumber" className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30" placeholder="FM-IT-005-XXXXXXX" type="text" value={wrNumber} readOnly />
            </div>
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">วันที่</label>
              <input name="requestDate" className="w-full bg-transparent border-none p-0 text-lg font-bold text-on-surface focus:ring-0" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
            </div>
          </div>
        </header>

        {/*  Main Form Canvas  */}
        <div>
          <section className="space-y-8">
            <div className="glass-card p-8 md:p-10 rounded-2xl shadow-xl shadow-blue-900/5 border-2 border-primary/20">
              <form className="space-y-10" onSubmit={handleSubmit}>

                {/* ประเภท */}
                <section>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-12">
                    <h3 className="text-sm font-bold text-on-surface-variant whitespace-nowrap mt-2 w-24">ประเภท</h3>
                    <div className="flex flex-col gap-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="reqType_new" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ขอเปิดสิทธิ์ใช้งาน License (ครั้งแรก)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="reqType_renew" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ขอต่ออายุการใช้ License</span>
                      </label>
                    </div>
                  </div>
                </section>

                {/* โปรแกรมที่ใช้งาน */}
                <section>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-12">
                    <h3 className="text-sm font-bold text-on-surface-variant whitespace-nowrap mt-2 w-24">โปรแกรมที่ใช้งาน</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="sw_office" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">License Microsoft Office 365+</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="sw_windows" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">License Windows</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="sw_sketchup" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">License Sketchup 3D</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="sw_autodesk" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">License Autodesk</span>
                      </label>
                      <div className="flex items-end gap-2">
                         <label className="flex items-center gap-3 cursor-pointer group whitespace-nowrap">
                           <input name="sw_other" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                           <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ระบุ</span>
                         </label>
                         <input name="sw_otherText" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-1 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="sw_adobe" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">License Adobe</span>
                      </label>
                    </div>
                  </div>
                </section>

                {/* ผู้ขอ */}
                <section className="border-2 border-primary/20 rounded-xl p-6 bg-white/20 relative mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ผู้ขอ</label>
                      <input name="applicantName" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={`${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim()} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ตำแหน่ง</label>
                      <input name="jobTitle" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.position || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ฝ่าย</label>
                      <input name="department" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.department || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">JOB</label>
                      <input name="jobName" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เบอร์โทร</label>
                      <input name="phone" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div className="md:col-span-3 mt-4">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เหตุผล</label>
                      <input name="reason" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                  </div>
                </section>

                {/* Approval/Signature */}
                <section className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 md:px-12 mb-10 border-b-4 border-black pb-10">
                    <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface">ผู้ขอ</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2">
                        <span className="text-base font-bold text-on-surface">วันที่</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                    <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface">ผู้อนุมัติ</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2">
                        <span className="text-base font-bold text-on-surface">วันที่</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h3 className="text-xl font-bold text-on-surface mb-6">( ส่วนงาน IT )</h3>
                    
                    <div className="space-y-4 max-w-2xl px-6">
                      <div className="flex items-center">
                        <label className="block text-sm font-bold text-on-surface-variant w-40">โปรแกรมที่ลงทะเบียน</label>
                        <input name="it_registeredProgram" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                      </div>
                      <div className="flex items-center">
                        <label className="block text-sm font-bold text-on-surface-variant w-40">รายละเอียด Packet License</label>
                        <input name="it_packetDetails" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                      </div>
                      <div className="flex items-center">
                        <label className="block text-sm font-bold text-on-surface-variant w-40">วันเริ่มต้นใช้งาน</label>
                        <input name="it_startDate" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="date" />
                      </div>
                      <div className="flex items-center">
                        <label className="block text-sm font-bold text-on-surface-variant w-40">วันหมดอายุ</label>
                        <input name="it_expireDate" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="date" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 md:px-12 mt-10">
                      <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                        <p className="text-lg font-bold text-on-surface">ผู้ดำเนินการ</p>
                        <div className="border-b border-black w-3/4 mx-auto"></div>
                        <div className="flex items-end justify-center gap-2">
                          <span className="text-base font-bold text-on-surface">วันที่</span>
                          <div className="border-b border-black w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Form Actions */}
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

export default LicenseRequest;
