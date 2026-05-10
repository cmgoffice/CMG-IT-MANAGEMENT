const Dashboard = () => {
  return (
    <div className="p-8 max-w-[95%] mx-auto">
      <header className="relative mb-12 rounded-3xl overflow-hidden min-h-[320px] flex items-center shadow-lg border border-white/30 bg-surface/30 backdrop-blur-sm">
        <div className="absolute inset-0 z-0">
          <img 
            className="w-full h-full object-cover opacity-60 mix-blend-overlay" 
            alt="office" 
            src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1600&h=400&fit=crop"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent"></div>
        </div>
        <div className="relative z-10 px-12 max-w-2xl">
          <h1 className="text-5xl font-extrabold text-on-surface mb-4 tracking-tight leading-tight">
            Welcome to the <br/><span className="text-primary">CMG IT Management</span>
          </h1>
          <p className="text-lg text-on-surface-variant mb-8 font-body">
            Streamline your IT lifecycle. Managing 1,240 assets across 4 global departments with precision and clarity.
          </p>
          <div className="relative group max-w-md">
            <span className="absolute inset-y-0 left-4 flex items-center text-outline group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined">search</span>
            </span>
            <input 
              className="w-full pl-12 pr-4 py-4 bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl focus:ring-2 focus:ring-primary focus:bg-white/80 transition-all placeholder:text-outline font-body shadow-sm" 
              placeholder="Quick search for serial, user, or asset ID..." 
              type="text"
            />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white/40 group hover:bg-primary-container/20 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-secondary-container rounded-2xl text-on-secondary-container">
              <span className="material-symbols-outlined">computer</span>
            </div>
            <span className="text-xs font-bold text-primary bg-primary-container/20 px-3 py-1 rounded-full">+12 this month</span>
          </div>
          <div className="text-4xl font-extrabold text-on-surface mb-1">1,240</div>
          <div className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">Total Assets</div>
        </div>

        <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white/40 group hover:bg-error-container/20 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-error-container/20 rounded-2xl text-error">
              <span className="material-symbols-outlined">handyman</span>
            </div>
            <span className="text-xs font-bold text-error bg-error-container/20 px-3 py-1 rounded-full">High Priority</span>
          </div>
          <div className="text-4xl font-extrabold text-on-surface mb-1">18</div>
          <div className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">Pending Repairs</div>
        </div>

        <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-white/40 group hover:bg-tertiary-container/20 transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-tertiary-container/30 rounded-2xl text-on-tertiary-container">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="text-xs font-bold text-on-tertiary-container bg-tertiary-container/30 px-3 py-1 rounded-full">98% Online</span>
          </div>
          <div className="text-4xl font-extrabold text-on-surface mb-1">842</div>
          <div className="text-sm font-medium text-on-surface-variant uppercase tracking-wider">Active Users</div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl font-bold text-on-surface">Recent Asset History</h2>
            <a className="text-primary text-sm font-semibold hover:underline" href="#">View All Logs</a>
          </div>
          <div className="bg-white/20 backdrop-blur-xl rounded-3xl p-2 border border-white/30 shadow-sm">
            <div className="bg-white/40 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/30">
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Asset ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Equipment</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Assigned To</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-outline-variant uppercase tracking-wider text-right">Last Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20">
                    <tr className="hover:bg-white/40 transition-colors">
                      <td className="px-6 py-5 font-display font-bold text-primary">LAP-2024-089</td>
                      <td className="px-6 py-5 text-sm">MacBook Pro 16" M3</td>
                      <td className="px-6 py-5 text-sm text-on-surface-variant">Elena Rodriguez</td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-tight">Active</span>
                      </td>
                      <td className="px-6 py-5 text-xs text-right text-outline">2 hours ago</td>
                    </tr>
                    <tr className="hover:bg-white/40 transition-colors">
                      <td className="px-6 py-5 font-display font-bold text-primary">MON-2024-112</td>
                      <td className="px-6 py-5 text-sm">Dell UltraSharp 27"</td>
                      <td className="px-6 py-5 text-sm text-on-surface-variant">Marcus Thorne</td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1 bg-surface-container-highest text-outline rounded-full text-[10px] font-bold uppercase tracking-tight">Inventory</span>
                      </td>
                      <td className="px-6 py-5 text-xs text-right text-outline">5 hours ago</td>
                    </tr>
                    <tr className="hover:bg-white/40 transition-colors">
                      <td className="px-6 py-5 font-display font-bold text-primary">PER-2024-005</td>
                      <td className="px-6 py-5 text-sm">iPad Pro 12.9"</td>
                      <td className="px-6 py-5 text-sm text-on-surface-variant">Sarah Chen</td>
                      <td className="px-6 py-5">
                        <span className="px-3 py-1 bg-error-container text-error rounded-full text-[10px] font-bold uppercase tracking-tight">In Repair</span>
                      </td>
                      <td className="px-6 py-5 text-xs text-right text-outline">Yesterday</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-on-surface mb-4">Quick Actions</h2>
          <div className="bg-primary-container/20 backdrop-blur-md rounded-3xl p-8 border border-white/40 relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-on-primary-container mb-2">Register New Equipment</h3>
              <p className="text-primary-dim text-sm mb-6">Easily add new hardware to the organizational ledger.</p>
              <button className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:translate-x-1 transition-transform flex items-center gap-2">
                Launch Wizard <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <span className="material-symbols-outlined absolute -bottom-6 -right-6 text-9xl text-primary/5 group-hover:scale-110 transition-transform">qr_code_scanner</span>
          </div>

          <div className="bg-white/40 backdrop-blur-md rounded-3xl p-6 border border-white/40 shadow-sm">
            <h3 className="text-lg font-bold text-on-surface mb-4">Urgent Repair Tickets</h3>
            <div className="space-y-4">
              <div className="flex gap-4 p-3 hover:bg-white/40 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/20">
                <div className="w-10 h-10 rounded-full bg-error-container/20 text-error flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-sm">warning</span>
                </div>
                <div>
                  <div className="text-sm font-bold">Broken Screen - LAP-089</div>
                  <div className="text-xs text-on-surface-variant">Requested by Elena R. • 2h ago</div>
                </div>
              </div>
              <div className="flex gap-4 p-3 hover:bg-white/40 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/20">
                <div className="w-10 h-10 rounded-full bg-secondary-container/30 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-sm">battery_alert</span>
                </div>
                <div>
                  <div className="text-sm font-bold">Battery Swelling - PHN-112</div>
                  <div className="text-xs text-on-surface-variant">Requested by Marcus T. • 5h ago</div>
                </div>
              </div>
            </div>
            <button className="w-full mt-6 py-3 text-sm font-bold text-primary border-t border-white/20 hover:bg-white/20 transition-colors">
              View Maintenance Dashboard
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
