import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const LicenseRequest = () => {
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
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'licenseRequests'), {
        ...data,
        reporter: { name: reporterName, email: reporterEmail },
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // Save to Logs
      await addDoc(collection(db, 'CMG-IT-MANAGEMENT', 'root', 'logs'), {
        name: reporterName,
        email: reporterEmail,
        action: 'License Requested',
        module: 'License Request Form (FM-IT-005)',
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
        <div className="mb-10">
          <span className="text-sm font-label text-primary font-semibold tracking-wider uppercase">License Management</span>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mt-1">License Request</h1>
          <p className="text-on-surface-variant font-medium">(ใบขอเปิดสิทธิ์/ต่ออายุ License)</p>
        </div>
        {/* Bento Grid Layout for Form Sections */}
        <form className="grid grid-cols-1 md:grid-cols-12 gap-8" onSubmit={handleSubmit}>
          {/* Section 1: Request Type & Program */}
          <div className="md:col-span-8 glass-card p-8 rounded-2xl shadow-xl shadow-blue-900/5">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 pb-2 border-b border-white/50">
              <span className="material-symbols-outlined text-primary">assignment_add</span>
              General Request Info
            </h2>
            <div className="space-y-10">
              {/* Request Type */}
              <div className="flex flex-wrap gap-8 items-center">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Type of request:</span>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input checked={true} className="w-5 h-5 text-primary border-white focus:ring-primary rounded-full" name="request_type" type="radio"/>
                  <span className="text-base font-semibold group-hover:text-primary transition-colors">New License</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input className="w-5 h-5 text-primary border-white focus:ring-primary rounded-full" name="request_type" type="radio"/>
                  <span className="text-base font-semibold group-hover:text-primary transition-colors">Renewal</span>
                </label>
              </div>
              {/* Program Selection Grid */}
              <div>
                <span className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-1">Program Selection:</span>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container transition-all cursor-pointer flex items-center gap-3 group">
                    <input className="rounded text-primary focus:ring-primary border-slate-300" type="checkbox"/>
                    <span className="text-base font-semibold text-slate-700 group-hover:text-primary">MS Office 365+</span>
                  </div>
                  <div className="p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container transition-all cursor-pointer flex items-center gap-3 group">
                    <input className="rounded text-primary focus:ring-primary border-slate-300" type="checkbox"/>
                    <span className="text-base font-semibold text-slate-700 group-hover:text-primary">Sketchup 3D</span>
                  </div>
                  <div className="p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container transition-all cursor-pointer flex items-center gap-3 group">
                    <input className="rounded text-primary focus:ring-primary border-slate-300" type="checkbox"/>
                    <span className="text-base font-semibold text-slate-700 group-hover:text-primary">Autodesk</span>
                  </div>
                  <div className="p-4 bg-white/40 hover:bg-white rounded-xl border border-white/50 hover:border-primary-container transition-all cursor-pointer flex items-center gap-3 group">
                    <input className="rounded text-primary focus:ring-primary border-slate-300" type="checkbox"/>
                    <span className="text-base font-semibold text-slate-700 group-hover:text-primary">Adobe Creative</span>
                  </div>
                  <div className="col-span-2 p-4 bg-white/40 rounded-xl border border-white/50 flex items-center gap-3 focus-within:bg-white transition-all">
                    <span className="text-base font-semibold text-slate-500 whitespace-nowrap">Other:</span>
                    <input className="w-full bg-transparent border-none focus:ring-0 text-base p-0 placeholder:text-slate-400" placeholder="Specify program..." type="text"/>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Section 2: Quick Status Hero Card */}
          <div className="md:col-span-4 bg-gradient-to-br from-primary to-blue-700 p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-xl shadow-blue-900/20 text-white">
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">Doc No.</p>
                  <h3 className="text-2xl font-extrabold tracking-tight">FM-IT-004-2026001</h3>
                </div>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-sm font-bold rounded-full uppercase tracking-widest">Draft</span>
              </div>
            </div>
            <div className="relative z-10 mt-12">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-sm">info</span>
                <span className="text-sm font-bold uppercase tracking-widest opacity-80">IT Procurement Note</span>
              </div>
              <p className="text-base opacity-90 leading-relaxed font-medium">Ensure all fields are accurate for faster processing by the centralized team.</p>
            </div>
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          </div>
          {/* Section 3: Requester Information */}
          <div className="md:col-span-12 glass-card p-8 rounded-2xl shadow-xl shadow-blue-900/5">
            <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 pb-2 border-b border-white/50">
              <span className="material-symbols-outlined text-primary">person</span>
              Requester Info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Full Name</label>
                <input className="w-full h-12 bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base px-4" type="text" value="Janez Doe"/>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Position</label>
                <input className="w-full h-12 bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base px-4" type="text" value="Senior Architect"/>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Department</label>
                <input className="w-full h-12 bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base px-4" type="text" value="Design &amp; Innovation"/>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Phone</label>
                <input className="w-full h-12 bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base px-4" placeholder="+66 81-XXX-XXXX" type="tel"/>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Reason for Request</label>
                <input className="w-full h-12 bg-white/50 border-white/50 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-base px-4" placeholder="Project rendering requirements..." type="text"/>
              </div>
            </div>
          </div>
          {/* Section 4: IT Section */}
          <div className="md:col-span-7 glass-card p-8 rounded-2xl border-primary/10 bg-primary/5 shadow-xl shadow-blue-900/5">
            <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 pb-2 border-b border-primary/10 text-primary">
              <span className="material-symbols-outlined">admin_panel_settings</span>
              IT Section (Registration)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Registration Details</label>
                <input className="w-full h-12 bg-white/80 border-white/50 rounded-xl focus:ring-2 focus:ring-primary text-base px-4 shadow-sm" placeholder="ID Code / Asset Tag" type="text"/>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Packet License Details</label>
                <select className="w-full h-12 bg-white/80 border-white/50 rounded-xl focus:ring-2 focus:ring-primary text-base px-4 shadow-sm appearance-none">
                  <option>Standard Annual (Single)</option>
                  <option>Premium Enterprise (Group)</option>
                  <option>Trial / Educational</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Start Date</label>
                <input className="w-full h-12 bg-white/80 border-white/50 rounded-xl focus:ring-2 focus:ring-primary text-base px-4 shadow-sm" type="date" value={today}/>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">End Date</label>
                <input className="w-full h-12 bg-white/80 border-white/50 rounded-xl focus:ring-2 focus:ring-primary text-base px-4 shadow-sm" type="date"/>
              </div>
            </div>
          </div>
          {/* Section 5: Approval Workflow */}
          <div className="md:col-span-5 glass-card p-8 rounded-2xl shadow-xl shadow-blue-900/5">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">account_tree</span>
              Approval Workflow
            </h2>
            <div className="space-y-10">
              {/* Step 1 */}
              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  </div>
                  <div className="w-0.5 h-10 bg-green-100/50 my-1"></div>
                </div>
                <div className="pt-1">
                  <h4 className="text-base font-bold">Requester</h4>
                  <p className="text-base text-slate-500 font-medium mt-0.5">Submitted on Aug 12, 10:20 AM</p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm shadow-blue-200">
                    <span className="material-symbols-outlined text-base">hourglass_empty</span>
                  </div>
                  <div className="w-0.5 h-10 bg-slate-200/50 my-1"></div>
                </div>
                <div className="pt-1">
                  <h4 className="text-base font-bold text-blue-600">IT Department Head</h4>
                  <p className="text-xs text-primary font-bold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded inline-block mt-1">Awaiting review...</p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-base">circle</span>
                  </div>
                </div>
                <div className="pt-1">
                  <h4 className="text-base font-bold text-slate-400">Finance Approval</h4>
                  <p className="text-base text-slate-400 font-medium mt-0.5">Pending prior step</p>
                </div>
              </div>
            </div>
          </div>
          {/* Form Actions */}
          <div className="md:col-span-12 flex justify-end gap-6 pt-10">
            <button className="px-8 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors text-base uppercase tracking-widest" type="button">
              Cancel
            </button>
          <button disabled={isSubmitting || isSuccess} className={`px-12 py-4 text-white font-extrabold rounded-2xl shadow-xl transition-all flex items-center gap-3 disabled:opacity-80 ${isSuccess ? 'bg-green-500 shadow-green-500/20' : 'bg-gradient-to-br from-primary to-blue-700 shadow-blue-900/20 hover:scale-[1.02] active:scale-95'}`} type="submit">
            <span className="material-symbols-outlined text-base">{isSuccess ? 'check_circle' : 'send'}</span>
            {isSubmitting ? 'Submitting...' : isSuccess ? 'Success!' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default LicenseRequest;
