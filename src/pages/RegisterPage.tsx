import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Check } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { registerWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError('Please agree to the terms and conditions');
      return;
    }
    setIsLoading(true);
    setError('');

    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '-';

    try {
      await registerWithEmail(email, password, firstName, lastName, 'Staff');
      navigate('/login', { state: { message: 'Registration successful. Please login.' } });
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-3xl font-semibold text-slate-800 mb-8 text-center lg:text-left">
        Create your account
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg text-base font-medium border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-5">
        <div className="relative">
          <label className="block text-[13px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#2B8CEE] outline-none py-3 pr-8 text-slate-700 placeholder-slate-400 transition-colors text-base"
            placeholder="Enter your name"
          />
          {name.trim().length >= 2 && (
            <Check className="absolute right-0 bottom-4 w-5 h-5 text-[#2B8CEE]" strokeWidth={3} />
          )}
        </div>

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
            minLength={6}
            className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#2B8CEE] outline-none py-3 pr-8 text-slate-700 placeholder-slate-400 transition-colors text-base"
            placeholder="Enter your password"
          />
          {password.length >= 6 && (
            <Check className="absolute right-0 bottom-4 w-5 h-5 text-[#2B8CEE]" strokeWidth={3} />
          )}
        </div>

        <label className="flex items-center gap-2 text-base text-slate-600 pt-1">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            required
            className="rounded border-slate-300 text-[#2B8CEE] focus:ring-[#2B8CEE] w-5 h-5"
          />
          <span>
            I Agree to{' '}
            <Link to="#" className="text-[#2B8CEE] hover:underline">
              Terms & Conditions
            </Link>
          </span>
        </label>

        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-[#2B8CEE] text-white py-3.5 px-6 rounded-full font-semibold text-base hover:bg-[#1A6ED8] transition-colors shadow-lg shadow-blue-200/50 disabled:opacity-70"
          >
            {isLoading ? 'Creating...' : 'Sign up'}
          </button>
          <Link
            to="/login"
            className="flex-1 border border-slate-300 text-slate-600 py-3.5 px-6 rounded-full font-semibold text-base hover:bg-slate-50 transition-colors text-center flex items-center justify-center"
          >
            Sign in
          </Link>
        </div>
      </form>

      <div className="mt-6 text-center">
        <Link to="#" className="text-sm text-[#2B8CEE] hover:underline">
          Terms & Conditions
        </Link>
      </div>

      <div className="mt-6 text-center lg:hidden">
        <p className="text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-[#2B8CEE] font-semibold hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
