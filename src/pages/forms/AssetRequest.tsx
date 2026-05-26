import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const AssetRequest = () => {
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
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'assetRequests'), {
        ...data,
        reporter: { name: reporterName, email: reporterEmail },
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

<div className="max-w-[95%] mx-auto p-8 md:p-12 space-y-8">
{/*  Page Header  */}
<div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
<div>
<span className="text-sm font-label text-primary font-semibold tracking-wider uppercase">Procurement Workflow</span>
<h1 className="text-4xl font-extrabold tracking-tighter text-on-surface mt-1">Asset Request &amp; Transfer</h1>
<p className="text-on-surface-variant font-label mt-2">ใบขอเบิก/เปลี่ยนผู้ใช้งาน - IT Operations Management Suite</p>
</div>
<div className="flex bg-white/40 backdrop-blur-md rounded-xl p-1.5 self-start md:self-auto border border-white/50">
<button className="px-6 py-2 bg-white text-primary font-bold rounded-lg shadow-sm border border-white/80">Request New</button>
<button className="px-6 py-2 text-on-surface-variant font-medium hover:text-on-surface transition-colors">Transfer User</button>
</div>
</div>
{/*  Form Content  */}
<form className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start" onSubmit={handleSubmit}>
{/*  Left Column: Applicant & Equipment  */}
<div className="md:col-span-8 space-y-8">
{/*  Applicant Info Card  */}
<section className="glass-card p-8 rounded-2xl shadow-xl shadow-blue-900/5 space-y-6">
<div className="flex items-center gap-3 pb-2 border-b border-white/50">
<span className="material-symbols-outlined text-primary">person</span>
<h2 className="text-xl font-bold tracking-tight">Applicant Information</h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Full Name</label>
<input className="w-full bg-white/50 border-white/50 rounded-lg focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" placeholder="John Doe" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Department</label>
<select className="w-full bg-white/50 border-white/50 rounded-lg focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base">
<option>Marketing</option>
<option>Engineering</option>
<option>Human Resources</option>
<option>Finance</option>
</select>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Position</label>
<input className="w-full bg-white/50 border-white/50 rounded-lg focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" placeholder="Senior Designer" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Phone / Ext.</label>
<input className="w-full bg-white/50 border-white/50 rounded-lg focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" placeholder="+1 (555) 000-0000" type="text"/>
</div>
<div className="space-y-2 md:col-span-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Request Date</label>
<input className="w-full bg-white/50 border-white/50 rounded-lg focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" type="date" defaultValue={today}/>
</div>
</div>
</section>
{/*  Equipment Details  */}
<section className="glass-card p-8 rounded-2xl shadow-xl shadow-blue-900/5 space-y-6">
<div className="flex items-center gap-3 pb-2 border-b border-white/50">
<span className="material-symbols-outlined text-primary">devices</span>
<h2 className="text-xl font-bold tracking-tight">Equipment Details</h2>
</div>
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
<label className="group flex items-center p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container cursor-pointer transition-all">
<input className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary" type="checkbox"/>
<span className="ml-3 font-semibold text-base text-slate-700 group-hover:text-primary transition-colors">Laptop / PC</span>
</label>
<label className="group flex items-center p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container cursor-pointer transition-all">
<input className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary" type="checkbox"/>
<span className="ml-3 font-semibold text-base text-slate-700 group-hover:text-primary transition-colors">Printer</span>
</label>
<label className="group flex items-center p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container cursor-pointer transition-all">
<input className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary" type="checkbox"/>
<span className="ml-3 font-semibold text-base text-slate-700 group-hover:text-primary transition-colors">CCTV</span>
</label>
<label className="group flex items-center p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container cursor-pointer transition-all">
<input className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary" type="checkbox"/>
<span className="ml-3 font-semibold text-base text-slate-700 group-hover:text-primary transition-colors">Radio</span>
</label>
<label className="group flex items-center p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container cursor-pointer transition-all">
<input className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary" type="checkbox"/>
<span className="ml-3 font-semibold text-base text-slate-700 group-hover:text-primary transition-colors">Monitor</span>
</label>
<label className="group flex items-center p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container cursor-pointer transition-all">
<input className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary" type="checkbox"/>
<span className="ml-3 font-semibold text-base text-slate-700 group-hover:text-primary transition-colors">Other</span>
</label>
</div>
</section>
{/*  Transfer Details (Contextual Section)  */}
<section className="glass-card p-8 rounded-2xl border-white/20 bg-primary/5 space-y-6">
<div className="flex items-center gap-3 pb-2 border-b border-primary/10">
<span className="material-symbols-outlined text-secondary">swap_horiz</span>
<h2 className="text-xl font-bold tracking-tight">Transfer &amp; Change Details</h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Asset ID</label>
<input className="w-full bg-white/80 border-white/50 rounded-lg focus:ring-2 focus:ring-primary shadow-sm text-base" placeholder="AST-2024-001" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Model</label>
<input className="w-full bg-white/80 border-white/50 rounded-lg focus:ring-2 focus:ring-primary shadow-sm text-base" placeholder="Dell Latitude 5420" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Serial Number (S/N)</label>
<input className="w-full bg-white/80 border-white/50 rounded-lg focus:ring-2 focus:ring-primary shadow-sm text-base" placeholder="SN-123456789" type="text"/>
</div>
<div className="md:col-span-2 space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Previous User Name</label>
<input className="w-full bg-white/80 border-white/50 rounded-lg focus:ring-2 focus:ring-primary shadow-sm text-base" placeholder="Jane Smith" type="text"/>
</div>
<div className="space-y-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Reason for change</label>
<select className="w-full bg-white/80 border-white/50 rounded-lg focus:ring-2 focus:ring-primary shadow-sm text-base">
<option>Damaged / Repair</option>
<option>Upgrade Needed</option>
<option>Staff Transfer</option>
<option>Resignation</option>
</select>
</div>
</div>
</section>
</div>
{/*  Right Column: Approval & Submit  */}
<div className="md:col-span-4 space-y-8 sticky top-24">
{/*  Approval Flow Card  */}
<section className="glass-card p-6 rounded-2xl shadow-xl shadow-blue-900/5">
<h3 className="text-xl font-bold mb-6 flex items-center gap-2">
<span className="material-symbols-outlined text-primary">account_tree</span>
                        Approval Workflow
                    </h3>
<div className="space-y-8">
<div className="flex items-start gap-4">
<div className="flex flex-col items-center">
<div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-base font-bold shadow-md shadow-primary/20">1</div>
<div className="w-0.5 h-12 bg-primary/10 my-1"></div>
</div>
<div className="pt-1">
<p className="text-base font-bold">Department Head</p>
<p className="text-xs text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded mt-1">Pending Review</p>
</div>
</div>
<div className="flex items-start gap-4">
<div className="flex flex-col items-center">
<div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-base font-bold">2</div>
<div className="w-0.5 h-12 bg-slate-100 my-1"></div>
</div>
<div className="pt-1">
<p className="text-base font-bold text-slate-400">IT Manager</p>
<p className="text-base text-slate-400">Waiting for Step 1</p>
</div>
</div>
<div className="flex items-start gap-4">
<div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center text-base font-bold">3</div>
<div className="pt-1">
<p className="text-base font-bold text-slate-400">Inventory Release</p>
<p className="text-base text-slate-400">Final Stage</p>
</div>
</div>
</div>
</section>
{/*  Summary Widget  */}
<div className="bg-gradient-to-br from-primary to-blue-700 p-6 rounded-2xl shadow-lg shadow-primary/20 text-white">
<div className="flex justify-between items-center mb-4">
<h4 className="text-sm font-bold uppercase tracking-widest opacity-80">System Metadata</h4>
<span className="px-2 py-1 bg-white/20 backdrop-blur-md text-xs font-bold rounded uppercase tracking-widest">Live</span>
</div>
<ul className="space-y-3">
<li className="flex justify-between text-sm">
<span className="opacity-70">Reference ID</span>
<span className="font-mono font-bold">REQ-9902-X</span>
</li>
<li className="flex justify-between text-sm">
<span className="opacity-70">Priority</span>
<span className="text-amber-300 font-bold">Medium</span>
</li>
<li className="flex justify-between text-sm">
<span className="opacity-70">Est. Processing</span>
<span className="font-bold">2-3 Business Days</span>
</li>
</ul>
</div>
{/*  Actions  */}
<div className="space-y-3">
<button disabled={isSubmitting || isSuccess} className={`w-full text-white font-bold py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-80 ${isSuccess ? 'bg-green-500 shadow-green-500/25' : 'bg-primary shadow-primary/25 hover:bg-primary-dim hover:scale-[1.02] active:scale-95'}`} type="submit">
                        {isSubmitting ? 'Submitting...' : isSuccess ? 'Success!' : 'Submit Request'}
                        <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">{isSuccess ? 'check_circle' : 'send'}</span>
</button>
<button className="w-full bg-white/60 hover:bg-white text-primary font-bold py-3 rounded-xl border border-white transition-all shadow-sm" type="button">
                        Save Draft
                    </button>
<button className="w-full text-error font-semibold py-3 rounded-xl hover:bg-red-50 transition-all text-base uppercase tracking-widest" type="button">
                        Cancel &amp; Reset
                    </button>
</div>
</div>
</form>
{/*  Bottom Illustration/Section (Decorative)  */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center glass-card p-12 rounded-[2rem] overflow-hidden relative shadow-2xl shadow-blue-900/5">
<div className="z-10 space-y-6">
<h2 className="text-3xl font-extrabold tracking-tight">Need assistance?</h2>
<p className="text-slate-600 leading-relaxed font-medium">Our IT Support team is available 24/7 to help you with equipment selection or technical specifications. Contact us via the Management Suite Chat.</p>
<button className="bg-slate-800 text-white px-8 py-3 rounded-full font-bold text-sm tracking-wide shadow-lg hover:bg-slate-900 hover:-translate-y-0.5 transition-all">Open Support Ticket</button>
</div>
<div className="absolute right-0 top-0 h-full w-1/2 hidden md:block">
<img alt="modern office" className="h-full w-full object-cover opacity-10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdmDY320ecgd3Ba0XmbiQ-_fzkEceDsqSSLlov2R801CZBTJepAO4say3J3zbHs_f6VX8qRW6qtQglYA0bE4fIU_rasRlq7mal63dLoGB2fPcS6ejit5idpanMo8lL9D9JqLf11vZDPEqJeoVE9CXGzw0_kO_Y0nXgh0e_fC8hnXolKzX55EjRQwJKwE36_C3o7mSJcZ95hoORo_SGHfDlvBkRLujE2QyL0icCp-pA7uY2FQjx1RCkBZjhF83OosSqqlogD7KZeVPz"/>
<div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/40 to-white/90"></div>
</div>
</div>
</div>

    </>
  );
};

export default AssetRequest;
