import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const Appointment = () => {
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

<div className="max-w-[95%] mx-auto p-8 md:p-12">
{/*  Hero Header  */}
<header className="mb-10">
<div className="flex items-center gap-2 text-primary font-bold mb-2">
<span className="material-symbols-outlined">calendar_today</span>
<span className="uppercase tracking-widest text-xs font-bold">New Appointment Request</span>
</div>
<h1 className="text-4xl font-extrabold tracking-tighter text-on-surface mb-2">
                    IT Appointment <span className="text-primary/60">(ใบนัดหมายเข้าหน้างาน)</span>
</h1>
<p className="text-on-surface-variant max-w-2xl font-medium text-lg">
                    Register a formal request for on-site technical support. Please provide detailed information to ensure efficient service delivery.
                </p>
</header>
{/*  Appointment Form  */}
<form className="space-y-8" onSubmit={handleSubmit}>
{/*  Section: Applicant Details  */}
<section className="glass-card rounded-2xl p-8 shadow-xl shadow-blue-900/5">
<h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
<span className="material-symbols-outlined">person</span>
                        Applicant Information
                    </h2>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="flex flex-col gap-1.5">
<label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Applicant Name</label>
<input className="bg-white/50 border-white/50 rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" placeholder="Full name" type="text"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Department</label>
<select className="bg-white/50 border-white/50 rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base">
<option>Human Resources</option>
<option>Finance &amp; Accounting</option>
<option>Marketing</option>
<option>Operations</option>
<option>Executive</option>
</select>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Job Title</label>
<input className="bg-white/50 border-white/50 rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" placeholder="e.g. Senior Manager" type="text"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Phone Number</label>
<input className="bg-white/50 border-white/50 rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" placeholder="000-000-0000" type="tel"/>
</div>
</div>
</section>
{/*  Section: Logistics  */}
<section className="grid grid-cols-1 md:grid-cols-2 gap-8">
<div className="glass-card rounded-2xl p-8 shadow-xl shadow-blue-900/5">
<h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
<span className="material-symbols-outlined">schedule</span>
                            Schedule &amp; Location
                        </h2>
<div className="space-y-6">
<div className="flex flex-col gap-1.5">
<label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Preferred Date</label>
<input className="bg-white/50 border-white/50 rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" type="date" defaultValue={today}/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Time Slot</label>
<input className="bg-white/50 border-white/50 rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" type="time"/>
</div>
<div className="flex flex-col gap-1.5">
<label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Work Location</label>
<input className="bg-white/50 border-white/50 rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base" placeholder="Office floor / Server Room / Branch" type="text"/>
</div>
</div>
</div>
<div className="glass-card rounded-2xl p-8 shadow-xl shadow-blue-900/5 flex flex-col">
<h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
<span className="material-symbols-outlined">checklist</span>
                            Equipment Checklist
                        </h2>
<div className="space-y-3 flex-grow">
<label className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors cursor-pointer group border border-transparent hover:border-white/50">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary bg-white/50" type="checkbox"/>
<span className="text-slate-700 font-semibold text-base group-hover:text-primary transition-colors">Prepared tools for installation</span>
</label>
<label className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors cursor-pointer group border border-transparent hover:border-white/50">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary bg-white/50" type="checkbox"/>
<span className="text-slate-700 font-semibold text-base group-hover:text-primary transition-colors">Need to assess equipment first</span>
</label>
<label className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors cursor-pointer group border border-transparent hover:border-white/50">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary bg-white/50" type="checkbox"/>
<span className="text-slate-700 font-semibold text-base group-hover:text-primary transition-colors">Prepared spare parts</span>
</label>
<label className="flex items-center gap-3 p-3 rounded-xl hover:bg-white transition-colors cursor-pointer group border border-transparent hover:border-white/50">
<input className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary bg-white/50" type="checkbox"/>
<span className="text-slate-700 font-semibold text-base group-hover:text-primary transition-colors">Special safety clearance granted</span>
</label>
</div>
</div>
</section>
{/*  Section: Job Details  */}
<section className="glass-card rounded-2xl p-8 shadow-xl shadow-blue-900/5">
<h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
<span className="material-symbols-outlined">description</span>
                        Job Details &amp; Description
                    </h2>
<div className="flex flex-col gap-1.5">
<textarea className="bg-white/50 border-white/50 rounded-2xl p-5 text-on-surface focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base min-h-[150px]" placeholder="Describe the problem or the task in detail..." rows={5}></textarea>
<p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider mt-3 flex items-center gap-1 opacity-70">
<span className="material-symbols-outlined text-[14px]">info</span>
                            Include model numbers or error codes if applicable.
                        </p>
</div>
</section>
{/*  Section: Photo Upload  */}
<section className="glass-card rounded-2xl p-8 shadow-xl shadow-blue-900/5">
<h2 className="text-2xl font-bold mb-6 text-primary flex items-center gap-2">
<span className="material-symbols-outlined">add_a_photo</span>
                        Site &amp; Equipment Photos
                    </h2>
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
<div className="aspect-square bg-white/40 rounded-2xl border-2 border-dashed border-white/50 flex flex-col items-center justify-center text-slate-500 hover:border-primary hover:text-primary hover:bg-white transition-all cursor-pointer">
<span className="material-symbols-outlined text-3xl mb-1">add_a_photo</span>
<span className="text-xs font-bold uppercase tracking-widest">Upload Photo</span>
</div>
<div className="aspect-square rounded-2xl overflow-hidden group relative shadow-sm">
<img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="high-tech server room with glowing blue led lights and neatly organized cable management" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA65bkUL5tj4UFHSUMXibvxnEeqfL_ROB_jhaFrJaGS05o1T7d-10MUYD62dyT6uqsGSNAWQyB2LPZfleNRVvwpTZ6OHG8k-1er_syTlGj-mDUYmEidF2dKv5jr_0IUtZtpq_cPOI_8A9u-AUb4VghIDA4NblktQPR0Q8-BqRmTunjl9z2Lt_HNanBXH5bfrQ_fQUb70-PHAg4KXi8r1gL-uGc3E7o1lj5Z67AeruP9K_WJ3M5R1yM-dg2qVIuXaFz5XX-jlPFSM9N9"/>
<div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
<span className="material-symbols-outlined text-white cursor-pointer hover:scale-110 transition-transform">delete</span>
</div>
</div>
<div className="aspect-square rounded-2xl overflow-hidden group relative shadow-sm">
<img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" data-alt="close-up of industrial network switches and fiber optic cables in a data center environment" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCAp3rbiuL9dRYpnJ-kFYpr19U1s1gUfMGY_MLWDWz0uWbR4SeIvJYB1KpzR9VgKeW2MWfw7S9LVWGuR4fRf8QPhygqrLs61Dcd9Ree-EPwbb0s2_i6SHEFEqEMO_IKQdl2P_j3468defrREJ0kklodltSii-iBb921WieeVOAd6MAMs_63WwksxtIEu3CWrqf38hnb_ZYPov8CTNtKa9AQ-jkQqg1e0my5K9oEgaKZ0kgxhfeMUiCCFxAJaqtXKaEakTekvH8m3LfI"/>
<div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
<span className="material-symbols-outlined text-white cursor-pointer hover:scale-110 transition-transform">delete</span>
</div>
</div>
</div>
</section>
{/*  Section: Workflow / Signatures  */}
<section className="grid grid-cols-1 md:grid-cols-2 gap-8">
<div className="glass-card rounded-2xl p-8 shadow-xl shadow-blue-900/5">
<h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Applicant Acknowledgment</h3>
<div className="h-32 bg-white/40 rounded-xl border border-white/50 flex items-center justify-center mb-4">
<span className="text-slate-400 text-sm italic font-medium">Digital Signature Area</span>
</div>
<div className="text-center pt-2">
<div className="h-[1px] bg-slate-200/50 w-full mb-3"></div>
<span className="text-base font-bold text-on-surface">Applicant Signature</span>
</div>
</div>
<div className="glass-card rounded-2xl p-8 shadow-xl shadow-blue-900/5">
<h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Department Approver</h3>
<div className="h-32 bg-white/40 rounded-xl border border-white/50 flex items-center justify-center mb-4">
<span className="material-symbols-outlined text-slate-300 text-5xl">draw</span>
</div>
<div className="text-center pt-2">
<div className="h-[1px] bg-slate-200/50 w-full mb-3"></div>
<span className="text-base font-bold text-on-surface">Authorized Signatory</span>
</div>
</div>
</section>
{/*  Final Actions  */}
<footer className="flex items-center justify-end gap-6 pt-10 border-t border-white/30">
<button className="px-8 py-3 text-slate-500 font-bold text-sm uppercase tracking-widest hover:text-error transition-all" type="button">
                        Cancel Request
                    </button>
<button disabled={isSubmitting || isSuccess} className={`px-10 py-4 text-white font-bold rounded-2xl shadow-xl transition-all flex items-center gap-3 disabled:opacity-80 ${isSuccess ? 'bg-green-500 shadow-green-500/20' : 'bg-primary shadow-primary/20 hover:scale-[1.02] active:scale-95'}`} type="submit">
<span className="text-base">{isSubmitting ? 'Submitting...' : isSuccess ? 'Success!' : 'Submit Appointment'}</span>
<span className="material-symbols-outlined text-lg">{isSuccess ? 'check_circle' : 'send'}</span>
</button>
</footer>
</form>
</div>

    </>
  );
};

export default Appointment;
