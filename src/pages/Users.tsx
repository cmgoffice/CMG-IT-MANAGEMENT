import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, runTransaction, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile, UserRole } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const APP_NAME = 'CMG-IT-MANAGEMENT';
const ROLES: UserRole[] = ['MasterAdmin', 'MD', 'GM', 'PD', 'Staff'];
const DEPARTMENTS = ['Cybersecurity', 'Cloud Infrastructure', 'Front-end Dev', 'Compliance', 'IT Support', 'HR', 'Finance'];

const Users = () => {
  const { userProfile: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState('All Users');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, `${APP_NAME}/root/users`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: (UserProfile & { _docId?: string })[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ ...doc.data(), _docId: doc.id } as UserProfile & { _docId: string });
      });
      usersData.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setUsers(usersData);
    });

    return () => unsubscribe();
  }, []);

  // Guard: only MasterAdmin can access (AFTER all hooks)
  const isMasterAdmin = currentUser && (
    Array.isArray(currentUser.role) 
      ? currentUser.role.includes('MasterAdmin') 
      : currentUser.role === 'MasterAdmin'
  );

  if (!isMasterAdmin) {
    return <Navigate to="/" replace />;
  }

  const filtered = users.filter((u) => {
    if (activeTab === 'Administrators') {
      return Array.isArray(u.role) ? u.role.includes('MasterAdmin') : u.role === 'MasterAdmin';
    }
    if (activeTab === 'Pending Requests') return u.status === 'pending';
    return true;
  });

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);
    setError('');

    try {
      await runTransaction(db, async (transaction) => {
        const docId = (editingUser as any)._docId || editingUser.email;
        const userRef = doc(db, `${APP_NAME}/root/users`, docId);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) {
          throw new Error('User does not exist!');
        }

        // Apply changes
        transaction.update(userRef, {
          role: editingUser.role,
          department: editingUser.department || '',
          status: editingUser.status,
          assignedProjects: editingUser.assignedProjects || [],
          updatedAt: Timestamp.now()
        });
      });
      setEditingUser(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save user. Someone else might be editing.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const docId = (userToDelete as any)._docId || userToDelete.email;
      await deleteDoc(doc(db, `${APP_NAME}/root/users`, docId));
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div className="pt-8 pb-12 px-8 min-h-screen relative">
      <div className="max-w-[95%] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#596064] mb-2 font-body">
              <span className="hover:text-[#27619d] cursor-pointer">Admin Portal</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              <span className="text-[#2c3437] font-medium">User Management</span>
            </div>
            <h1 className="text-3xl font-extrabold text-[#2c3437] tracking-tight font-display">User Management</h1>
            <p className="text-[#596064] mt-1 font-body">Configure permissions and manage organizational access levels.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: users.length, extra: null },
            { label: 'Active (Approved)', value: users.filter(u => u.status === 'approved').length, extra: <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> },
            { label: 'Master Admins', value: users.filter(u => Array.isArray(u.role) ? u.role.includes('MasterAdmin') : u.role === 'MasterAdmin').length, extra: null },
            { label: 'Pending Requests', value: pendingCount, valueColor: pendingCount > 0 ? 'text-amber-600' : 'text-[#2c3437]', extra: null },
          ].map((s) => (
            <div key={s.label} className="bg-white/40 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm">
              <p className="text-xs font-bold text-[#596064] uppercase tracking-wider mb-1 font-body">{s.label}</p>
              <div className="flex items-end gap-2">
                <span className={`text-2xl font-extrabold font-display ${s.valueColor ?? 'text-[#2c3437]'}`}>{s.value}</span>
                {s.extra}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white/40 backdrop-blur-md border border-white/40 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
          <div className="p-6 border-b border-white/40 bg-white/20 flex flex-wrap gap-4 justify-between items-center">
            <div className="flex gap-2">
              {['All Users', 'Administrators', 'Pending Requests'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-body relative ${
                    activeTab === tab ? 'bg-[#27619d] text-[#f8f8ff]' : 'text-[#596064] hover:bg-white/60'
                  }`}
                >
                  {tab}
                  {tab === 'Pending Requests' && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[#596064] text-[11px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4 font-body">User Details</th>
                  <th className="px-6 py-4 font-body">Department</th>
                  <th className="px-6 py-4 font-body">Roles</th>
                  <th className="px-6 py-4 font-body">Status</th>
                  <th className="px-6 py-4 text-right font-body">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {filtered.map((u) => (
                  <tr key={u.email} className="group hover:bg-white/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img alt={u.firstName} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" src={u.photoURL} />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#c7e7ff] flex items-center justify-center text-[#27619d] font-black text-sm border-2 border-white shadow-sm">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                        )}
                        <div>
                          <p className="font-bold text-[#2c3437] text-sm font-body">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-[#596064] font-body">{u.email}</p>
                          <p className="text-[10px] text-slate-400 font-body">{u.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-[#596064] font-medium font-body">{u.department || 'Unassigned'}</span>
                    </td>
                    <td className="px-6 py-4 flex flex-wrap gap-1 max-w-[200px]">
                      {(Array.isArray(u.role) ? u.role : (u.role ? [u.role as unknown as string] : [])).map(r => (
                        <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-body ${
                          r === 'MasterAdmin' ? 'bg-indigo-100 text-indigo-700' : 
                          r === 'Staff' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                        }`}>{r}</span>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${u.status === 'approved' ? 'bg-emerald-500' : u.status === 'pending' ? 'bg-amber-400' : u.status === 'rejected' ? 'bg-red-500' : 'bg-slate-300'}`} />
                        <span className={`text-xs font-bold font-body ${u.status === 'approved' ? 'text-[#2c3437]' : u.status === 'pending' ? 'text-amber-600' : u.status === 'rejected' ? 'text-red-600' : 'text-slate-400'}`}>
                          {u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1) : 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="p-2 text-[#27619d] hover:bg-[#c7e7ff] rounded-lg transition-colors flex items-center gap-1 shadow-sm border border-transparent hover:border-[#27619d]/20 bg-white/50"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span className="text-xs font-bold">Edit</span>
                        </button>
                        <button 
                          onClick={() => setUserToDelete(u)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 shadow-sm border border-transparent hover:border-red-600/20 bg-white/50"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          <span className="text-xs font-bold">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-500 font-body">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-[fadeIn_0.2s_ease-out]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#27619D] font-display">Edit User Profile</h2>
              <button 
                onClick={() => setEditingUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm font-semibold">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                {editingUser.photoURL ? (
                  <img alt={editingUser.firstName} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md" src={editingUser.photoURL} />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#c7e7ff] flex items-center justify-center text-[#27619d] font-black text-xl border-2 border-white shadow-md">
                    {editingUser.firstName?.[0]}{editingUser.lastName?.[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{editingUser.firstName} {editingUser.lastName}</h3>
                  <p className="text-sm text-slate-500">{editingUser.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{editingUser.position}</p>
                </div>
              </div>

              <form id="edit-user-form" onSubmit={handleSaveUser} className="space-y-6">
                
                {/* Status Selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Account Status</label>
                  <div className="flex gap-3">
                    {['pending', 'approved', 'rejected'].map(s => (
                      <label key={s} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        editingUser.status === s 
                          ? s === 'approved' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                            : s === 'pending' ? 'border-amber-400 bg-amber-50 text-amber-700' 
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-500 bg-white'
                      }`}>
                        <input 
                          type="radio" 
                          name="status" 
                          className="sr-only" 
                          checked={editingUser.status === s}
                          onChange={() => setEditingUser({...editingUser, status: s as any})}
                        />
                        <span className="material-symbols-outlined mb-1">
                          {s === 'approved' ? 'check_circle' : s === 'pending' ? 'hourglass_empty' : 'cancel'}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Department */}
                  <div className="relative z-[10010]">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Department</label>
                    <select
                      value={editingUser.department || ''}
                      onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#27619D] appearance-none"
                    >
                      <option value="">Select Department...</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-[38px] text-slate-400 pointer-events-none">expand_more</span>
                  </div>

                  {/* Projects */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Assigned Projects (Comma Separated)</label>
                    <input
                      type="text"
                      value={editingUser.assignedProjects?.join(', ') || ''}
                      onChange={(e) => setEditingUser({...editingUser, assignedProjects: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#27619D]"
                      placeholder="e.g. ERP Migration, Security Audit"
                    />
                  </div>
                </div>

                {/* Roles Multi-select */}
                <div className="relative z-[10010]">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assigned Roles (Multi-select)</label>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    {ROLES.map(role => {
                      const hasRole = Array.isArray(editingUser.role) ? editingUser.role.includes(role) : editingUser.role === role;
                      return (
                      <label key={role} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          hasRole
                            ? 'bg-[#27619D] border-[#27619D]' 
                            : 'bg-white border-slate-300 group-hover:border-[#27619D]'
                        }`}>
                          {hasRole && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
                        </div>
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={hasRole}
                          onChange={(e) => {
                            let newRoles = Array.isArray(editingUser.role) ? [...editingUser.role] : (editingUser.role ? [editingUser.role as unknown as string] : []);
                            if (e.target.checked) {
                              if (!newRoles.includes(role)) newRoles.push(role);
                            } else {
                              newRoles = newRoles.filter(r => r !== role);
                            }
                            setEditingUser({...editingUser, role: newRoles as UserRole[]});
                          }}
                        />
                        <span className="text-sm font-medium text-slate-700">{role}</span>
                      </label>
                    )})}
                  </div>
                </div>

              </form>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="edit-user-form"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl font-bold bg-[#27619D] text-white hover:bg-[#1f4e7d] transition-colors disabled:opacity-70 flex items-center gap-2"
              >
                {isSaving ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center gap-4 text-red-600 mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-xl font-bold font-display">Delete User</h3>
            </div>
            
            <p className="text-slate-600 font-body mb-6">
              Are you sure you want to delete the user <strong className="text-slate-800">{userToDelete.firstName} {userToDelete.lastName}</strong> ({userToDelete.email})? 
              This action cannot be undone and will permanently remove their access to the system.
            </p>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {isDeleting ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;
