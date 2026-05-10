import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

export default function PendingApprovalPage() {
  const { userProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userProfile?.status === 'approved') {
      navigate('/');
    } else if (userProfile?.status === 'rejected') {
      navigate('/login');
    }
  }, [userProfile, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      <div className="fixed rounded-full filter blur-[80px] -z-10 opacity-40 bg-primary-fixed w-[500px] h-[500px] -top-32 -left-32 animate-[float_20s_infinite_ease-in-out]"></div>
      
      <div className="w-full max-w-md p-8 bg-surface/60 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl text-center">
        <span className="material-symbols-outlined text-[80px] text-primary mb-4 animate-pulse">hourglass_empty</span>
        <h1 className="text-3xl font-extrabold text-[#27619D] tracking-tighter font-display mb-4">Pending Approval</h1>
        <p className="text-slate-600 font-body mb-8">
          Your account is currently under review by an administrator. You will be able to access the system once approved.
        </p>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => refreshProfile()}
            className="w-full py-3 bg-[#27619D] text-white rounded-xl font-bold hover:bg-[#1f4e7d] transition-colors"
          >
            Check Status
          </button>
          <button 
            onClick={() => logout()}
            className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
