import React, { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

interface PasswordGateProps {
  configuredPassword: string;
  onUnlock: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({
  configuredPassword,
  onUnlock,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = passwordInput.trim();

    if (!entered) {
      setError('Please enter the access password.');
      return;
    }

    if (entered === configuredPassword.trim()) {
      setError(null);
      if (rememberDevice) {
        localStorage.setItem('quota_ember_unlocked', 'true');
      } else {
        sessionStorage.setItem('quota_ember_unlocked', 'true');
      }
      onUnlock();
    } else {
      setError('Incorrect password. Please verify and try again.');
      setPasswordInput('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0A09] text-[#E7E5E4] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#D4F268] selection:text-[#0C0A09] relative overflow-hidden">
      {/* 4% Fixed Noise Overlay */}
      <div className="noise-overlay" aria-hidden="true" />

      {/* Decorative ambient background glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#D4F268]/5 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="card-panel-deep bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-8 sm:p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.9)] space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[11px] font-mono text-[#A8A29E]">
              <span className="w-2 h-2 rounded-full bg-[#D4F268] shadow-[0_0_8px_#D4F268] animate-pulse" />
              <span className="text-[#E7E5E4]">Fig. 00 • Protected Terminal</span>
            </div>

            <div className="w-14 h-14 mx-auto rounded-full bg-[#141210] border border-[#D4F268]/30 flex items-center justify-center text-[#D4F268] shadow-[0_0_20px_rgba(212,242,104,0.15)]">
              <Lock className="w-6 h-6" />
            </div>

            <h1 className="text-3xl font-serif font-light tracking-tight text-[#E7E5E4]">
              Quota Ember <em>Access</em>
            </h1>
            <p className="text-xs text-[#A8A29E] font-sans max-w-xs mx-auto leading-relaxed">
              This terminal is private. Enter your master password to unlock the quota monitor.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.25)] text-[#fca5a5] text-xs font-mono flex items-center gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#f87171]" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="gate-password"
                className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5"
              >
                Access Password
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#78716C]">
                  <KeyRound className="w-4 h-4" />
                </div>

                <input
                  id="gate-password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl pl-10 pr-10 py-2.5 text-sm font-mono outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
                  placeholder="Enter passcode..."
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#78716C] hover:text-[#E7E5E4] transition-colors cursor-pointer border-0 bg-transparent"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <label className="flex items-center gap-2 cursor-pointer text-[#A8A29E] hover:text-[#E7E5E4] select-none">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#141210] border-[rgba(255,255,255,0.2)] text-[#D4F268] accent-[#D4F268] focus:ring-0 cursor-pointer"
                />
                <span>Remember this device</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full btn-primary-lime py-3 rounded-full text-sm font-sans font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_16px_rgba(212,242,104,0.2)] hover:shadow-[0_0_24px_rgba(212,242,104,0.3)] transition-all"
            >
              <span>Unlock Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Notice */}
          <div className="pt-2 border-t border-[rgba(255,255,255,0.08)] text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#78716C]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4F268]" />
              <span>Configured via .env • Local verification</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
