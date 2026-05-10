import { Link } from "react-router-dom";

const ITForms = () => {
  return (
    <div className="pt-8 pb-12 px-8 min-h-screen relative z-10">
      <div className="max-w-[95%] mx-auto">
      {/* TopNavBar Concept (Hybrid) */}
      <header className="flex justify-between items-center w-full mb-12">
        <div className="space-y-1">
          <h2 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">IT Forms</h2>
          <p className="text-on-surface-variant font-body">Select a standardized form to initiate your technical request.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group hidden sm:block">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant group-focus-within:text-primary transition-colors">search</span>
            <input className="pl-12 pr-6 py-3 bg-surface-container-lowest/60 backdrop-blur-xl border-0 ring-1 ring-outline-variant/15 rounded-full w-64 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all outline-none" placeholder="Search forms..." type="text"/>
          </div>
          <button className="w-12 h-12 rounded-full hidden sm:flex items-center justify-center bg-surface-container-lowest backdrop-blur-xl ring-1 ring-outline-variant/15 text-on-surface hover:bg-primary-container/20 transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      {/* Forms Bento-inspired Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* FM-IT-001: Repair Request */}
        <Link to="/forms/001" className="group bg-surface-container-lowest backdrop-blur-xl rounded-xl p-8 ring-1 ring-outline-variant/15 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-3xl">build</span>
            </div>
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-primary-dim uppercase bg-primary-fixed/20 px-3 py-1 rounded-full">FM-IT-001</span>
              <h3 className="font-headline text-xl font-bold mt-3 text-on-surface">Repair Request</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">Submit requests for hardware repairs, screen replacements, or component failure troubleshooting.</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs font-medium text-outline">Avg. Processing: 24h</span>
            <button className="px-5 py-2 rounded-full bg-surface-container-highest text-primary font-bold text-sm hover:bg-primary hover:text-on-primary transition-all">Open Form</button>
          </div>
        </Link>

        {/* FM-IT-002: IT Appointment */}
        <Link to="/forms/002" className="group bg-surface-container-lowest backdrop-blur-xl rounded-xl p-8 ring-1 ring-outline-variant/15 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 lg:col-span-1">
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-xl bg-tertiary-container/30 flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
              <span className="material-symbols-outlined text-3xl">calendar_month</span>
            </div>
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-tertiary-dim uppercase bg-tertiary-fixed/40 px-3 py-1 rounded-full">FM-IT-002</span>
              <h3 className="font-headline text-xl font-bold mt-3 text-on-surface">IT Appointment</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">Schedule a 1-on-1 session with our technical team for complex setup or consultation.</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs font-medium text-outline">Flexible Scheduling</span>
            <button className="px-5 py-2 rounded-full bg-surface-container-highest text-primary font-bold text-sm hover:bg-primary hover:text-on-primary transition-all">Open Form</button>
          </div>
        </Link>

        {/* FM-IT-003: Asset Request & Transfer (Wide) */}
        <Link to="/forms/003" className="group bg-surface-container-lowest backdrop-blur-xl rounded-xl p-8 ring-1 ring-outline-variant/15 flex flex-col md:flex-row gap-8 hover:-translate-y-1 transition-all duration-300 lg:col-span-2">
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span className="material-symbols-outlined text-3xl">shopping_cart</span>
              </div>
              <div>
                <span className="font-label text-xs font-bold tracking-widest text-primary-dim uppercase bg-primary-fixed/20 px-3 py-1 rounded-full">FM-IT-003</span>
                <h3 className="font-headline text-2xl font-bold mt-3 text-on-surface">Asset Request &amp; Transfer</h3>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed max-w-md">Request new equipment or transfer existing IT assets between departments or physical locations.</p>
              </div>
            </div>
            <div className="mt-8">
              <button className="px-8 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">Initialize Request</button>
            </div>
          </div>
          <div className="w-full md:w-1/3 rounded-xl overflow-hidden h-48 md:h-auto relative">
            <img className="absolute inset-0 w-full h-full object-cover" alt="clean minimal composition of modern high-end laptops and peripherals on a white marble surface with soft blue lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAh4tM1fS0bguUv2GPUnC6t3sV1fI-uyh62fDMRQv2_e8ZdPkIE6UUtDnC5_nb3GC9Ep9cBbQQqCOLMhEBjBtMdJhq34EmTZQLoGtbQEw4YTvptYpWhHklV-TOHLG5SyWf8o42BLVJjNJxFcCsYrRshOcuQCJRw2drs-xlF88K7jHQT7F8vRnb20NgnxIoexPIsdW9v8-lw-iEyc4SVsGawKiHV7YWdCNmBApKIeChbO07b7AP-YmZR7mAX_f7Q9IVhoict1oVxRnQy"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
          </div>
        </Link>

        {/* FM-IT-004: Asset Return */}
        <Link to="/forms/004" className="group bg-surface-container-lowest backdrop-blur-xl rounded-xl p-8 ring-1 ring-outline-variant/15 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-700 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-3xl">assignment_return</span>
            </div>
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-slate-500 uppercase bg-slate-200 px-3 py-1 rounded-full">FM-IT-004</span>
              <h3 className="font-headline text-xl font-bold mt-3 text-on-surface">Asset Return</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">Formal process for returning equipment upon project completion or employee offboarding.</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs font-medium text-outline">Inventory Update</span>
            <button className="px-5 py-2 rounded-full bg-surface-container-highest text-primary font-bold text-sm hover:bg-primary hover:text-on-primary transition-all">Open Form</button>
          </div>
        </Link>

        {/* FM-IT-005: License Request */}
        <Link to="/forms/005" className="group bg-surface-container-lowest backdrop-blur-xl rounded-xl p-8 ring-1 ring-outline-variant/15 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
              <span className="material-symbols-outlined text-3xl">vpn_key</span>
            </div>
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-primary-dim uppercase bg-primary-fixed/20 px-3 py-1 rounded-full">FM-IT-005</span>
              <h3 className="font-headline text-xl font-bold mt-3 text-on-surface">License Request</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">Request software keys, subscriptions, or specialized tools for design and development.</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs font-medium text-outline">Compliance Checked</span>
            <button className="px-5 py-2 rounded-full bg-surface-container-highest text-primary font-bold text-sm hover:bg-primary hover:text-on-primary transition-all">Open Form</button>
          </div>
        </Link>

        {/* FM-IT-006: User Registration & Data Access */}
        <Link to="/forms/006" className="group bg-surface-container-lowest backdrop-blur-xl rounded-xl p-8 ring-1 ring-outline-variant/15 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 lg:col-span-1">
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-xl bg-tertiary-container/30 flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
              <span className="material-symbols-outlined text-3xl">person_add</span>
            </div>
            <div>
              <span className="font-label text-xs font-bold tracking-widest text-tertiary-dim uppercase bg-tertiary-fixed/40 px-3 py-1 rounded-full">FM-IT-006</span>
              <h3 className="font-headline text-xl font-bold mt-3 text-on-surface">User Registration</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">Grant new hires access to internal systems, databases, and secure server environments.</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/10 flex items-center justify-between">
            <span className="text-xs font-medium text-outline">IAM Approved</span>
            <button className="px-5 py-2 rounded-full bg-surface-container-highest text-primary font-bold text-sm hover:bg-primary hover:text-on-primary transition-all">Open Form</button>
          </div>
        </Link>

        {/* FM-IT-007: Remote Support & Software Installation (Main Focus) */}
        <Link to="/forms/007" className="group bg-surface-container-lowest backdrop-blur-xl rounded-xl p-8 ring-1 ring-outline-variant/15 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 lg:col-span-2 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-10">
            <div className="flex-1 space-y-6">
              <div className="w-14 h-14 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>settings_remote</span>
              </div>
              <div>
                <span className="font-label text-xs font-bold tracking-widest text-primary-dim uppercase bg-primary-fixed px-3 py-1 rounded-full">FM-IT-007</span>
                <h3 className="font-headline text-2xl font-bold mt-3 text-on-surface">Remote Support &amp; Software</h3>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">Request remote desktop assistance or the deployment of proprietary enterprise software packages to your machine.</p>
              </div>
            </div>
            <div className="md:w-1/2 space-y-4">
              <div className="p-4 bg-surface-container-low rounded-xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
                  <span className="material-symbols-outlined text-xl">speed</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface uppercase tracking-tight">Current Response Time</p>
                  <p className="text-lg font-headline font-extrabold text-primary">~ 15 Minutes</p>
                </div>
              </div>
              <button className="w-full py-4 rounded-full bg-primary text-on-primary font-bold hover:bg-primary-dim transition-all flex items-center justify-center gap-2">
                <span>Request Remote Session</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
        </Link>
      </div>

      {/* Footer Stats */}
      <footer className="mt-16 flex flex-col md:flex-row gap-8 items-center justify-between p-8 bg-surface-container-low/50 backdrop-blur-xl rounded-xl">
        <div className="flex gap-12">
          <div>
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant">Active Requests</p>
            <p className="text-2xl font-headline font-extrabold text-on-surface">12</p>
          </div>
          <div>
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant">Closed This Week</p>
            <p className="text-2xl font-headline font-extrabold text-on-surface">48</p>
          </div>
          <div>
            <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant">Satisfaction Rate</p>
            <p className="text-2xl font-headline font-extrabold text-primary">98.4%</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-on-surface-variant text-sm">
          <span className="material-symbols-outlined">help_outline</span>
          <span>Need immediate assistance? <a className="text-primary font-bold hover:underline" href="#">Contact the Help Desk</a></span>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default ITForms;
