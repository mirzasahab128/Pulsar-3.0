import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  ShieldCheck,
  Stethoscope,
  Building2,
  ClipboardList,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { submitAccessRequest } from '../services/api';
import '../styles/signin-gateway.css';

const PLAN_OPTIONS = [
  { id: 'trial', name: 'Trial', note: 'Evaluate Pulsar with core features' },
  { id: 'starter', name: 'Starter', note: 'For small teams getting started' },
  { id: 'growth', name: 'Growth', note: 'Full platform for scaling teams' }
] as const;

/**
 * Access Gateway — "sliding split-card" design.
 *
 * A deep-green hero panel slides left <-> right (0.65s ease-in-out) when the
 * user switches between Sign In and Request Access; the two form panels
 * cross-fade/slide on the opposite side. All behaviour (Firebase email
 * sign-in, remember-this-workstation persistence, password reset,
 * and the loss-proof access-request delivery) is unchanged — this file is a
 * presentation rebuild only. See src/styles/signin-gateway.css.
 */
export const SignInPage: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [requestedPlan, setRequestedPlan] = useState<string>('trial');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const switchMode = (next: 'signin' | 'signup' | 'forgot') => {
    setMode(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'forgot') {
        await resetPassword(email.trim());
        setSuccessMessage('Password reset link sent to your email. Please check your inbox.');
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (!organization.trim()) {
          throw new Error('Please enter your organization.');
        }
        if (!password || password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match. Please re-enter them.');
        }
        if (!termsAccepted) {
          throw new Error('Please accept the Terms of Service and Privacy Policy to request access.');
        }
        await signUpWithEmail(email.trim(), password, displayName.trim());
        // Deliver the request details (organization, requested plan, terms
        // acceptance) to the platform record. Never throws: if the API is
        // unreachable the details are stashed and retried on a later
        // sign-in, and the account itself already exists either way.
        await submitAccessRequest({
          organization: organization.trim(),
          requestedPlanId: requestedPlan,
          termsAcceptedAt: new Date().toISOString()
        });
        setSuccessMessage('Access requested — your account is now pending administrator approval. You can sign in at any time to check your status.');
      } else {
        if (!password) {
          throw new Error('Please enter your password.');
        }
        await signInWithEmail(email.trim(), password, rememberMe);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setErrorMessage('Invalid email or password. Please verify your credentials.');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email already exists. Please sign in instead.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use at least 8 characters.');
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in window closed before authentication finished.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Network connection error. Please check your internet connection.');
      } else {
        setErrorMessage(err?.message || 'Authentication failed. Please check your details and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const alerts = (
    <>
      {errorMessage && (
        <div role="alert" className="gw-alert gw-alert-error">
          <AlertCircle />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div role="status" className="gw-alert gw-alert-success">
          <CheckCircle2 />
          <span>{successMessage}</span>
        </div>
      )}
    </>
  );

  const panelFoot = (
    <div className="gw-panel-foot">
      <div className="gw-foot-line">
        <ShieldCheck />
        <span>Multi-tenant isolation &bull; Verified Firebase authentication</span>
      </div>
    </div>
  );

  const submitLabel = (label: string) => (
    isLoading ? (
      <>
        <span className="gw-spinner" />
        <span>Authenticating...</span>
      </>
    ) : (
      <>
        <span>{label}</span>
        <ArrowRight className="w-4 h-4" />
      </>
    )
  );

  return (
    <div className="gw-root">
      {/* Theme Switcher */}
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="gw-theme-btn"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-emerald-700" />}
      </button>

      <div className="gw-wrap">
        {/* Brand Header */}
        <div className="gw-brand">
          <div className="gw-brand-chip">
            <span className="gw-dot" />
            <span>Enterprise Workspace</span>
          </div>
          <div className="gw-brand-row">
            <div className="gw-brand-mark">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h1 className="gw-brand-name">Pulsar</h1>
          </div>
          <p className="gw-brand-tag">
            AI-Powered Business Development &amp; Revenue Intelligence
          </p>
        </div>

        {/* Sliding Split Card */}
        <div className="gw-card" data-mode={mode}>
          {/* Hero panel — slides left <-> right on mode switch */}
          <div className="gw-hero" aria-hidden={false}>
            <div className="gw-hero-stars" />
            <div className="gw-hero-moon" />
            <svg
              className="gw-hero-ridges"
              viewBox="0 0 600 500"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0,215 L110,150 L215,205 L330,130 L450,200 L600,140 L600,500 L0,500 Z" fill="#0d4a2a" opacity="0.55" />
              <path d="M0,300 L130,225 L265,290 L400,215 L600,285 L600,500 L0,500 Z" fill="#083018" opacity="0.8" />
              <path d="M0,395 L150,325 L320,395 L465,330 L600,385 L600,500 L0,500 Z" fill="#04170d" />
            </svg>

            <div className="gw-hero-brand">
              <span className="gw-hero-mark">
                <Stethoscope className="w-4.5 h-4.5" />
              </span>
              <span>Pulsar</span>
            </div>

            <div className="gw-hero-inner">
              <div className={`gw-hero-content ${mode !== 'signup' ? 'is-active' : ''}`}>
                <h2 className="gw-hero-title">Hello there</h2>
                <p className="gw-hero-text">
                  Begin your journey using Pulsar, and put revenue intelligence to work for your business.
                </p>
                <button
                  type="button"
                  className="gw-hero-btn"
                  onClick={() => switchMode('signup')}
                  tabIndex={mode !== 'signup' ? 0 : -1}
                >
                  Request Access
                </button>
              </div>

              <div className={`gw-hero-content ${mode === 'signup' ? 'is-active' : ''}`}>
                <h2 className="gw-hero-title">Welcome back</h2>
                <p className="gw-hero-text">
                  Login to review your latest pipeline, calls, and growth.
                </p>
                <button
                  type="button"
                  className="gw-hero-btn"
                  onClick={() => switchMode('signin')}
                  tabIndex={mode === 'signup' ? 0 : -1}
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>

          {/* Sign In / Forgot panel (left side) */}
          <section
            className="gw-panel gw-panel-signin"
            aria-hidden={mode === 'signup'}
            inert={mode === 'signup'}
          >
            {mode === 'forgot' ? (
              <form onSubmit={handleSubmit} className="gw-form" style={{ flex: '1 0 auto' }}>
                <div className="gw-form-grow">
                  <h2 className="gw-title">Reset Password</h2>
                  <p className="gw-subtitle">Enter your work email and we&rsquo;ll send a secure reset link.</p>

                  {alerts}

                  <div>
                    <label htmlFor="email" className="gw-label">Work Email</label>
                    <div className="gw-input-wrap">
                      <Mail className="gw-input-icon" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        required
                        disabled={isLoading}
                        className="gw-input"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading} className="gw-btn-primary">
                    {isLoading ? (
                      <>
                        <span className="gw-spinner" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <span>Send Password Reset Link</span>
                    )}
                  </button>

                  <p className="gw-switch-line">
                    Remembered it?{' '}
                    <button type="button" className="gw-link" onClick={() => switchMode('signin')}>
                      Back to Sign In
                    </button>
                  </p>
                </div>

                {panelFoot}
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="gw-form" style={{ flex: '1 0 auto' }}>
                <div className="gw-form-grow">
                  <h2 className="gw-title">Sign In</h2>
                  <p className="gw-subtitle">Sign in to your Pulsar workspace.</p>

                  {alerts}

                  <div>
                    <label htmlFor="email" className="gw-label">Work Email</label>
                    <div className="gw-input-wrap">
                      <Mail className="gw-input-icon" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        required
                        disabled={isLoading}
                        className="gw-input"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="gw-forgot-row">
                      <label htmlFor="password" className="gw-label">Password</label>
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="gw-link"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="gw-input-wrap">
                      <Lock className="gw-input-icon" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        disabled={isLoading}
                        className="gw-input"
                        style={{ paddingRight: '2.6rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="gw-eye-btn"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="gw-check gw-check-inline">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                    />
                    Remember this workstation
                  </label>

                  <button type="submit" disabled={isLoading} className="gw-btn-primary">
                    {submitLabel('Sign In')}
                  </button>

                  <p className="gw-switch-line">
                    New to Pulsar?{' '}
                    <button type="button" className="gw-link" onClick={() => switchMode('signup')}>
                      Request access
                    </button>
                  </p>
                </div>

                {panelFoot}
              </form>
            )}
          </section>

          {/* Request Access panel (right side) */}
          <section
            className="gw-panel gw-panel-signup"
            aria-hidden={mode !== 'signup'}
            inert={mode !== 'signup'}
          >
            <form onSubmit={handleSubmit} className="gw-form" style={{ flex: '1 0 auto' }}>
              <div className="gw-form-grow">
                <h2 className="gw-title">Request Access</h2>
                <p className="gw-subtitle">Request access for your organization.</p>

                {alerts}

                <div>
                  <label htmlFor="displayName" className="gw-label">Full Name / Title</label>
                  <div className="gw-input-wrap">
                    <UserIcon className="gw-input-icon" />
                    <input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Dr. Alex Vance, MD"
                      required
                      disabled={isLoading}
                      className="gw-input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email-signup" className="gw-label">Work Email</label>
                  <div className="gw-input-wrap">
                    <Mail className="gw-input-icon" />
                    <input
                      id="email-signup"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      disabled={isLoading}
                      className="gw-input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="organization" className="gw-label">Organization</label>
                  <div className="gw-input-wrap">
                    <Building2 className="gw-input-icon" />
                    <input
                      id="organization"
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. RevCycle Health System"
                      required
                      disabled={isLoading}
                      className="gw-input"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="requestedPlan" className="gw-label">Requested Plan</label>
                  <div className="gw-input-wrap">
                    <ClipboardList className="gw-input-icon" />
                    <select
                      id="requestedPlan"
                      value={requestedPlan}
                      onChange={(e) => setRequestedPlan(e.target.value)}
                      disabled={isLoading}
                      className="gw-input"
                    >
                      {PLAN_OPTIONS.map(p => (
                        <option key={p.id} value={p.id}>{p.name} — {p.note}</option>
                      ))}
                    </select>
                    <ChevronDown className="gw-select-chevron" />
                  </div>
                  <p className="gw-hint">An administrator reviews every request and confirms the plan at approval.</p>
                </div>

                <div>
                  <label htmlFor="password-signup" className="gw-label">Password</label>
                  <div className="gw-input-wrap">
                    <Lock className="gw-input-icon" />
                    <input
                      id="password-signup"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      className="gw-input"
                      style={{ paddingRight: '2.6rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="gw-eye-btn"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="gw-label">Confirm Password</label>
                  <div className="gw-input-wrap">
                    <Lock className="gw-input-icon" />
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      disabled={isLoading}
                      className="gw-input"
                    />
                  </div>
                  <p className="gw-hint">Min 8 characters. Use a strong, unique password.</p>
                </div>

                <label className="gw-check">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span>I accept the Terms of Service and Privacy Policy, and understand that accounts require administrator approval.</span>
                </label>

                <button type="submit" disabled={isLoading} className="gw-btn-primary">
                  {submitLabel('Submit Access Request')}
                </button>

                <p className="gw-switch-line">
                  Already have an account?{' '}
                  <button type="button" className="gw-link" onClick={() => switchMode('signin')}>
                    Sign in
                  </button>
                </p>
              </div>

              {panelFoot}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
