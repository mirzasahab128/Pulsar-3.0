import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Eye, 
  LogIn, 
  UserPlus, 
  CheckCircle2, 
  Lock, 
  Sparkles, 
  AlertCircle,
  KeyRound,
  Mail,
  User as UserIcon,
  Crown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../firebase';
import { Leap } from 'loading-dev';

export const AuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    authModalTab, 
    preferredRole, 
    closeAuthModal, 
    signInWithEmail, 
    signUpWithEmail, 
    setQuickProfile 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(authModalTab);
  const [selectedRole, setSelectedRole] = useState<UserRole>(preferredRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (activeTab === 'signin') {
        await signInWithEmail(email, password);
        setSuccessMessage('Signed in successfully!');
      } else {
        if (!displayName.trim()) {
          throw new Error('Please enter your full name or company name');
        }
        await signUpWithEmail(email, password, displayName);
        setSuccessMessage('Account created! Welcome to Pulsar.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      // Give clean, friendly guidance if Firebase Auth email/pass is not enabled in Firebase console
      if (err?.code === 'auth/operation-not-allowed' || err?.message?.includes('operation-not-allowed')) {
        setErrorMessage('Firebase Email/Password provider is not yet enabled in the Firebase console. Please contact your administrator.');
      } else if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setErrorMessage('Invalid credentials. Please verify your email and password.');
      } else if (err?.code === 'auth/email-already-in-use') {
        setErrorMessage('This email is already registered. Please sign in instead.');
      } else {
        setErrorMessage(err?.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoSwitch = (role: UserRole) => {
    setQuickProfile(role);
    closeAuthModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-emerald-500/10 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              selectedRole === 'admin' 
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' 
                : 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
            }`}>
              {selectedRole === 'admin' ? <Crown className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Pulsar Access Gateway
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                  selectedRole === 'admin' 
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                    : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                }`}>
                  {selectedRole === 'admin' ? 'Master Controller' : 'Customer Read-Only'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">Manage account access, roles, and profile permissions</p>
            </div>
          </div>
          <button 
            onClick={closeAuthModal}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              activeTab === 'signin'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setErrorMessage(null); }}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              activeTab === 'signup'
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Account
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Role Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Account Profile & Access Level:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Admin Card */}
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedRole === 'admin'
                    ? 'bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/20 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      Admin Profile
                    </span>
                    {selectedRole === 'admin' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    <strong>Master Controller:</strong> Full access to dialer, scrapers, lead edits, prompt engineering, and codebase controls.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-amber-400/80 font-mono">
                  <Sparkles className="w-3 h-3" />
                  Full Operational Control
                </div>
              </button>

              {/* Customer Card */}
              <button
                type="button"
                onClick={() => setSelectedRole('customer')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                  selectedRole === 'customer'
                    ? 'bg-sky-500/10 border-sky-500/50 ring-2 ring-sky-500/20 text-white'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-sky-400" />
                      Customer Profile
                    </span>
                    {selectedRole === 'customer' && (
                      <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    <strong>Read-Only Access:</strong> View-only permissions across leads, transcripts, metrics, and codebase inspection.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-sky-400/80 font-mono">
                  <Eye className="w-3 h-3" />
                  Strictly Read-Only Access
                </div>
              </button>
            </div>
          </div>

          {/* Quick 1-Click Fast Switch for Immediate Testing */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                1-Click Instant Profile Switch (Demo & Testing):
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoSwitch('admin')}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                Switch to Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoSwitch('customer')}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Switch to Customer (Read-Only)
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {activeTab === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name / Company Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Dr. Jordan Smith or Valley Cardiology"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white shadow-amber-600/20'
                  : 'bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white shadow-sky-600/20'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Leap size={24} color="#ffffff" />
                  <span>Processing...</span>
                </div>
              ) : (
                <span>
                  {activeTab === 'signin' 
                    ? `Sign In as ${selectedRole === 'admin' ? 'Master Controller' : 'Customer (Read-Only)'}`
                    : `Create ${selectedRole === 'admin' ? 'Master Controller' : 'Customer'} Account`}
                </span>
              )}
            </button>
          </form>

          {/* Access Matrix Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] space-y-1.5 font-mono">
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Permission Enforcement Status</div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Admin Profile:</span>
              <span className="text-emerald-400 font-bold">Unrestricted Master Control (R/W)</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Customer Profile:</span>
              <span className="text-sky-400 font-bold">Protected Read-Only Mode (RO)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
