import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Check } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { loginWithEmail, loginWithGoogle, firebaseUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
    }
  }, [location.state]);

  useEffect(() => {
    if (firebaseUser && userProfile) {
      if (userProfile.status === 'approved') {
        navigate('/', { replace: true });
      } else if (userProfile.status === 'pending') {
        navigate('/pending', { replace: true });
      }
    }
  }, [firebaseUser, userProfile, navigate]);

  const redirectByStatus = (profile: { status: string }) => {
    if (profile.status === 'approved') {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } else if (profile.status === 'pending') {
      navigate('/pending', { replace: true });
    } else if (profile.status === 'rejected') {
      setError('Your account has been rejected.');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const profile = await loginWithEmail(email, password);
      redirectByStatus(profile);
    } catch (err: any) {
      const msg =
        err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
          : err.code === 'auth/user-not-found'
          ? 'ไม่พบบัญชีผู้ใช้นี้'
          : err.message || 'Failed to login';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const profile = await loginWithGoogle();
      if (profile) redirectByStatus(profile);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to login with Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-3xl font-semibold text-slate-800 mb-10 text-center lg:text-left">
        Sign in to your account
      </h2>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-base font-medium border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailLogin} className="space-y-6">
        <div className="relative">
          <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2">
            E-mail Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#2B8CEE] outline-none py-3 pr-8 text-slate-700 placeholder-slate-400 transition-colors text-base"
            placeholder="Enter your email"
          />
          {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
            <Check className="absolute right-0 bottom-4 w-5 h-5 text-[#2B8CEE]" strokeWidth={3} />
          )}
        </div>

        <div className="relative">
          <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#2B8CEE] outline-none py-3 pr-8 text-slate-700 placeholder-slate-400 transition-colors text-base"
            placeholder="Enter your password"
          />
          {password.length >= 6 && (
            <Check className="absolute right-0 bottom-4 w-5 h-5 text-[#2B8CEE]" strokeWidth={3} />
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-[#2B8CEE] text-white py-3.5 px-6 rounded-full font-semibold text-base hover:bg-[#1A6ED8] transition-colors shadow-lg shadow-blue-200/50 disabled:opacity-70"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
          <Link
            to="/register"
            className="flex-1 border border-slate-300 text-slate-600 py-3.5 px-6 rounded-full font-semibold text-base hover:bg-slate-50 transition-colors text-center flex items-center justify-center"
          >
            Sign up
          </Link>
        </div>
      </form>

      <div className="mt-6 text-center">
        <Link to="#" className="text-sm text-[#2B8CEE] hover:underline">
          Terms & Conditions
        </Link>
      </div>

      <div className="mt-8">
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-100"></div>
          <span className="flex-shrink-0 mx-4 text-sm text-slate-400">OR</span>
          <div className="flex-grow border-t border-slate-100"></div>
        </div>
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="mt-4 w-full flex items-center justify-center gap-2 border border-slate-200 rounded-full py-3 text-base font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>

      <div className="mt-6 text-center lg:hidden">
        <p className="text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-[#2B8CEE] font-semibold hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
