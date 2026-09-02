import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, deleteDoc, setDoc, writeBatch } from "firebase/firestore";
import { ROOT_COLLECTION, ROOT_DOCUMENT } from "../lib/db";

const defaultForms = [
  { id: "FM-IT-001", title: "Repair Request", desc: "Submit requests for hardware repairs, component troubleshooting, or device fixing.", icon: "handyman", path: "/forms/001", status: "Active" },
  { id: "FM-IT-002", title: "On-site Appointment", desc: "Schedule a 1-on-1 session with our technical team for onsite setup or consultations.", icon: "calendar_month", path: "/forms/002", status: "Active" },
  { id: "FM-IT-003", title: "Asset Request", desc: "Request new equipment or transfer existing IT assets between departments.", icon: "shopping_cart", path: "/forms/003", status: "Active" },
  { id: "FM-IT-004", title: "Asset Return", desc: "Formal process for returning equipment upon project completion or resignation.", icon: "inventory_2", path: "/forms/004", status: "Active" },
  { id: "FM-IT-005", title: "License Request", desc: "Submit requests for software license renewals, upgrades, and extensions.", icon: "workspace_premium", path: "/forms/005", status: "Active" },
  { id: "FM-IT-006", title: "Data Access Request", desc: "Form for requesting access to specific company data sources or internal servers.", icon: "lock_open", path: "/forms/006", status: "Active" },
  { id: "FM-IT-007", title: "Remote Support", desc: "Request for remote assistance from IT support to resolve immediate technical issues.", icon: "settings_remote", path: "/forms/007", status: "Active" },
  { id: "FM-IT-008", title: "Reviews", desc: "ให้คะแนนการบริการของฝ่าย IT แบบดาว 1-5 พร้อมเขียนรีวิวเพิ่มเติมได้", icon: "reviews", path: "/forms/008", status: "Active" },
];

type ITFormCard = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  path: string;
  status: string;
  docId: string;
};

