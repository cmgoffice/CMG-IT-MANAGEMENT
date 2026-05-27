import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { generateDocNo } from '../../lib/db';
// import { useNavigate } from 'react-router-dom';

const AssetRequest = () => {
  const today = new Date().toISOString().split('T')[0];
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [wrNumber, setWrNumber] = useState('');
  const [requestDate, setRequestDate] = useState(today);
  // const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const loadDocNo = async () => {
      try {
        const newDocNo = await generateDocNo('FM-IT-003', 'assetRequests');
        if (!cancelled) {
          setWrNumber(newDocNo);
        }
      } catch (error) {
        console.error('Failed to generate FM-IT-003 number:', error);
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
    if (!wrNumber) return alert('Document number is not ready yet. Please try again.');
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const reporterName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Unknown';
      const reporterEmail = userProfile.email || 'N/A';
      const reporterDepartment = typeof data.department === 'string' ? data.department : userProfile.department || '';
      const reporterJobTitle = typeof data.jobTitle === 'string' ? data.jobTitle : userProfile.position || '';
      const reporterPhone = typeof data.phone === 'string' ? data.phone : '';

      // Save to specific form collection
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'assetRequests'), {
        ...data,
        docNo: wrNumber,
        wrNumber,
        requestDate,
        reporter: {
          name: reporterName,
          email: reporterEmail,
          department: reporterDepartment,
          jobTitle: reporterJobTitle,
          phone: reporterPhone,
        },
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Save to Logs
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'logs'), {
        name: reporterName,
        email: reporterEmail,
        action: 'Asset Requested',
        module: 'Asset Request Form (FM-IT-003)',
        ip: 'Internal',
        ok: true,
        createdAt: Timestamp.now(),
      });

      setIsSuccess(true);
      form.reset();
      setRequestDate(today);
      try {
        const nextDocNo = await generateDocNo('FM-IT-003', 'assetRequests');
        setWrNumber(nextDocNo);
      } catch (error) {
        console.error('Failed to refresh FM-IT-003 number:', error);
        setWrNumber('');
      }
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to submit.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">ใบขอเบิกอุปกรณ์ IT / เปลี่ยนผู้ใช้งาน</h1>
          </div>
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">เลขที่ WR</label>
              <input name="wrNumber" className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30" placeholder="FM-IT-003-XXXXXXX" type="text" value={wrNumber} readOnly />
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
                {/* ระบุความต้องการ */}
                <section>
                  <h3 className="text-sm font-bold text-primary mb-6 border-b border-primary-container/30 pb-2">ระบุความต้องการ</h3>
                  <div className="flex gap-8">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input name="reqType_new" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">ขอเบิกอุปกรณ์ IT</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input name="reqType_change" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                      <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">ขอเปลี่ยนผู้ใช้งาน</span>
                    </label>
                  </div>
                </section>

                {/* ผู้ขอ */}
                <section>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ผู้ขอ</label>
                      <input name="applicantName" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={`${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim()} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ฝ่าย</label>
                      <input name="department" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.department || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ตำแหน่ง</label>
                      <input name="jobTitle" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.position || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">JOB</label>
                      <input name="jobName" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เบอร์โทร</label>
                      <input name="phone" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">วันที่ขอใช้งาน</label>
                      <input name="dateOfUse" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="date" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เหตุผล</label>
                      <input name="reason" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                  </div>
                </section>

                {/* ประเภท */}
                <section>
                  <div className="flex gap-4">
                    <h3 className="text-sm font-bold text-on-surface-variant whitespace-nowrap">ประเภท</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eqComputer" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">คอมพิวเตอร์/โน้ตบุ๊ค</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eqPrinter" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">เครื่องพิมพ์/ถ่ายเอกสาร</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eqCctv" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">กล้องวงจรปิด</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eqRadio" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">วิทยุสื่อสาร</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eqMonitor" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">จอภาพ</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input name="eqOther" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                          <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors whitespace-nowrap">อุปกรณ์ IT อื่นๆ</span>
                        </label>
                      </div>
                      <div className="flex items-end gap-2 md:col-span-2">
                         <span className="text-base text-on-surface-variant">จำนวน</span>
                         <input name="eqQuantity" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-1 px-2 focus:ring-0 focus:border-primary transition-all text-center" type="text" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* เปลี่ยนผู้ใช้งาน */}
                <section>
                  <h3 className="text-lg font-bold text-on-surface underline underline-offset-4 mb-6">เปลี่ยนผู้ใช้งาน</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">หมายเลขทรัพย์สิน</label>
                      <input name="assetId" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">รุ่น</label>
                      <input name="model" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">หมายเลข S/N</label>
                      <input name="serialNumber" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ชื่อผู้ใช้งานเดิม</label>
                      <input name="previousUser" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ตำแหน่ง</label>
                      <input name="previousPosition" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">JOB</label>
                      <input name="previousJob" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เหตุผลที่ขอเปลี่ยน</label>
                      <input name="changeReason" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                  </div>
                </section>

                {/* 5. Approval/Signature */}
                <section className="pt-6">
                  <div className="text-red-500 font-bold text-sm mb-6 space-y-1">
                    <p>หมายเหตุ : 1. การกรอกใบยืม-คืนอุปกรณ์ไอทีให้ทำใบต่อ 1 รายการ</p>
                    <p className="ml-14">2. โปรดตรวจสอบอุปกรณ์ไอทีก่อนรับมอบทุกครั้งผู้ยืมจะรับผิดชอบอุปกรณ์ทรัพย์สินของบริษัทตลอดจนการส่งคืน</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 md:px-12 mb-10 border-b-4 border-black pb-10">
                    <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface">ผู้แจ้งขอ</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2">
                        <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                    <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface">ผู้อนุมัติ</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2">
                        <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <h3 className="text-lg font-bold text-on-surface underline underline-offset-4 mb-6">ส่วนรับของ</h3>
                    <div className="w-1/2 mb-8">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">หมายเลขทรัพย์สิน</label>
                      <input name="receiveAssetId" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 md:px-12">
                      <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                        <p className="text-lg font-bold text-on-surface">ผู้ส่งมอบ</p>
                        <div className="border-b border-black w-3/4 mx-auto"></div>
                        <div className="flex items-end justify-center gap-2">
                          <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                          <div className="border-b border-black w-1/2"></div>
                        </div>
                      </div>
                      <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                        <p className="text-lg font-bold text-on-surface">ผู้รับของ</p>
                        <div className="border-b border-black w-3/4 mx-auto"></div>
                        <div className="flex items-end justify-center gap-2">
                          <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                          <div className="border-b border-black w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Form Actions */}
                <div className="pt-8 flex items-center justify-between">
                  <button className="text-outline font-bold hover:text-error transition-colors px-4 py-2 text-base" type="reset">ยกเลิก</button>
                  <button className="bg-primary text-on-primary px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50" type="submit" disabled={isSubmitting || isSuccess}>
                    {isSubmitting ? 'กำลังส่งข้อมูล...' : isSuccess ? 'ส่งสำเร็จ!' : 'ส่งข้อมูล'}
                    <span className="material-symbols-outlined text-lg">{isSuccess ? 'check_circle' : 'send'}</span>
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

export default AssetRequest;
