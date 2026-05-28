
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { generateDocNo } from '../../lib/db';
// import { useNavigate } from 'react-router-dom';

const RemoteSupport = () => {
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
        const newDocNo = await generateDocNo('FM-IT-007', 'remoteSupports');
        if (!cancelled) {
          setWrNumber(newDocNo);
        }
      } catch (error) {
        console.error('Failed to generate FM-IT-007 number:', error);
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
      const reporterPhone = typeof data.phone === 'string' ? data.phone : '';

      // Save to specific form collection
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'remoteSupports'), {
        ...data,
        docNo: wrNumber,
        wrNumber,
        requestDate,
        reporter: {
          name: reporterName,
          email: reporterEmail,
          department: reporterDepartment,
          phone: reporterPhone,
        },
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Save to Logs
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'logs'), {
        name: reporterName,
        email: reporterEmail,
        action: 'Remote Support Requested',
        module: 'Remote Support Form (FM-IT-007)',
        ip: 'Internal',
        ok: true,
        createdAt: Timestamp.now(),
      });

      setIsSuccess(true);
      form.reset();
      setRequestDate(today);
      try {
        const nextDocNo = await generateDocNo('FM-IT-007', 'remoteSupports');
        setWrNumber(nextDocNo);
      } catch (error) {
        console.error('Failed to refresh FM-IT-007 number:', error);
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
              <span className="material-symbols-outlined text-sm">assignment_add</span>
              เอกสารหน่วยงาน IT/CMG (เอกสารต้นฉบับ-สำเนา)
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">ใบขอ สนับสนุนการใช้งานอุปกรณ์ IT</h1>
          </div>
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">เลขที่ WR</label>
              <input name="wrNumber" className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30" placeholder="FM-IT-007-XXXXXXX" type="text" value={wrNumber} readOnly />
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
                    <h3 className="text-base font-bold text-on-surface-variant whitespace-nowrap mt-2 w-24">ประเภท</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-8 flex-1">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eq_computer" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">คอมพิวเตอร์/โน๊ตบุ๊ค</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eq_printer" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">เครื่องพิมพ์/ถ่ายเอกสาร</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eq_radio" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">วิทยุสื่อสาร</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eq_cctv" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">กล้องวงจรปิด</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="eq_other" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">อื่นๆ</span>
                      </label>
                    </div>
                  </div>
                </section>

                {/* ผู้ใช้งาน */}
                <section>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                    <div className="flex items-center gap-4 flex-1 min-w-[250px]">
                      <label className="text-base font-bold text-on-surface-variant whitespace-nowrap">ผู้ขอใช้งาน</label>
                      <input name="applicantName" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all min-w-0" type="text" defaultValue={`${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim()} />
                    </div>
                    
                    <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                      <label className="text-base font-bold text-on-surface-variant whitespace-nowrap">ฝ่าย</label>
                      <input name="department" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all min-w-0" type="text" defaultValue={userProfile?.department || ''} />
                    </div>

                    <div className="flex items-center gap-4 flex-1 min-w-[150px]">
                      <label className="text-base font-bold text-on-surface-variant whitespace-nowrap">JOB</label>
                      <input name="jobName" className="flex-1 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all min-w-0" type="text" />
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto md:min-w-[200px]">
                      <label className="text-base font-bold text-on-surface-variant whitespace-nowrap">เบอร์โทร</label>
                      <input name="phone" className="flex-1 md:w-32 bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all min-w-0" type="text" />
                    </div>
                  </div>
                </section>

                {/* อาการ */}
                <section>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-12 pt-2">
                    <h3 className="text-base font-bold text-on-surface-variant whitespace-nowrap mt-2 w-24">อาการ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-8 flex-1">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="symp_slow" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ปัญหา ช้า / กระตุก</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="symp_software" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ลงโปรแกรม / แก้ไขโปรแกรม</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="symp_check" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">ตรวจเช็คเบื้องต้น</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="symp_support" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">สนับสนุนการใช้งาน</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input name="symp_other" value="true" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                        <span className="text-base text-on-surface-variant group-hover:text-on-surface transition-colors">อื่นๆ</span>
                      </label>
                    </div>
                  </div>
                </section>

                {/* 1.ส่วนกรอกข้อมูลรายละเอียด */}
                <section className="pt-4">
                  <h3 className="text-xl font-bold text-blue-600 underline mb-6">
                    1.ส่วนกรอกข้อมูลรายละเอียด <span className="text-red-500 font-normal text-lg underline-none ml-2">(การอธิบายอย่างละเอียดช่วยให้แก้ไขทำได้รวดเร็วยิ่งขึ้น)</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <label className="block text-base font-bold text-on-surface-variant whitespace-nowrap w-36">ระบุความต้องการ</label>
                      <input name="requirements" className="flex-1 bg-transparent border-outline-variant border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary border-dashed transition-all" type="text" />
                    </div>
                    <div className="flex items-center">
                      <div className="w-36"></div>
                      <input name="requirements_2" className="flex-1 bg-transparent border-outline-variant border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary border-dashed transition-all" type="text" />
                    </div>
                    <div className="flex items-center">
                      <div className="w-36"></div>
                      <input name="requirements_3" className="flex-1 bg-transparent border-outline-variant border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary border-dashed transition-all" type="text" />
                    </div>

                    <div className="flex items-center pt-4">
                      <label className="block text-base font-bold text-on-surface-variant whitespace-nowrap w-36">โปรแกรมที่ Remote</label>
                      <input name="remoteProgram" className="flex-1 bg-transparent border-outline-variant border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary border-dashed transition-all" type="text" />
                      
                      <label className="block text-base font-bold text-on-surface-variant whitespace-nowrap ml-8 mr-4">หมายเลขรีโมท</label>
                      <input name="remoteId" className="flex-1 bg-transparent border-outline-variant border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary border-dashed transition-all font-mono" type="text" />
                    </div>

                    <div className="flex items-center pt-4">
                      <label className="block text-base font-bold text-on-surface-variant whitespace-nowrap w-36">การนัดหมายเวลา</label>
                      <input name="appointmentTime" className="w-1/2 bg-transparent border-outline-variant border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary border-dashed transition-all" type="text" />
                    </div>
                  </div>
                </section>

                {/* Remarks */}
                <div className="text-red-600 font-bold text-sm space-y-2 mt-8 pt-6 border-t border-red-200">
                  <p>หมายเหตุ : 1. การ Remote Support อาจจะลงโปรแกรมที่มีขนาดไฟล์ไม่มาก หากต้องการโปรแกรมใหญ่ ต้องส่งเครื่องมาที่ IT</p>
                  <p className="ml-14">2. สิ่งที่ต้องเตรียมพร้อมสำหรับการขอ Remote ช่วยเหลือ</p>
                  <p className="ml-20 font-medium">- อุปกรณ์ ต้องเชื่อมต่อ Internet ไว้ตลอดระยะเวลาการ Remote</p>
                  <p className="ml-20 font-medium">- หากเป็น Notebook ต้องเสียบสายชาร์จแบตไว้</p>
                  <p className="ml-20 font-medium">- ระหว่างที่ Remote ไม่ปิดโปรแกรม Remote ในขณะที่ทำงาน</p>
                </div>

                {/* Approval/Signature */}
                <section className="pt-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4 md:px-12">
                    <div className="border-2 border-black rounded-[2.5rem] p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface mt-4">ผู้แจ้ง</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2 pb-4">
                        <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                    <div className="border-2 border-black rounded-[2.5rem] p-6 text-center space-y-8 bg-white/30 backdrop-blur-sm">
                      <p className="text-lg font-bold text-on-surface mt-4">ผู้รับแจ้ง</p>
                      <div className="border-b border-black w-3/4 mx-auto"></div>
                      <div className="flex items-end justify-center gap-2 pb-4">
                        <span className="text-base font-bold text-on-surface">วันที่ (Date)</span>
                        <div className="border-b border-black w-1/2"></div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Form Actions */}
                <div className="pt-8 flex flex-wrap items-center justify-center gap-4">
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

export default RemoteSupport;