const ITForms = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { userProfile } = useAuth();
  const [formsData, setFormsData] = useState<ITFormCard[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState({ id: '', title: '', desc: '', icon: 'article', path: '', status: 'Active' });

  const isMasterAdmin = Array.isArray(userProfile?.role) 
    ? userProfile.role.includes('MasterAdmin') 
    : userProfile?.role === 'MasterAdmin';

  useEffect(() => {
    const colRef = collection(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'itForms');
    const unsubscribe = onSnapshot(colRef, async (snap) => {
      if (snap.empty) {
        // Seed database
        const batch = writeBatch(db);
        defaultForms.forEach(form => {
          const docRef = doc(colRef, form.id);
          batch.set(docRef, form);
        });
        await batch.commit();
      } else {
        const existingIds = new Set(snap.docs.map((item) => item.id));
        const missingDefaults = defaultForms.filter((form) => !existingIds.has(form.id));
        const outdatedDefaults = snap.docs
          .map((item) => ({ ...(item.data() as Omit<ITFormCard, 'docId'>), id: item.id }))
          .flatMap((existingForm) => {
            const defaultForm = defaultForms.find((form) => form.id === existingForm.id);
            if (!defaultForm) return [];

            const hasChanged =
              existingForm.title !== defaultForm.title ||
              existingForm.desc !== defaultForm.desc ||
              existingForm.icon !== defaultForm.icon ||
              existingForm.path !== defaultForm.path ||
              existingForm.status !== defaultForm.status;

            return hasChanged ? [defaultForm] : [];
          });

        if (missingDefaults.length > 0 || outdatedDefaults.length > 0) {
          const batch = writeBatch(db);
          missingDefaults.forEach((form) => {
            batch.set(doc(colRef, form.id), form);
          });
          outdatedDefaults.forEach((form) => {
            batch.set(doc(colRef, form.id), form, { merge: true });
          });
          await batch.commit();
        }

        const data = snap.docs.map((doc): ITFormCard => ({ ...(doc.data() as Omit<ITFormCard, 'docId'>), docId: doc.id }));
        data.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        setFormsData(data);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete this card?")) return;
    try {
      await deleteDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'itForms', docId));
    } catch (e) {
      console.error(e);
      alert("Failed to delete card");
    }
  };

  const handleAddForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docId = newForm.id || `custom-${Date.now()}`;
      await setDoc(doc(db, ROOT_COLLECTION, ROOT_DOCUMENT, 'itForms', docId), { ...newForm });
      setShowAddModal(false);
      setNewForm({ id: '', title: '', desc: '', icon: 'article', path: '', status: 'Active' });
    } catch (e) {
      console.error(e);
      alert("Failed to add new card");
    }
  };

  // กรองเอาเฉพาะสถานะ Active ตามที่ User ร้องขอ และ กรองฟอร์มตามคำค้นหา
  const activeForms = formsData.filter(f => f.status === 'Active');
  
  const filteredForms = activeForms.filter(
    (form) =>
      form.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      form.desc?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-8 pb-12 px-6 sm:px-10 min-h-screen relative z-10">
      <div className="max-w-[95%] mx-auto">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">IT Forms & Services</h2>
            <p className="text-slate-700 font-medium">Select a standardized form or service to initiate your technical request.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isMasterAdmin && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                New Card
              </button>
            )}
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
          </div>
        </div>

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredForms.length > 0 ? (
            filteredForms.map((form) => {
              const isExternal = form.path?.startsWith('http');
              
              const CardContent = (
                <>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {isMasterAdmin && (
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(form.docId); }}
                      className="absolute top-4 right-4 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all z-20"
                      title="Delete Card"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  )}

                  <span className="material-symbols-outlined text-3xl text-slate-800 mb-3">{form.icon || 'article'}</span>
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded w-max mb-2">{form.id || 'SERVICE'}</span>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{form.title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed mb-6 flex-1">{form.desc}</p>
                  
                  {userProfile && (
                    <div className="w-full text-center py-2.5 bg-white border-2 border-indigo-400 text-indigo-600 font-semibold rounded-full group-hover:border-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-indigo-500 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-md">
                      {isExternal ? 'Open Link' : 'Open Form'}
                    </div>
                  )}
                </>
              );

              const wrapperClass = "bg-white rounded-xl p-6 border border-indigo-50 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col group relative overflow-hidden block";

              return isExternal ? (
                <a key={form.docId} href={form.path} target="_blank" rel="noopener noreferrer" className={wrapperClass}>
                  {CardContent}
                </a>
              ) : (
                <Link key={form.docId} to={form.path || '/'} className={wrapperClass}>
                  {CardContent}
                </Link>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 font-medium bg-white/50 rounded-xl border border-dashed border-slate-300">
              <span className="material-symbols-outlined text-4xl mb-2 text-slate-400">search_off</span>
              <p>No forms or services found for your search.</p>
            </div>
          )}
        </div>
        
      </div>

      {/* Add Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10010] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-[fadeIn_0.2s_ease-out]">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Add New Card</h2>
            <form onSubmit={handleAddForm} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Card ID / Tag</label>
                  <input type="text" required value={newForm.id} onChange={e => setNewForm({...newForm, id: e.target.value})} className="w-full p-2.5 border rounded-lg" placeholder="e.g. SRV-001" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Icon Name (Material)</label>
                  <input type="text" value={newForm.icon} onChange={e => setNewForm({...newForm, icon: e.target.value})} className="w-full p-2.5 border rounded-lg" placeholder="e.g. language" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Title</label>
                <input type="text" required value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} className="w-full p-2.5 border rounded-lg" placeholder="Card Title" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <textarea rows={2} required value={newForm.desc} onChange={e => setNewForm({...newForm, desc: e.target.value})} className="w-full p-2.5 border rounded-lg" placeholder="Short description..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Path or External URL</label>
                <input type="text" required value={newForm.path} onChange={e => setNewForm({...newForm, path: e.target.value})} className="w-full p-2.5 border rounded-lg" placeholder="/forms/xyz or https://..." />
                <p className="text-xs text-slate-500 mt-1">Starts with "http" to open an external link.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                <select value={newForm.status} onChange={e => setNewForm({...newForm, status: e.target.value})} className="w-full p-2.5 border rounded-lg">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700">Save Card</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ITForms;
