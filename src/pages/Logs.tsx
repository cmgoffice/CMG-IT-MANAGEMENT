const logs = [
  { date: 'Oct 24, 2023', time: '14:23:01', initials: 'JS', name: 'Jane Smith', email: 'admin@itpro.com', action: 'Asset Registered', actionBg: 'bg-blue-100', actionColor: 'text-blue-700', module: 'Inventory v2.4', ip: '192.168.1.142', ok: true },
  { date: 'Oct 24, 2023', time: '13:45:12', initials: 'RK', name: 'Robert King', email: 'robert@itpro.com', action: 'Repair Requested', actionBg: 'bg-amber-100', actionColor: 'text-amber-700', module: 'Ticketing System', ip: '10.0.4.88', ok: true },
  { date: 'Oct 24, 2023', time: '13:12:44', initials: 'JS', name: 'Jane Smith', email: 'admin@itpro.com', action: 'Logged In', actionBg: 'bg-emerald-100', actionColor: 'text-emerald-700', module: 'Core Auth', ip: '192.168.1.142', ok: true },
  { date: 'Oct 24, 2023', time: '12:58:30', initials: '??', name: 'Unknown Device', email: 'N/A', action: 'Failed Auth', actionBg: 'bg-red-100', actionColor: 'text-red-700', module: 'Core Auth', ip: '45.23.112.9', ok: false },
  { date: 'Oct 24, 2023', time: '11:04:19', initials: 'MA', name: 'Marc Adams', email: 'marc@itpro.com', action: 'System Config Changed', actionBg: 'bg-blue-100', actionColor: 'text-blue-700', module: 'Global Settings', ip: '172.16.0.45', ok: true },
];

