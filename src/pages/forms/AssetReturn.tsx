import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const AssetReturn = () => {
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
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'assetReturns'), {
        ...data,
        reporter: { name: reporterName, email: reporterEmail },
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Save to Logs
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'logs'), {
        name: reporterName,
        email: reporterEmail,
        action: 'Asset Returned',
        module: 'Asset Return Form (FM-IT-004)',
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

<div className="max-w-[95%] mx-auto p-6 md:p-12 relative z-10">
{/*  Breadcrumb & Header  */}
<header className="mb-12">
<div className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider mb-4 cursor-pointer hover:opacity-80 transition-opacity">
<span className="material-symbols-outlined text-[1rem]" data-icon="arrow_back">arrow_back</span>
<span>Back to Asset Registry</span>
</div>
<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
<div>
<h1 className="text-4xl font-extrabold tracking-tighter text-on-surface mb-2">Asset Return</h1>
<p className="text-secondary font-medium text-lg">(ใบคืนอุปกรณ์/ยกเลิกใช้งาน)</p>
</div>
<div className="flex items-center gap-3">
<div className="px-4 py-2 rounded-xl bg-blue-100/50 backdrop-blur-md text-blue-700 text-xs font-bold uppercase tracking-widest border border-blue-200">
                            Draft Status
                        </div>
<div className="text-on-surface-variant text-base bg-white/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/50">
                            Doc No.: <span className="font-mono font-bold">FM-IT-003-2026001</span>
</div>
</div>
</div>
</header>
{/*  Main Form Layout: Bento Style  */}
<form className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-24" onSubmit={handleSubmit}>
{/*  Section 1: Applicant Info (Large Span)  */}
<section className="md:col-span-8 glass-panel p-8 rounded-[2rem] shadow-xl shadow-blue-900/5">
<div className="flex items-center gap-3 mb-8 text-primary border-b border-white/50 pb-4">
<span className="material-symbols-outlined" data-icon="person">person</span>
<h2 className="text-2xl font-bold tracking-tight">Applicant Information</h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
<div className="flex flex-col gap-1.5">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Full Name</label>
<input className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium" readOnly={true} type="text" value="Thanawat Srisuwan"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Department</label>
<input className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium" readOnly={true} type="text" value="Commercial Operations"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Position</label>
<input className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium" readOnly={true} type="text" value="Senior Sales Lead"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Contact Phone</label>
<input className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium" type="text" value="+66 82 456 7890"/>
</div>
<div className="flex flex-col gap-1.5 md:col-span-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Expected Date of Return</label>
<input className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium" type="date" defaultValue={today}/>
</div>
</div>
</section>
{/*  Section 2: Quick Status Sidebar  */}
<section className="md:col-span-4 glass-panel p-8 rounded-[2rem] flex flex-col justify-center items-center text-center border-2 border-dashed border-primary/20 bg-primary/5">
<div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
<span className="material-symbols-outlined text-4xl text-primary" data-icon="cloud_upload">cloud_upload</span>
</div>
<h3 className="font-bold text-xl font-bold mb-2 text-on-surface">Documentation</h3>
<p className="text-lg text-on-surface-variant mb-6 leading-relaxed">Please ensure all local files are backed up to the corporate cloud before physical handover.</p>
<button className="w-full bg-white/80 text-primary font-bold py-3.5 rounded-xl border border-white shadow-sm hover:bg-primary hover:text-white transition-all active:scale-95" type="button">
                        Upload Asset Photos
                    </button>
</section>
{/*  Section 3: Asset Details  */}
<section className="md:col-span-12 glass-panel p-8 rounded-[2rem] shadow-xl shadow-blue-900/5">
<div className="flex items-center gap-3 mb-8 text-primary border-b border-white/50 pb-4">
<span className="material-symbols-outlined" data-icon="laptop_mac">laptop_mac</span>
<h2 className="text-2xl font-bold tracking-tight">Asset Identification</h2>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
<div className="flex flex-col gap-1.5">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Asset Category</label>
<select className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium">
<option>Laptop / Notebook</option>
<option>Printer / Scanner</option>
<option>Mobile Device</option>
<option>Peripheral (Mouse, Keyboard)</option>
<option>Monitor</option>
</select>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Asset ID (Tag Number)</label>
<input className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium" placeholder="e.g. IT-LPT-2023-001" type="text"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Brand/Model</label>
<input className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface font-medium" readOnly={true} type="text" value="MacBook Pro 14' (M2)"/>
</div>
</div>
</section>
{/*  Section 4: Condition Checklist  */}
<section className="md:col-span-7 glass-panel p-8 rounded-[2rem] shadow-xl shadow-blue-900/5">
<div className="flex items-center gap-3 mb-8 text-primary border-b border-white/50 pb-4">
<span className="material-symbols-outlined" data-icon="fact_check">fact_check</span>
<h2 className="text-2xl font-bold tracking-tight">Equipment Status Checklist</h2>
</div>
<div className="space-y-4">
<label className="group flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-white/50 cursor-pointer hover:bg-white hover:border-primary-container transition-all">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary transition-all" type="checkbox"/>
<div className="flex flex-col">
<span className="font-bold text-on-surface group-hover:text-primary transition-colors">Physical Damage</span>
<span className="text-base text-on-surface-variant font-medium">Are there any cracks, dents, or significant scratches?</span>
</div>
</label>
<label className="group flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-white/50 cursor-pointer hover:bg-white hover:border-primary-container transition-all">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary transition-all" type="checkbox"/>
<div className="flex flex-col">
<span className="font-bold text-on-surface group-hover:text-primary transition-colors">Functional Condition</span>
<span className="text-base text-on-surface-variant font-medium">The device powers on and operates normally.</span>
</div>
</label>
<label className="group flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-white/50 cursor-pointer hover:bg-white hover:border-primary-container transition-all">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary transition-all" type="checkbox"/>
<div className="flex flex-col">
<span className="font-bold text-on-surface group-hover:text-primary transition-colors">Accessories Included</span>
<span className="text-base text-on-surface-variant font-medium">Power adapter, cables, and carry-case are present.</span>
</div>
</label>
<label className="group flex items-center gap-4 p-4 rounded-2xl bg-white/40 border border-white/50 cursor-pointer hover:bg-white hover:border-primary-container transition-all">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary transition-all" type="checkbox"/>
<div className="flex flex-col">
<span className="font-bold text-on-surface group-hover:text-primary transition-colors">Clean &amp; Sanitized</span>
<span className="text-base text-on-surface-variant font-medium">Device has been surface-cleaned prior to return.</span>
</div>
</label>
</div>
</section>
{/*  Section 5: Reason & Notes  */}
<section className="md:col-span-5 glass-panel p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 flex flex-col">
<div className="flex items-center gap-3 mb-8 text-primary border-b border-white/50 pb-4">
<span className="material-symbols-outlined" data-icon="description">description</span>
<h2 className="text-2xl font-bold tracking-tight">Reason for Return</h2>
</div>
<div className="flex-grow flex flex-col gap-4">
<div className="flex items-center gap-3 p-3 bg-white/30 rounded-xl hover:bg-white/50 transition-colors cursor-pointer border border-transparent hover:border-white/20">
<input className="text-primary focus:ring-primary" id="r1" name="reason" type="radio"/>
<label className="font-bold text-base text-slate-700 cursor-pointer" htmlFor="r1">Resignation / Termination</label>
</div>
<div className="flex items-center gap-3 p-3 bg-white/30 rounded-xl hover:bg-white/50 transition-colors cursor-pointer border border-transparent hover:border-white/20">
<input className="text-primary focus:ring-primary" id="r2" name="reason" type="radio"/>
<label className="font-bold text-base text-slate-700 cursor-pointer" htmlFor="r2">Upgrade to New Device</label>
</div>
<div className="flex items-center gap-3 p-3 bg-white/30 rounded-xl hover:bg-white/50 transition-colors cursor-pointer border border-transparent hover:border-white/20">
<input className="text-primary focus:ring-primary" id="r3" name="reason" type="radio"/>
<label className="font-bold text-base text-slate-700 cursor-pointer" htmlFor="r3">Repair / Technical Issue</label>
</div>
<div className="mt-4 flex flex-col gap-2">
<label className="text-sm font-bold text-slate-500 px-1 uppercase tracking-wider">Additional Comments</label>
<textarea className="w-full bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all p-3 text-on-surface text-base placeholder:text-slate-400" placeholder="Describe any known issues or specifics regarding the return..." rows={4}></textarea>
</div>
</div>
</section>
{/*  Section 6: Workflow Visualization  */}
<section className="md:col-span-12 glass-panel p-8 rounded-[2rem] border border-white/40">
<h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">Approval Workflow</h3>
<div className="flex flex-col md:flex-row justify-between items-center gap-6 relative px-4">
{/*  Connector Line  */}
<div className="hidden md:block absolute top-[28px] left-[15%] w-[70%] h-[2px] bg-primary/10 -z-10"></div>
{/*  Step 1  */}
<div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border-2 border-primary/20 w-full md:w-auto flex flex-col items-center gap-2 group transition-all hover:-translate-y-1">
<div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-md shadow-primary/20">1</div>
<div className="text-center">
<p className="text-base font-extrabold text-on-surface">Submit Form</p>
<p className="text-xs font-bold text-primary/70 uppercase tracking-tighter">Applicant</p>
</div>
</div>
{/*  Step 2  */}
<div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-white/50 w-full md:w-auto flex flex-col items-center gap-2 group transition-all hover:-translate-y-1">
<div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center font-bold">2</div>
<div className="text-center">
<p className="text-base font-bold text-slate-400">Manager Review</p>
<p className="text-base font-medium text-slate-400">Dept. Head</p>
</div>
</div>
{/*  Step 3  */}
<div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-white/50 w-full md:w-auto flex flex-col items-center gap-2 group transition-all hover:-translate-y-1">
<div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center font-bold">3</div>
<div className="text-center">
<p className="text-base font-bold text-slate-400">Physical Inspection</p>
<p className="text-base font-medium text-slate-400">IT Inventory</p>
</div>
</div>
{/*  Step 4  */}
<div className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-white/50 w-full md:w-auto flex flex-col items-center gap-2 group transition-all hover:-translate-y-1">
<div className="w-8 h-8 rounded-full bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center font-bold">4</div>
<div className="text-center">
<p className="text-base font-bold text-slate-400">System Clearance</p>
<p className="text-base font-medium text-slate-400">Final Closure</p>
</div>
</div>
</div>
</section>
{/*  Submission Actions  */}
<div className="md:col-span-12 flex flex-col md:flex-row justify-end gap-4 mt-8">
<button className="px-8 py-4 text-primary font-bold hover:bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 transition-all active:scale-95 text-base" type="button">
                        Save as Draft
                    </button>
<button disabled={isSubmitting || isSuccess} className={`px-12 py-4 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-80 ${isSuccess ? 'bg-green-500 shadow-green-500/20' : 'bg-primary shadow-primary/20 hover:bg-primary-dim hover:scale-[1.02] active:scale-95'}`} type="submit">
                        {isSubmitting ? 'Submitting...' : isSuccess ? 'Success!' : 'Submit Return Request'}
                        <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">{isSuccess ? 'check_circle' : 'send'}</span>
</button>
</div>
</form>
</div>

    </>
  );
};

export default AssetReturn;
