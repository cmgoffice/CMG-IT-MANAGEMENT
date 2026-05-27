import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
// import { useNavigate } from 'react-router-dom';

const Appointment = () => {
  const today = new Date().toISOString().split('T')[0];
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userProfile) return alert('Please login first');
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const reporterName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Unknown';
      const reporterEmail = userProfile.email || 'N/A';

      // Save to specific form collection
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'appointments'), {
        ...data,
        reporter: { name: reporterName, email: reporterEmail },
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Save to Logs
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'logs'), {
        name: reporterName,
        email: reporterEmail,
        action: 'Appointment Requested',
        module: 'Appointment Form (FM-IT-002)',
        ip: 'Internal',
        ok: true,
        createdAt: Timestamp.now(),
      });

      setIsSuccess(true);
      (e.target as HTMLFormElement).reset();
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
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">ใบนัดหมายเข้าหน้างาน</h1>
          </div>
          {/*  Formal Trackers  */}
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">เลขที่ WR</label>
              <input name="wrNumber" className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30" placeholder="FM-IT-002-XXXXXXX" type="text" />
            </div>
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">วันที่</label>
              <input name="requestDate" className="w-full bg-transparent border-none p-0 text-lg font-bold text-on-surface focus:ring-0" type="date" defaultValue={today} />
            </div>
          </div>
        </header>

        {/*  Main Form Canvas  */}
        <div>
          <section className="space-y-8">
            <div className="glass-card p-8 md:p-10 rounded-2xl shadow-xl shadow-blue-900/5 border-2 border-primary/20">
              <form className="space-y-10" onSubmit={handleSubmit}>
                {/* 1. Applicant Information */}
                <section>
                  <h3 className="text-sm font-bold text-primary mb-6 border-b border-primary-container/30 pb-2">ข้อมูลผู้นัดหมาย</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ผู้นัดหมาย</label>
                      <input name="applicantName" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={`${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim()} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ฝ่าย</label>
                      <input name="department" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.department || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">JOB</label>
                      <input name="jobTitle" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.position || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เบอร์โทร</label>
                      <input name="phone" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                  </div>
                </section>

                {/* 2. Schedule & Location */}
                <section>
                  <h3 className="text-sm font-bold text-primary mb-6 border-b border-primary-container/30 pb-2">การนัดหมายและสถานที่</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">วันที่นัดหมาย</label>
                      <input name="appointmentDate" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="date" defaultValue={today} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เวลา</label>
                      <input name="appointmentTime" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="time" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">สถานที่ให้เข้าปฏิบัติงาน</label>
                      <input name="location" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                  </div>
                </section>

                {/* 3. Job Details */}
                <section>
                   <div className="mb-6 pb-2">
                      <h3 className="text-lg font-bold text-blue-700 underline underline-offset-4">1. รายละเอียดที่จะให้เข้าปฏิบัติงาน</h3>
                   </div>
                   <div>
                     <textarea name="jobDetails" className="w-full bg-white/40 border-white/50 border rounded-xl p-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base shadow-sm" rows={4} placeholder="อธิบายรายละเอียดงาน..."></textarea>
                   </div>
                   
                   <div className="mt-6 flex flex-col gap-4">
                      <label className="block text-sm font-bold text-on-surface-variant">การเตรียมพร้อมอุปกรณ์หน้างาน</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input name="prepareTools" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                          <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">ต้องจัดเตรียมเครื่องมือไปด้วย ตามรายละเอียดงาน</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input name="assessEquipment" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                          <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">ต้องเข้าประเมินการใช้วัสดุอุปกรณ์ก่อน</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input name="toolsPrepared" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                          <span className="text-base font-medium text-on-surface-variant group-hover:text-primary transition-colors">จัดเตรียมเครื่องมือไว้แล้ว</span>
                        </label>
                      </div>
                   </div>
                </section>

                {/* 4. Photos */}
                <section>
                  <h3 className="text-lg font-bold text-blue-700 underline underline-offset-4 mb-6">2. แนบรูปภาพหน้างาน หรือ งานที่จะให้เข้าดำเนินการ</h3>
                  <div className="border-2 border-black rounded-xl p-10 text-center bg-white/20 hover:bg-white/40 transition-all cursor-pointer group shadow-inner min-h-[200px]">
                    <label className="cursor-pointer flex flex-col items-center justify-center h-full">
                       <span className="material-symbols-outlined text-4xl text-primary opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all mb-2 inline-block">cloud_upload</span>
                       <p className="text-on-surface font-semibold">คลิกเพื่ออัปโหลดรูปภาพ</p>
                    </label>
                  </div>
                </section>

                {/* 5. Approval/Signature */}
                <section className="pt-6">
                  <div className="text-red-500 font-bold text-sm mb-6 space-y-1">
                    <p>หมายเหตุ : 1. ให้ทำการแจ้งขอสนับสนุนหน่วยงานไอทีก่อนล่วงหน้าให้เข้าปฏิบัติงานอย่างน้อย 2 วัน</p>
                    <p className="ml-14">2. เพื่อให้ชัดเจนในการปฏิบัติงาน โปรดอธิบายงานเบื้องต้น</p>
                    <p className="ml-14">3. ให้ประเมินการเข้าปฏิบัติงานทุกครั้ง</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 md:px-12">
                    <div className="border-2 border-black rounded-3xl p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface">ผู้แจ้งนัดหมาย</p>
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

export default Appointment;
