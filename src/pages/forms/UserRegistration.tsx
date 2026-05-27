
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
// import { useNavigate } from 'react-router-dom';

const UserRegistration = () => {
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
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'userRegistrations'), {
        ...data,
        reporter: { name: reporterName, email: reporterEmail },
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Save to Logs
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'logs'), {
        name: reporterName,
        email: reporterEmail,
        action: 'User Access Requested',
        module: 'User Registration Form (FM-IT-006)',
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
              <span className="material-symbols-outlined text-sm">assignment_add</span>
              เอกสารหน่วยงาน IT/CMG (เอกสารต้นฉบับ-สำเนา)
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">ใบขอลงทะเบียน / ใช้งาน / เข้าถึงข้อมูล</h1>
          </div>
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">เลขที่ WR</label>
              <input name="wrNumber" className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30" placeholder="FM-IT-006-XXXXXXX" type="text" />
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

                {/* ประเภทการขอ */}
                <section>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-12">
                    <h3 className="text-sm font-bold text-on-surface-variant whitespace-nowrap mt-2 w-24">ประเภทการขอ</h3>
                    <div className="flex flex-col gap-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="req_email" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ขอสมัครใช้งาน Email</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="req_storage" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ขอใช้งานพื้นที่จัดเก็บข้อมูล ส่วนกลาง</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="req_cctv" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ขอใช้งาน การเข้าถึงข้อมูล CCTV Online</span>
                      </label>
                    </div>
                  </div>
                </section>

                {/* กรอกข้อมูล */}
                <section className="border-2 border-primary/20 rounded-xl p-6 bg-white/20 relative mt-4">
                  <h3 className="text-lg font-bold text-on-surface mb-6">กรอกข้อมูล</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ชื่อ - สกุล</label>
                      <input name="applicantName" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={`${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim()} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ตำแหน่ง</label>
                      <input name="jobTitle" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.position || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">แผนก/ฝ่าย</label>
                      <input name="department" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" defaultValue={userProfile?.department || ''} />
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
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">วันที่ต้องการใช้งาน</label>
                      <input name="dateOfUse" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="date" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เหตุผล</label>
                      <input name="reason" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">Email</label>
                      <input name="email" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="email" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">การเข้าถึงข้อมูล</label>
                      <input name="dataAccessDetails" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                      <input name="dataAccessDetails_2" className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all mt-2" type="text" />
                    </div>
                  </div>
                </section>

                {/* Remarks */}
                <div className="text-error font-bold text-sm space-y-1 mt-4">
                  <p>หมายเหตุ : 1.ในกรณีที่สมัคร Email ตามที่ระบุมาไม่ได้ทาง IT จะดำเนินการสมัครให้โดยแก้ไขข้อความบางส่วน</p>
                  <p className="ml-14">2.การขอเข้าถึงข้อมูลจากภายนอก ต้องรออนุมัติระยะเวลาประมาณ 1-2 วัน</p>
                  <p className="ml-14">3.กรุณาระบุ Username และ Password ที่จะให้สมัครให้ชัดเจน</p>
                </div>

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
                        <label className="block text-sm font-bold text-on-surface-variant w-40">รายการที่ดำเนินการ</label>
                        <input name="it_actionDone" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                      </div>
                      <div className="flex items-center">
                        <label className="block text-sm font-bold text-on-surface-variant w-40">Username ที่สมัครให้</label>
                        <input name="it_username" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
                      </div>
                      <div className="flex items-center">
                        <label className="block text-sm font-bold text-on-surface-variant w-40">Password ที่สมัครให้</label>
                        <input name="it_password" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all" type="text" />
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

export default UserRegistration;
