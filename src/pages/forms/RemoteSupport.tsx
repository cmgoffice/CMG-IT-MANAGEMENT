
const RemoteSupport = () => {
  const today = new Date().toISOString().split('T')[0];
  return (
    <>

<div className="max-w-[95%] mx-auto p-8 md:p-12">
{/*  Form Header Section  */}
<div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
<div>
<h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">Remote Support &amp; Installation</h1>
</div>
<div className="flex gap-2">
<button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-lg font-bold text-slate-600 hover:bg-slate-50">
<span className="material-symbols-outlined">print</span> Print
                </button>
<button className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-lg font-bold text-white hover:bg-blue-700 shadow-md">
<span className="material-symbols-outlined">save</span> Save Draft
                </button>
</div>
</div>
<form className="space-y-6">
{/*  Category Section: Bento Style Grid  */}
<section className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm">
<h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
<span className="material-symbols-outlined text-blue-500">category</span>
                    Equipment Category
                </h2>
<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
<label className="relative flex flex-col items-center justify-center p-4 bg-white/50 border-2 border-transparent rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group">
<input checked={true} className="sr-only peer" name="category" type="radio"/>
<span className="material-symbols-outlined text-3xl mb-2 text-slate-400 peer-checked:text-blue-600 group-hover:scale-110 transition-transform">laptop_mac</span>
<span className="text-base font-bold text-slate-500 peer-checked:text-blue-700">Computer/Laptop</span>
<div className="absolute inset-0 border-2 border-blue-500 rounded-xl opacity-0 peer-checked:opacity-100"></div>
</label>
<label className="relative flex flex-col items-center justify-center p-4 bg-white/50 border-2 border-transparent rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group">
<input className="sr-only peer" name="category" type="radio"/>
<span className="material-symbols-outlined text-3xl mb-2 text-slate-400 peer-checked:text-blue-600 group-hover:scale-110 transition-transform">print</span>
<span className="text-base font-bold text-slate-500 peer-checked:text-blue-700">Printer/Copier</span>
<div className="absolute inset-0 border-2 border-blue-500 rounded-xl opacity-0 peer-checked:opacity-100"></div>
</label>
<label className="relative flex flex-col items-center justify-center p-4 bg-white/50 border-2 border-transparent rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group">
<input className="sr-only peer" name="category" type="radio"/>
<span className="material-symbols-outlined text-3xl mb-2 text-slate-400 peer-checked:text-blue-600 group-hover:scale-110 transition-transform">settings_input_antenna</span>
<span className="text-base font-bold text-slate-500 peer-checked:text-blue-700">Radio Comm</span>
<div className="absolute inset-0 border-2 border-blue-500 rounded-xl opacity-0 peer-checked:opacity-100"></div>
</label>
<label className="relative flex flex-col items-center justify-center p-4 bg-white/50 border-2 border-transparent rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group">
<input className="sr-only peer" name="category" type="radio"/>
<span className="material-symbols-outlined text-3xl mb-2 text-slate-400 peer-checked:text-blue-600 group-hover:scale-110 transition-transform">videocam</span>
<span className="text-base font-bold text-slate-500 peer-checked:text-blue-700">CCTV</span>
<div className="absolute inset-0 border-2 border-blue-500 rounded-xl opacity-0 peer-checked:opacity-100"></div>
</label>
<label className="relative flex flex-col items-center justify-center p-4 bg-white/50 border-2 border-transparent rounded-xl cursor-pointer hover:bg-white hover:border-blue-400 transition-all group">
<input className="sr-only peer" name="category" type="radio"/>
<span className="material-symbols-outlined text-3xl mb-2 text-slate-400 peer-checked:text-blue-600 group-hover:scale-110 transition-transform">more_horiz</span>
<span className="text-base font-bold text-slate-500 peer-checked:text-blue-700">Other</span>
<div className="absolute inset-0 border-2 border-blue-500 rounded-xl opacity-0 peer-checked:opacity-100"></div>
</label>
</div>
</section>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
{/*  Applicant Info  */}
<section className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm">
<h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
<span className="material-symbols-outlined text-blue-500">person</span>
                        Applicant Info
                    </h2>
<div className="space-y-4">
<div>
<label className="block text-base font-bold text-slate-500 mb-1 uppercase tracking-wider">Full Name</label>
<input className="w-full bg-white/50 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300 transition-all" placeholder="John Doe" type="text"/>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-base font-bold text-slate-500 mb-1 uppercase tracking-wider">Department</label>
<input className="w-full bg-white/50 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300" placeholder="Engineering" type="text"/>
</div>
<div>
<label className="block text-base font-bold text-slate-500 mb-1 uppercase tracking-wider">Job Title</label>
<input className="w-full bg-white/50 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300" placeholder="Technician" type="text"/>
</div>
</div>
<div>
<label className="block text-base font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone / Ext.</label>
<input className="w-full bg-white/50 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300" placeholder="+1 (555) 000-0000" type="text"/>
</div>
</div>
</section>
{/*  Request Details  */}
<section className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm">
<h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
<span className="material-symbols-outlined text-blue-500">checklist</span>
                        Request Details
                    </h2>
<div className="space-y-3">
<label className="flex items-center gap-3 p-3 bg-white/40 rounded-xl cursor-pointer hover:bg-white/60 transition-colors">
<input className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox"/>
<span className="font-medium text-base text-slate-700">Slow / Laggy Performance</span>
</label>
<label className="flex items-center gap-3 p-3 bg-white/40 rounded-xl cursor-pointer hover:bg-white/60 transition-colors">
<input className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox"/>
<span className="font-medium text-base text-slate-700">Installation (SW / HW)</span>
</label>
<label className="flex items-center gap-3 p-3 bg-white/40 rounded-xl cursor-pointer hover:bg-white/60 transition-colors">
<input className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox"/>
<span className="font-medium text-base text-slate-700">Repair / Fix</span>
</label>
<label className="flex items-center gap-3 p-3 bg-white/40 rounded-xl cursor-pointer hover:bg-white/60 transition-colors">
<input className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox"/>
<span className="font-medium text-base text-slate-700">Other Request</span>
</label>
</div>
</section>
</div>
{/*  Detailed Description  */}
<section className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm">
<h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
<span className="material-symbols-outlined text-blue-500">description</span>
                    Requirement Description
                </h2>
<textarea className="w-full bg-white/50 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-300" placeholder="Provide a detailed description of the software to be installed or the technical issue you're facing..." rows={4}></textarea>
</section>
{/*  Remote Connection Info  */}
<section className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
<h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
<span className="material-symbols-outlined text-blue-500">deskphone</span>
                    Remote Access Information
                </h2>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
<div>
<label className="block text-base font-bold text-slate-500 mb-1 uppercase tracking-wider">Remote Software</label>
<select className="w-full bg-white/70 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500">
<option>TeamViewer</option>
<option>AnyDesk</option>
<option>Remote Desktop (RDP)</option>
<option>Zoom / Teams</option>
</select>
</div>
<div>
<label className="block text-base font-bold text-slate-500 mb-1 uppercase tracking-wider">Remote ID / IP</label>
<input className="w-full bg-white/70 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 font-mono" placeholder="999 888 777" type="text"/>
</div>
<div>
<label className="block text-base font-bold text-slate-500 mb-1 uppercase tracking-wider">Scheduled Time</label>
<input className="w-full bg-white/70 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" type="datetime-local"/>
</div>
</div>
</section>
{/*  Signatures Section  */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<section className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm">
<h2 className="text-base font-bold text-slate-400 mb-4 uppercase tracking-[0.2em]">Reporter / Applicant</h2>
<div className="border-b-2 border-slate-100 h-24 mb-4 relative group">
<span className="absolute bottom-2 left-2 text-slate-300 text-sm italic group-hover:text-blue-300 transition-colors">Sign Here</span>
<img className="hidden" data-alt="close up of a digital signature on a screen with blue light glow" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSun7y23mc_0cPoT86TMsh3j55qMn_y-8PKFUZNurF0zYcvwcVPOhSGC8o73tQtFy8eVSzQLDbEJOIwXSQQR-l_EsS0Bg2SfFiv3GZ0aJVk7WxODa1YxW1VWp_9JQfvQZsWIjmdix4Wz-7Yv_ASdUlyKW11tHs28JoMdP6Z567vfuXAbkmbbcxGB-X7465YQrY8ovDOlMj2po6I1I_2ocjAf00mA1-kIb2j7-ilgVFS5I4f2tPWB7RFxiMVbZQOV916zjsaYErLQvY"/>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-base font-bold text-slate-400 mb-1 uppercase">Date</label>
<input className="w-full bg-transparent border-0 border-b border-slate-200 p-0 text-base focus:ring-0 focus:border-blue-500" type="date" defaultValue={today}/>
</div>
<div>
<label className="block text-base font-bold text-slate-400 mb-1 uppercase">Time</label>
<input className="w-full bg-transparent border-0 border-b border-slate-200 p-0 text-base focus:ring-0 focus:border-blue-500" type="time"/>
</div>
</div>
</section>
<section className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm">
<h2 className="text-base font-bold text-slate-400 mb-4 uppercase tracking-[0.2em]">IT recipient / Specialist</h2>
<div className="border-b-2 border-slate-100 h-24 mb-4 relative group">
<span className="absolute bottom-2 left-2 text-slate-300 text-sm italic group-hover:text-blue-300 transition-colors">Sign Here</span>
</div>
<div className="grid grid-cols-2 gap-4">
<div>
<label className="block text-base font-bold text-slate-400 mb-1 uppercase">Date Received</label>
<input className="w-full bg-transparent border-0 border-b border-slate-200 p-0 text-base focus:ring-0 focus:border-blue-500" type="date" defaultValue={today}/>
</div>
<div>
<label className="block text-base font-bold text-slate-400 mb-1 uppercase">Action Time</label>
<input className="w-full bg-transparent border-0 border-b border-slate-200 p-0 text-base focus:ring-0 focus:border-blue-500" type="time"/>
</div>
</div>
</section>
</div>
{/*  Submit Button Area  */}
<div className="pt-6 flex flex-col md:flex-row gap-4 items-center justify-between border-t border-white/20">
<p className="text-base text-slate-500 italic">By submitting this form, you acknowledge that IT personnel may access your device remotely for the purpose of technical support.</p>
<button className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1 active:scale-95 transition-all" type="submit">
                    Submit Request
                </button>
</div>
</form>
</div>

    </>
  );
};

export default RemoteSupport;

