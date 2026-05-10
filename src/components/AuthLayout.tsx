import type { ReactNode } from 'react';
import { Send } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import hero from '../assets/hero.png';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const location = useLocation();
  const isRegister = location.pathname === '/register';

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-6 lg:p-10 font-body overflow-hidden bg-gradient-to-br from-[#eaf3ff] via-white to-[#f2e9ff]">
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[#2B8CEE]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#7C3AED]/20 blur-3xl" />

      <img
        src={hero}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 w-[520px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 opacity-20"
      />

      <div className="relative">
        {/* Decorative tech images around modal border */}
        <div className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full bg-[#2B8CEE]/25 blur-3xl z-0" />
        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -left-12 w-44 h-44 opacity-90 rotate-12 object-contain z-0 drop-shadow-lg"
        />
        <div className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 rounded-full bg-[#7C3AED]/25 blur-3xl z-0" />
        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-12 -right-12 w-44 h-44 opacity-90 -rotate-12 object-contain z-0 drop-shadow-lg"
        />

        <div className="w-[80vw] max-w-none rounded-3xl overflow-hidden shadow-2xl border border-white/60 bg-white/80 backdrop-blur relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Left / Top Panel - Blue */}
            <div className="hidden lg:flex relative w-full flex-col items-center justify-center p-10 text-white overflow-hidden bg-gradient-to-b from-[#2B8CEE] to-[#1A6ED8]">
              {/* Wave transition for desktop */}
              <svg
                className="absolute top-0 right-[-1px] h-full w-12 pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path d="M0,0 C60,5 60,95 0,100 L100,100 L100,0 Z" fill="#ffffff" />
              </svg>

              {/* Content */}
              <div className="z-10 flex flex-col items-center text-center max-w-xs">
                <p className="text-sm font-medium tracking-wide mb-6">Welcome to</p>

                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-5 shadow-xl">
                  <Send className="w-12 h-12 text-[#2B8CEE] -rotate-12" />
                </div>

                <h1 className="text-4xl font-bold mb-5 font-display tracking-tight">CMG IT</h1>

                <p className="text-sm text-white/80 leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
              </div>

              {/* Bottom links - desktop only */}
              <div className="hidden lg:flex absolute bottom-10 left-0 right-0 justify-center items-center gap-4 text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase z-10">
                <Link
                  to="/login"
                  className={`hover:text-white transition-colors ${!isRegister ? 'text-white' : ''}`}
                >
                  Customer Login
                </Link>
                <span className="text-white/50">•</span>
                <Link
                  to="/register"
                  className={`hover:text-white transition-colors ${isRegister ? 'text-white' : ''}`}
                >
                  Business Login
                </Link>
              </div>
            </div>

            {/* Right / Bottom Panel - White */}
            <div className="w-full flex items-center justify-center p-6 lg:p-12 bg-transparent">
              <div className="w-full max-w-sm">
                <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2B8CEE] to-[#7C3AED] flex items-center justify-center shadow-lg">
                    <Send className="w-6 h-6 text-white -rotate-12" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-slate-500">Welcome to</div>
                    <div className="text-xl font-bold text-slate-800 font-display">CMG IT</div>
                  </div>
                </div>

                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