const Logs = () => (
  <div className="pt-8 pb-12 px-8 min-h-screen">
    <div className="max-w-[95%] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#2c3437] tracking-tight font-display">Transaction Logs</h1>
          <p className="text-[#596064] mt-1 font-body">Real-time audit trail of all administrative and user activities.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white/60 border border-[#dce4e8] rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-white/80 transition-colors font-body">
            <span className="material-symbols-outlined text-base">download</span>Export CSV
          </button>
          <button className="px-4 py-2 bg-[#27619d] text-[#f8f8ff] rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-colors font-body">
            <span className="material-symbols-outlined text-base">filter_list</span>Advanced Filters
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events (24h)', value: '12,842', sub: '14% from yesterday', subColor: 'text-emerald-600' },
          { label: 'Security Alerts', value: '3', valueColor: 'text-red-600', sub: 'Immediate action required', subColor: 'text-red-600' },
          { label: 'Active Sessions', value: '142', valueColor: 'text-[#27619d]', sub: 'Peak load at 10:45 AM', subColor: 'text-[#596064]' },
          { label: 'DB Response Time', value: '24ms', sub: 'Within optimal range', subColor: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white/40 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm">
            <div className="text-[#596064] text-xs font-bold uppercase tracking-wider mb-2 font-body">{s.label}</div>
            <div className={`text-2xl font-extrabold font-display ${s.valueColor ?? 'text-[#2c3437]'}`}>{s.value}</div>
            <div className={`mt-2 text-xs ${s.subColor} font-body`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white/40 backdrop-blur-md border border-white/40 p-6 rounded-2xl flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-bold text-[#596064] uppercase mb-2 font-body">Date Range</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747c80] text-sm">calendar_today</span>
            <select className="w-full pl-10 pr-4 py-2 bg-white border border-[#dce4e8] rounded-lg text-sm focus:ring-2 focus:ring-[#27619d]/20 outline-none font-body">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Custom Range</option>
            </select>
          </div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-bold text-[#596064] uppercase mb-2 font-body">User</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#747c80] text-sm">person</span>
            <input className="w-full pl-10 pr-4 py-2 bg-white border border-[#dce4e8] rounded-lg text-sm focus:ring-2 focus:ring-[#27619d]/20 outline-none font-body" placeholder="Filter by user..." />
          </div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-bold text-[#596064] uppercase mb-2 font-body">Module</label>
          <select className="w-full px-4 py-2 bg-white border border-[#dce4e8] rounded-lg text-sm focus:ring-2 focus:ring-[#27619d]/20 outline-none font-body">
            <option>All Modules</option>
            <option>Authentication</option>
            <option>Asset Management</option>
            <option>Repair Tickets</option>
          </select>
        </div>
        <button className="bg-[#eaeff2] p-2 rounded-lg text-[#596064] hover:bg-[#dce4e8] transition-colors">
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl overflow-hidden shadow-xl shadow-slate-200/30">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-[#dce4e8]">
            <tr>
              {['Timestamp','User','Action','Module Affected','IP Address','Status'].map((h, i) => (
                <th key={h} className={`px-6 py-4 text-xs font-bold text-[#596064] uppercase tracking-widest font-body ${i === 5 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4f7]">
            {logs.map((log, idx) => (
              <tr key={idx} className="hover:bg-white/60 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-[#2c3437] font-body">{log.date}</div>
                  <div className="text-xs text-[#747c80] font-body">{log.time}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#c7e7ff] flex items-center justify-center text-[#27619d] font-bold text-xs font-body">{log.initials}</div>
                    <div>
                      <div className="text-sm font-semibold text-[#2c3437] font-body">{log.name}</div>
                      <div className="text-xs text-[#747c80] font-body">{log.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 ${log.actionBg} ${log.actionColor} rounded-md text-xs font-bold font-body`}>{log.action}</span>
                </td>
                <td className="px-6 py-4 text-sm text-[#596064] font-body">{log.module}</td>
                <td className="px-6 py-4 text-sm font-mono text-[#596064]">{log.ip}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`material-symbols-outlined text-base ${log.ok ? 'text-green-500' : 'text-red-500'}`}>
                    {log.ok ? 'check_circle' : 'error'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 bg-slate-50/50 border-t border-[#dce4e8] flex justify-between items-center">
          <div className="text-sm text-[#596064] font-body">Showing 1 to 5 of 12,842 results</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-[#dce4e8] rounded hover:bg-white transition-colors text-[#747c80]"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
            <button className="px-3 py-1 border border-[#27619d] bg-[#27619d] text-white rounded text-xs font-bold">1</button>
            <button className="px-3 py-1 border border-[#dce4e8] rounded hover:bg-white transition-colors text-xs text-[#596064]">2</button>
            <button className="px-3 py-1 border border-[#dce4e8] rounded hover:bg-white transition-colors text-xs text-[#596064]">3</button>
            <button className="px-3 py-1 border border-[#dce4e8] rounded hover:bg-white transition-colors text-[#747c80]"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
          </div>
        </div>
      </div>

      {/* Bottom Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-4">
        <div className="lg:col-span-2 bg-white/40 backdrop-blur-md border border-white/40 p-8 rounded-3xl overflow-hidden relative group shadow-sm">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-[#2c3437] mb-2 font-display">Automated Security Insights</h3>
            <p className="text-[#596064] max-w-md mb-6 font-body">Our AI analysis identified a pattern of 4 failed logins from an unusual IP. We've temporarily blacklisted the subnet for 2 hours.</p>
            <button className="px-6 py-2.5 bg-[#27619d] text-white rounded-full text-sm font-bold shadow-lg shadow-[#27619d]/20 hover:opacity-90 transition-all font-body">Review Security Incident</button>
          </div>
          <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-10 group-hover:opacity-20 transition-opacity">
            <img alt="Server" className="h-full w-full object-cover" src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=400&fit=crop" />
          </div>
        </div>
        <div className="bg-[#27619d] p-8 rounded-3xl text-white flex flex-col justify-between shadow-xl shadow-[#27619d]/20">
          <div>
            <span className="material-symbols-outlined text-4xl mb-4 block">auto_awesome</span>
            <h3 className="text-xl font-bold mb-2 font-display">Live Stream Active</h3>
            <p className="text-blue-100 text-sm opacity-80 font-body">Connected to 12 edge nodes. Logs are streaming with &lt;5ms latency.</p>
          </div>
          <div className="flex items-center gap-4 mt-6">
            <div className="flex -space-x-2">
              {['MK','TR','+4'].map((t) => (
                <div key={t} className="h-8 w-8 rounded-full border-2 border-[#27619d] bg-[#86b9fb] flex items-center justify-center text-[10px] font-bold text-[#003662]">{t}</div>
              ))}
            </div>
            <span className="text-xs font-medium font-body">Monitoring now</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default Logs;
