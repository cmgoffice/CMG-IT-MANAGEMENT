
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const UserRegistration = () => {
  const today = new Date().toISOString().split('T')[0];
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

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

<header className="flex justify-between items-start mb-12 max-w-[95%] mx-auto">
<div>
<h1 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2">FM-IT-006</h1>
<p className="text-on-surface-variant font-medium">System Registration &amp; Access Management</p>
</div>
<div className="flex items-center gap-4">
<button className="bg-white/60 backdrop-blur-md p-2.5 rounded-full shadow-sm hover:shadow-md transition-all border border-white/40">
<span className="material-symbols-outlined text-on-surface-variant">notifications</span>
</button>
<div className="h-10 w-10 rounded-full border-2 border-white overflow-hidden shadow-sm">
<img alt="Administrator" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2DE459IR6vOIiHjvTQkk7C2dreqV9sBrr00HkjaoZSBXzj4xNEQLzUrGQBTUYMqS12gJN01ihHEIbgFvVupc5zk2R-2LiLSSnjiS3wYtYKWWHklstiqywQEh8rWLiA1QYim3NYoU1vlF2Th5Hx7mdvq4hix1UbDRwXRJu0EFHzt0ali6XO_R1qSbZeD8w0xcDjrKrx_bysYSfVK59IoHVts_AQRb6tIR1sCy--d3YbCp_8JbltWp8cYEmleQ_Euwgw9V9X8jyac46"/>
</div>
</div>
</header>
<form className="max-w-[95%] mx-auto space-y-6" onSubmit={handleSubmit}>
{/*  Form Header & WR Number  */}
<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
<div className="md:col-span-8 glass-card rounded-3xl p-8 flex items-center">
<div>
<span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-container/20 text-primary text-xs font-extrabold uppercase tracking-widest mb-4 border border-primary/10">
                            Document Code: FM-IT-006 RV.2
                        </span>
<h2 className="text-3xl font-bold text-on-surface">ใบขอลงทะเบียน / ใช้งาน / เข้าถึงข้อมูล</h2>
</div>
</div>
<div className="md:col-span-4 glass-card rounded-3xl p-8 border-l-4 border-primary">
<div className="space-y-6">
<div className="relative group">
<label className="text-sm font-bold text-primary uppercase tracking-widest block mb-2 opacity-70">Doc No.</label>
<input className="w-full bg-white/40 border-none p-0 text-xl font-bold text-on-surface focus:ring-0 placeholder:text-slate-300" placeholder="FM-IT-007-2026001" type="text" value="FM-IT-007-2026001"/>
</div>
<div className="relative group">
<label className="text-sm font-bold text-primary uppercase tracking-widest block mb-2 opacity-70">Date</label>
<input className="w-full bg-transparent border-none p-0 text-base font-semibold text-on-surface-variant focus:ring-0 cursor-pointer" type="date" defaultValue={today}/>
</div>
</div>
</div>
</div>
{/*  Main Form Body  */}
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
{/*  Left: Request & User Info  */}
<div className="lg:col-span-8 space-y-6">
{/*  Request Type Section  */}
<section className="glass-card rounded-3xl p-8">
<div className="flex items-center gap-3 mb-8">
<div className="bg-primary text-on-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
<span className="material-symbols-outlined text-xl">fact_check</span>
</div>
<h3 className="text-xl font-bold text-on-surface">ประเภทการขอ (Request Type)</h3>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<label className="relative flex items-center p-5 cursor-pointer rounded-2xl bg-white/30 border border-white/50 hover:bg-white/60 transition-all group">
<input className="w-5 h-5 rounded border-outline/30 text-primary focus:ring-primary/20 transition-all cursor-pointer" type="checkbox"/>
<span className="ml-4 text-base font-semibold text-on-surface group-hover:text-primary transition-colors">ขอสมัครใช้งาน Email</span>
</label>
<label className="relative flex items-center p-5 cursor-pointer rounded-2xl bg-white/30 border border-white/50 hover:bg-white/60 transition-all group">
<input className="w-5 h-5 rounded border-outline/30 text-primary focus:ring-primary/20 transition-all cursor-pointer" type="checkbox"/>
<span className="ml-4 text-base font-semibold text-on-surface group-hover:text-primary transition-colors">พื้นที่จัดเก็บข้อมูล ส่วนกลาง</span>
</label>
<label className="relative flex items-center p-5 cursor-pointer rounded-2xl bg-white/30 border border-white/50 hover:bg-white/60 transition-all group">
<input className="w-5 h-5 rounded border-outline/30 text-primary focus:ring-primary/20 transition-all cursor-pointer" type="checkbox"/>
<span className="ml-4 text-base font-semibold text-on-surface group-hover:text-primary transition-colors">CCTV Online</span>
</label>
</div>
</section>
{/*  Requester Details Section  */}
<section className="glass-card rounded-3xl p-8">
<div className="flex items-center gap-3 mb-8">
<div className="bg-primary text-on-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
<span className="material-symbols-outlined text-xl">person_search</span>
</div>
<h3 className="text-xl font-bold text-on-surface">กรอกข้อมูล (Requester Details)</h3>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
<div className="space-y-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">ชื่อ-นามสกุล (Name)</label>
<input className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-2.5 text-base" placeholder="Full Name" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">ตำแหน่ง (Position)</label>
<input className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-2.5 text-base" placeholder="Position" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">ฝ่าย / แผนก (Department)</label>
<input className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-2.5 text-base" placeholder="Department" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">เบอร์โทรศัพท์ (Phone)</label>
<input className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-2.5 text-base" placeholder="Ext. or Mobile" type="tel"/>
</div>
<div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
<div className="space-y-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">Job Type</label>
<select className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-2.5 text-base appearance-none">
<option>Permanent (ประจำ)</option>
<option>Temporary (รายวัน)</option>
<option>Contractor (สัญญาจ้าง)</option>
</select>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">Start Date</label>
<input className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-2.5 text-base" type="date"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">Requested Email</label>
<input className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-2.5 text-base" placeholder="example@domain.com" type="email"/>
</div>
</div>
<div className="md:col-span-2 space-y-2 pt-2">
<label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider ml-1">เหตุผลการขอ (Reason / Details)</label>
<textarea className="w-full bg-white/40 border-white/60 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 py-3 text-base min-h-[100px]" placeholder="Explain the business need for this access request..."></textarea>
</div>
</div>
</section>
</div>
{/*  Right: IT Section & Notes  */}
<div className="lg:col-span-4 space-y-6">
{/*  IT Section  */}
<section className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl text-white relative overflow-hidden group">
<div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
<div className="relative z-10">
<div className="flex items-center gap-3 mb-8">
<div className="bg-primary/30 text-primary-container p-2.5 rounded-xl border border-white/10">
<span className="material-symbols-outlined text-xl">admin_panel_settings</span>
</div>
<h3 className="text-xl font-bold">ส่วนงาน IT (IT ONLY)</h3>
</div>
<div className="space-y-6">
<div className="space-y-2">
<label className="text-sm font-bold text-primary-container uppercase tracking-[0.2em] opacity-80 ml-1">Username assigned</label>
<input className="w-full bg-white/5 border border-white/10 rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all px-4 py-3 text-base font-mono placeholder:text-white/20" placeholder="e.g. j.doe" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-primary-container uppercase tracking-[0.2em] opacity-80 ml-1">Temporary Password</label>
<div className="relative">
<input className="w-full bg-white/5 border border-white/10 rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all px-4 py-3 text-base font-mono pr-12" type="password" value="********"/>
<button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
<span className="material-symbols-outlined text-lg">visibility</span>
</button>
</div>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-primary-container uppercase tracking-[0.2em] opacity-80 ml-1">Action Description</label>
<textarea className="w-full bg-white/5 border border-white/10 rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all px-4 py-3 text-base placeholder:text-white/20" placeholder="Describe implementation steps..." rows={3}></textarea>
</div>
</div>
</div>
</section>
{/*  Important Notes  */}
<section className="glass-card rounded-3xl p-8 border-t-2 border-amber-400/50">
<div className="flex items-center gap-2 mb-6 text-amber-600">
<span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
<h4 className="font-bold text-base tracking-tight">หมายเหตุ (Important Notes)</h4>
</div>
<ul className="space-y-4">
<li className="flex gap-3 items-start">
<span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
<p className="text-sm leading-relaxed text-on-surface-variant font-medium">1. ในกรณีที่สมัคร Email ตามที่ระบุไม่ได้ IT จะดำเนินการแก้ไขให้ตามความเหมาะสม</p>
</li>
<li className="flex gap-3 items-start">
<span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
<p className="text-sm leading-relaxed text-on-surface-variant font-medium">2. การขอเข้าถึงข้อมูลจากภายนอก ต้องรออนุมัติระยะเวลาประมาณ 1-2 วัน</p>
</li>
<li className="flex gap-3 items-start">
<span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
<p className="text-sm leading-relaxed text-on-surface-variant font-medium">3. กรุณาระบุ Username และ Password ที่จะให้สมัครให้ชัดเจน</p>
</li>
</ul>
</section>
</div>
</div>
{/*  Approval Section  */}
<section className="glass-card rounded-[2.5rem] p-10 relative overflow-hidden">
<div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none scale-150 origin-top-right">
<span className="material-symbols-outlined text-9xl">verified_user</span>
</div>
<h3 className="text-2xl font-extrabold text-on-surface mb-12 flex items-center gap-3">
<span className="material-symbols-outlined text-primary">history_edu</span>
                    ส่วนการอนุมัติ (Approval Workflow)
                </h3>
<div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
<div className="text-center group">
<div className="h-24 flex flex-col justify-end items-center mb-6 relative">
{/*  Signature Line Simulation  */}
<div className="w-full max-w-[200px] h-[1px] bg-outline/20"></div>
<div className="absolute bottom-1 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
<span className="text-xs text-primary/40 italic">Digital Signature Verified</span>
</div>
</div>
<div className="space-y-1">
<p className="text-base font-extrabold text-on-surface">ผู้ขอใช้บริการ</p>
<p className="text-base text-on-surface-variant font-bold uppercase tracking-widest">(Requester)</p>
<p className="text-base text-on-surface-variant/60 mt-4">วันที่: ___ / ___ / ___</p>
</div>
</div>
<div className="text-center group">
<div className="h-24 flex flex-col justify-end items-center mb-6">
<div className="w-full max-w-[200px] h-[1px] bg-outline/20"></div>
</div>
<div className="space-y-1">
<p className="text-base font-extrabold text-on-surface">ผู้อนุมัติ (Manager)</p>
<p className="text-base text-on-surface-variant font-bold uppercase tracking-widest">(Approver Signature)</p>
<p className="text-base text-on-surface-variant/60 mt-4">วันที่: ___ / ___ / ___</p>
</div>
</div>
<div className="text-center group">
<div className="h-24 flex flex-col justify-end items-center mb-6">
<div className="w-full max-w-[200px] h-[1px] bg-outline/20"></div>
</div>
<div className="space-y-1">
<p className="text-base font-extrabold text-on-surface">ส่วนงานไอที (IT Dept)</p>
<p className="text-base text-on-surface-variant font-bold uppercase tracking-widest">(IT Authorization)</p>
<p className="text-base text-on-surface-variant/60 mt-4">วันที่: ___ / ___ / ___</p>
</div>
</div>
</div>
</section>
{/*  Actions Footer  */}
<div className="flex justify-end gap-4 py-8">
<button className="px-8 py-3.5 bg-white/60 backdrop-blur-md border border-white/80 text-on-surface-variant font-bold rounded-2xl hover:bg-white transition-all flex items-center gap-2 text-base shadow-sm active:scale-95">
<span className="material-symbols-outlined text-xl">print</span>
                    <span className="text-base">พิมพ์ใบคำขอ (Print Form)</span>
                </button>
<button type="submit" disabled={isSubmitting || isSuccess} className={`px-12 py-3.5 text-on-primary font-bold rounded-2xl hover:opacity-90 shadow-xl transition-all active:scale-95 flex items-center gap-2 text-base disabled:opacity-80 ${isSuccess ? 'bg-green-500 shadow-green-500/30' : 'bg-primary shadow-primary/30'}`}>
<span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{isSuccess ? 'check_circle' : 'send'}</span>
                    <span className="text-base">{isSubmitting ? 'Submitting...' : isSuccess ? 'Success!' : 'ส่งคำขอ (Submit Request)'}</span>
                </button>
</div>
</form>

    </>
  );
};

export default UserRegistration;
