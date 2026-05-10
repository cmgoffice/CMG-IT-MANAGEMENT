import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Layout = () => {
  const { userProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Self Profile Update State
  const [showUpdateProfile, setShowUpdateProfile] = useState(false);
  const [updateData, setUpdateData] = useState({ firstName: '', lastName: '', position: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: 'dashboard' },
    { to: '/asset', label: 'Asset', icon: 'inventory' },
    { to: '/equipment', label: 'Equipment', icon: 'devices' },
    { to: '/forms', label: 'IT Forms', icon: 'description' },
    { to: '/logs', label: 'Logs', icon: 'receipt_long' },
  ];

  const isMasterAdmin = Array.isArray(userProfile?.role) 
    ? userProfile.role.includes('MasterAdmin')
    : userProfile?.role === 'MasterAdmin';

  useEffect(() => {
    if (isMasterAdmin) {
      const q = query(collection(db, 'CMG-IT-MANAGEMENT/root/users'), where('status', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPendingCount(snapshot.size);
      });
      return unsubscribe;
    }
  }, [isMasterAdmin]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openUpdateProfile = () => {
    setShowProfileMenu(false);
    if (userProfile) {
      setUpdateData({
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        position: userProfile.position || '',
      });
    }
    setShowUpdateProfile(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'CMG-IT-MANAGEMENT/root/users', userProfile.email);
      await updateDoc(userRef, {
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        position: updateData.position,
      });
      await refreshProfile();
      setShowUpdateProfile(false);
    } catch (error) {
      console.error('Failed to update profile', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="text-on-surface min-h-screen relative overflow-hidden">
      {/* Background Shapes */}
      <div className="fixed inset-0 bg-background -z-20"></div>
      <div className="fixed rounded-full filter blur-[80px] -z-10 opacity-40 bg-primary-fixed w-[500px] h-[500px] -top-64 -left-64 animate-[float_20s_infinite_ease-in-out]"></div>
      <div className="fixed rounded-full filter blur-[80px] -z-10 opacity-40 bg-secondary-container w-[400px] h-[400px] bottom-0 -right-32 animate-[float_30s_infinite_ease-in-out_reverse]"></div>
      <div className="fixed rounded-full filter blur-[80px] -z-10 opacity-40 bg-tertiary-container w-[300px] h-[300px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[float_20s_infinite_ease-in-out]" style={{ animationDelay: '-5s' }}></div>

      {/* Top Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-[#F7F9FB]/60 backdrop-blur-xl border-b border-white/20 shadow-sm h-[85px] flex justify-between items-center px-10">
        <div className="text-3xl font-extrabold text-[#27619D] tracking-tighter font-display">CMG IT Management</div>
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `font-bold font-display tracking-tight transition-all px-5 py-2 rounded-lg whitespace-nowrap text-lg ${
                  isActive
                    ? 'bg-[#27619D] text-white shadow-md shadow-[#27619D]/30'
                    : 'text-slate-500 hover:bg-[#C7E7FF]/50'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-6 relative">
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-[#C7E7FF]/50 p-3 rounded-full transition-colors text-[30px]">notifications</span>
          <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:bg-[#C7E7FF]/50 p-3 rounded-full transition-colors text-[30px]">settings</span>
          <div className="relative">
            <img
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-12 h-12 rounded-full border-2 border-primary-container object-cover cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              src={userProfile?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"}
              alt="Profile"
            />
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 border border-slate-100 z-[10000]">
                <button 
                  onClick={openUpdateProfile}
                  className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">person</span>
                  Update Profile
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-error hover:bg-error-container/20 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-xl">logout</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Sidebar (Desktop) */}
      <aside className="h-screen w-[260px] fixed left-0 top-0 pt-[85px] bg-surface/40 backdrop-blur-md border-r border-white/20 flex flex-col justify-between py-10 hidden lg:flex z-40">
        <div>
          <div className="px-8 mb-8 mt-6">
            {/* User Profile Card */}
            <div className="bg-white/60 backdrop-blur-sm border border-white/40 p-4 rounded-2xl shadow-sm mb-6 flex flex-col items-center text-center">
              <img
                className="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover mb-3"
                src={userProfile?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop"}
                alt="Profile"
              />
              <div className="text-lg font-bold text-slate-800 font-display leading-tight">{userProfile?.firstName} {userProfile?.lastName}</div>
              <div className="text-sm text-slate-500 font-body mt-1">
                {Array.isArray(userProfile?.role) ? userProfile.role.map((r: string) => (
                  <span key={r} className="inline-block bg-[#C7E7FF] text-[#27619D] px-2 py-0.5 rounded-full text-xs mr-1 font-semibold">{r}</span>
                )) : userProfile?.role && (
                  <span className="inline-block bg-[#C7E7FF] text-[#27619D] px-2 py-0.5 rounded-full text-xs mr-1 font-semibold">{userProfile.role as unknown as string}</span>
                )}
              </div>
            </div>

            <div className="text-base uppercase tracking-widest text-outline mb-1 font-body">Management Console</div>
            <div className="text-lg font-semibold text-on-surface font-display">IT Department</div>
          </div>
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-8 py-4 flex items-center gap-4 transition-all font-body text-lg ${
                    isActive
                      ? 'bg-[#C7E7FF]/80 backdrop-blur-sm text-[#27619D] rounded-r-full font-semibold'
                      : 'text-slate-600 hover:bg-[#EAEFF2]/50'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[30px]">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Bottom Menu for MasterAdmin */}
        {isMasterAdmin && (
          <div className="px-4 space-y-2">
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `px-4 py-3 flex items-center justify-between transition-all font-body text-base rounded-xl ${
                  isActive
                    ? 'bg-[#27619D] text-white font-semibold shadow-md'
                    : 'bg-white/50 text-slate-700 hover:bg-white/80 border border-white/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
                User Management
              </div>
              {pendingCount > 0 && (
                <span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {pendingCount}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/form-backend"
              className={({ isActive }) =>
                `px-4 py-3 flex items-center gap-3 transition-all font-body text-base rounded-xl ${
                  isActive
                    ? 'bg-[#27619D] text-white font-semibold shadow-md'
                    : 'bg-white/50 text-slate-700 hover:bg-white/80 border border-white/60'
                }`
              }
            >
              <span className="material-symbols-outlined text-[24px]">table_view</span>
              Form Backend
            </NavLink>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="lg:pl-[260px] pt-[85px] min-h-screen pb-[85px] lg:pb-0 relative z-10">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-[#F7F9FB]/60 backdrop-blur-xl border-t border-white/20 flex justify-around items-center h-[85px] z-50 px-2 overflow-x-auto gap-6">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1.5 min-w-[67px] ${
                isActive ? 'text-primary' : 'text-slate-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex items-center justify-center w-14 h-8 rounded-full transition-all ${isActive ? 'bg-[#C7E7FF] text-[#27619D]' : ''}`}>
                  <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {link.icon}
                  </span>
                </div>
                <span className={`text-[12px] font-body ${isActive ? 'font-bold text-[#27619D]' : ''}`}>{link.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      <button className="fixed bottom-[104px] right-10 w-[74px] h-[74px] bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 duration-150 z-40 lg:bottom-12 lg:hidden">
        <span className="material-symbols-outlined text-[30px]">add</span>
      </button>

      {/* Update Profile Modal */}
      {showUpdateProfile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10010] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-[fadeIn_0.2s_ease-out]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#27619D] font-display">Update Profile</h2>
              <button 
                onClick={() => setShowUpdateProfile(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={updateData.firstName}
                  onChange={(e) => setUpdateData({...updateData, firstName: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#27619D]"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={updateData.lastName}
                  onChange={(e) => setUpdateData({...updateData, lastName: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#27619D]"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Position</label>
                <input
                  type="text"
                  value={updateData.position}
                  onChange={(e) => setUpdateData({...updateData, position: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#27619D]"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowUpdateProfile(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-2.5 rounded-xl font-bold bg-[#27619D] text-white hover:bg-[#1f4e7d] transition-colors disabled:opacity-70 flex items-center gap-2"
                >
                  {isUpdating ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
