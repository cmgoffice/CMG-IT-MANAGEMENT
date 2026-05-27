import { useEffect, useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../lib/firebase';
import { generateDocNo } from '../../lib/db';

const Appointment = () => {
  const today = new Date().toISOString().split('T')[0];
  const { userProfile } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [wrNumber, setWrNumber] = useState('');
  const [requestDate, setRequestDate] = useState(today);
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    const loadDocNo = async () => {
      try {
        const newDocNo = await generateDocNo('FM-IT-002', 'appointments');
        if (!cancelled) {
          setWrNumber(newDocNo);
        }
      } catch (error) {
        console.error('Failed to generate FM-IT-002 number:', error);
      }
    };

    loadDocNo();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploaded: Array<{ name: string; url: string }> = [];

    for (const file of Array.from(files)) {
      try {
        const storageRef = ref(storage, `appointments/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploaded.push({ name: file.name, url });
      } catch (error) {
        console.error('Upload error:', error);
      }
    }

    setAttachments((prev) => [...prev, ...uploaded]);
    setUploading(false);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userProfile) return alert('Please login first');
    if (!wrNumber) return alert('Document number is not ready yet. Please try again.');

    setIsSubmitting(true);
    const form = e.currentTarget;

    const formData = new FormData(form);
    const applicantName = String(formData.get('applicantName') || '').trim();
    const department = String(formData.get('department') || '').trim();
    const jobTitle = String(formData.get('jobTitle') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const appointmentDate = String(formData.get('appointmentDate') || '').trim();
    const appointmentTime = String(formData.get('appointmentTime') || '').trim();
    const location = String(formData.get('location') || '').trim();
    const jobDetails = String(formData.get('jobDetails') || '').trim();
    const prepareTools = formData.get('prepareTools') === 'true' ? 'true' : 'false';
    const assessEquipment = formData.get('assessEquipment') === 'true' ? 'true' : 'false';
    const toolsPrepared = formData.get('toolsPrepared') === 'true' ? 'true' : 'false';

    try {
      const reporterName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Unknown';
      const reporterEmail = userProfile.email || 'N/A';
      const reporterDepartment = department || userProfile.department || '';
      const reporterJobTitle = jobTitle || userProfile.position || '';
      const reporterPhone = phone;

      const payload = {
        applicantName,
        department,
        jobTitle,
        phone,
        appointmentDate,
        appointmentTime,
        location,
        jobDetails,
        prepareTools,
        assessEquipment,
        toolsPrepared,
        docNo: wrNumber,
        wrNumber,
        requestDate,
        attachments: attachments.map((attachment) => attachment.url),
        submittedBy: reporterEmail,
        reporter: {
          name: reporterName,
          email: reporterEmail,
          department: reporterDepartment,
          jobTitle: reporterJobTitle,
          phone: reporterPhone,
        },
        status: 'pending',
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'appointments'), payload);

      try {
        await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'logs'), {
          name: reporterName,
          email: reporterEmail,
          action: 'Appointment Requested',
          module: 'Appointment Form (FM-IT-002)',
          ip: 'Internal',
          ok: true,
          createdAt: Timestamp.now(),
        });
      } catch (logError) {
        console.error('Failed to write appointment log:', logError);
      }

      setIsSuccess(true);
      form.reset();
      setAttachments([]);
      setRequestDate(today);

      try {
        const nextDocNo = await generateDocNo('FM-IT-002', 'appointments');
        setWrNumber(nextDocNo);
      } catch (error) {
        console.error('Failed to refresh FM-IT-002 number:', error);
        setWrNumber('');
      }

      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Appointment submit failed:', err);
      const detail = err?.code || err?.message || String(err);
      alert(`Failed to submit. ${detail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="max-w-5xl mx-auto p-8 md:p-12">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-secondary-container/80 backdrop-blur-md text-on-secondary-container px-3 py-1 rounded-full text-sm font-bold mb-4 shadow-sm">
              <span className="material-symbols-outlined text-sm">build</span>
              เอกสารหน่วยงาน IT/CMG (เอกสารต้นฉบับ-สำเนา)
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-4">ใบนัดหมายเข้าหน้างาน</h1>
          </div>
          <div className="flex gap-4">
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">เลขที่ WR</label>
              <input
                name="wrNumber"
                className="w-full bg-transparent border-none p-0 text-xl font-black text-on-surface focus:ring-0 placeholder:opacity-30"
                placeholder="FM-IT-002-XXXXXXX"
                type="text"
                value={wrNumber}
                readOnly
              />
            </div>
            <div className="glass-card p-4 rounded-xl min-w-[140px] shadow-sm">
              <label className="block text-xs font-bold text-primary uppercase mb-1">วันที่</label>
              <input
                name="requestDate"
                className="w-full bg-transparent border-none p-0 text-lg font-bold text-on-surface focus:ring-0"
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
              />
            </div>
          </div>
        </header>

        <div>
          <section className="space-y-8">
            <div className="glass-card p-8 md:p-10 rounded-2xl shadow-xl shadow-blue-900/5 border-2 border-primary/20">
              <form className="space-y-10" onSubmit={handleSubmit}>
                <section>
                  <h3 className="text-sm font-bold text-primary mb-6 border-b border-primary-container/30 pb-2">ข้อมูลผู้นัดหมาย</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ผู้นัดหมาย</label>
                      <input
                        name="applicantName"
                        className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all"
                        type="text"
                        defaultValue={`${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">ฝ่าย</label>
                      <input
                        name="department"
                        className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all"
                        type="text"
                        defaultValue={userProfile?.department || ''}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">JOB</label>
                      <input
                        name="jobTitle"
                        className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all"
                        type="text"
                        defaultValue={userProfile?.position || ''}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เบอร์โทร</label>
                      <input
                        name="phone"
                        className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all"
                        type="text"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-primary mb-6 border-b border-primary-container/30 pb-2">การนัดหมายและสถานที่</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">วันที่นัดหมาย</label>
                      <input
                        name="appointmentDate"
                        className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all"
                        type="date"
                        defaultValue={today}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">เวลา</label>
                      <input
                        name="appointmentTime"
                        className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all"
                        type="time"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-on-surface-variant mb-2">สถานที่ให้เข้าปฏิบัติงาน</label>
                      <input
                        name="location"
                        className="w-full bg-white/40 border-white/50 border-b-2 border-t-0 border-l-0 border-r-0 py-2 px-2 focus:ring-0 focus:border-primary transition-all"
                        type="text"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-6 pb-2">
                    <h3 className="text-lg font-bold text-blue-700 underline underline-offset-4">1. รายละเอียดที่จะให้เข้าปฏิบัติงาน</h3>
                  </div>
                  <div>
                    <textarea
                      name="jobDetails"
                      className="w-full bg-white/40 border-white/50 border rounded-xl p-4 focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base shadow-sm"
                      rows={4}
                      placeholder="อธิบายรายละเอียดงาน..."
                    ></textarea>
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

                <section>
                  <h3 className="text-lg font-bold text-blue-700 underline underline-offset-4 mb-6">2. แนบรูปภาพหน้างาน หรือ งานที่จะให้เข้าดำเนินการ</h3>
                  <div className="border-2 border-black rounded-xl p-10 text-center bg-white/20 hover:bg-white/40 transition-all cursor-pointer group shadow-inner min-h-[200px]">
                    <input className="hidden" id="appointment-file-upload" accept="image/*" multiple type="file" onChange={handleFileChange} />
                    <label className="cursor-pointer flex flex-col items-center justify-center h-full" htmlFor="appointment-file-upload">
                      {!attachments.length && (
                        <>
                          <span className="material-symbols-outlined text-4xl text-primary opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all mb-2 inline-block">{uploading ? 'sync' : 'cloud_upload'}</span>
                          <p className="text-on-surface font-semibold">{uploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดรูปภาพ'}</p>
                        </>
                      )}
                    </label>

                    {attachments.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                        {attachments.map((attachment, index) => (
                          <div key={`${attachment.url}-${index}`} className="relative group rounded-lg overflow-hidden border border-white/40 shadow-sm bg-white/40">
                            <img src={attachment.url} alt={attachment.name} className="w-full h-32 object-cover" />
                            <button
                              type="button"
                              onClick={() => removeAttachment(index)}
                              className="absolute top-1 right-1 bg-error/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`Remove ${attachment.name}`}
                            >
                              <span className="material-symbols-outlined text-base">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

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

                <div className="pt-8 flex items-center justify-between">
                  <button className="text-outline font-bold hover:text-error transition-colors px-4 py-2 text-base" type="reset">ยกเลิก</button>
                  <button className="bg-primary text-on-primary px-10 py-4 rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50" type="submit" disabled={isSubmitting || isSuccess || uploading}>
                    {isSubmitting ? 'กำลังส่งข้อมูล...' : isSuccess ? 'ส่งสำเร็จ!' : uploading ? 'กำลังอัปโหลดรูป...' : 'ส่งข้อมูล'}
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
