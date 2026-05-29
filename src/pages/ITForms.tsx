import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ITForms = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { userProfile } = useAuth();

  // ข้อมูลฟอร์มทั้งหมดเก็บไว้ใน Array เพื่อลดความซ้ำซ้อนและให้ดูแลง่ายขึ้น
  const formsData = [
    {
      id: "FM-IT-001",
      title: "Repair Request",
      desc: "Submit requests for hardware repairs, component troubleshooting, or device fixing.",
      icon: "handyman",
      path: "/forms/001",
    },
    {
      id: "FM-IT-002",
      title: "On-site Appointment",
      desc: "Schedule a 1-on-1 session with our technical team for onsite setup or consultations.",
      icon: "calendar_month",
      path: "/forms/002",
    },
    {
      id: "FM-IT-003",
      title: "Asset Request",
      desc: "Request new equipment or transfer existing IT assets between departments.",
      icon: "shopping_cart",
      path: "/forms/003",
    },
    {
      id: "FM-IT-004",
      title: "Asset Return",
      desc: "Formal process for returning equipment upon project completion or resignation.",
      icon: "inventory_2",
      path: "/forms/004",
    },
    {
      id: "FM-IT-005",
      title: "License Request",
      desc: "Submit requests for software license renewals, upgrades, and extensions.",
      icon: "workspace_premium",
      path: "/forms/005",
    },
    {
      id: "FM-IT-006",
      title: "Data Access Request",
      desc: "Form for requesting access to specific company data sources or internal servers.",
      icon: "lock_open",
      path: "/forms/006",
    },
    {
      id: "FM-IT-007",
      title: "Remote Support",
      desc: "Request for remote assistance from IT support to resolve immediate technical issues.",
      icon: "settings_remote",
      path: "/forms/007",
    },
  ];

  // กรองฟอร์มตามคำค้นหา
  const filteredForms = formsData.filter(
    (form) =>
      form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-8 pb-12 px-6 sm:px-10 min-h-screen relative z-10">
      <div className="max-w-[95%] mx-auto">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">IT Forms</h2>
            <p className="text-slate-700 font-medium">Select a standardized form to initiate your technical request.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl">search</span>
              <input 
                type="text" 
                placeholder="Search forms..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-full md:w-64 shadow-sm text-slate-800" 
              />
            </div>
            <button className="p-2.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 shadow-sm flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">filter_list</span>
            </button>
          </div>
        </div>

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredForms.length > 0 ? (
            filteredForms.map((form) => (
              <Link 
                key={form.id} 
                to={form.path} 
                className="bg-white rounded-xl p-6 border border-indigo-50 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="material-symbols-outlined text-3xl text-slate-800 mb-3">{form.icon}</span>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded w-max mb-2">{form.id}</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{form.title}</h3>
                <p className="text-sm text-slate-700 leading-relaxed mb-6 flex-1">{form.desc}</p>
                {userProfile && (
                  <button className="w-full py-2.5 bg-white border-2 border-indigo-400 text-indigo-600 font-semibold rounded-full group-hover:border-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-indigo-500 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-md">
                    Open Form
                  </button>
                )}
              </Link>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 font-medium bg-white/50 rounded-xl border border-dashed border-slate-300">
              <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">search_off</span>
              <p>No forms found for your search.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default ITForms;
