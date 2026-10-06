'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';

interface TierLimits {
  tier: number;
  name: string;
  maxUsers: number;
  maxRecruiters: number;
  maxActiveJobs: number;
  maxResumesPerMonth: number;
}

interface LicenseInfo {
  exists: boolean;
  licenseKey: string;
  tier: number;
  status?: string;
  partnerPlanName?: string;
  tierConfig: TierLimits;
  isLinked: boolean;
  organization?: {
    id: string;
    name: string;
    status: string;
  } | null;
}

function AppSumoActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  const [licenseKey, setLicenseKey] = useState<string>('');
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>('new');
  const [successData, setSuccessData] = useState<any>(null);

  // New account form state
  const [name, setName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Existing account form state
  const [existingEmail, setExistingEmail] = useState<string>('');
  const [existingPassword, setExistingPassword] = useState<string>('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    const keyFromUrl = searchParams.get('license_key') || searchParams.get('code') || '';
    const emailFromUrl = searchParams.get('email') || '';

    if (keyFromUrl) {
      setLicenseKey(keyFromUrl);
      fetchLicenseDetails(keyFromUrl);
    }
    if (emailFromUrl) {
      setEmail(emailFromUrl);
      setExistingEmail(emailFromUrl);
    }
  }, [searchParams]);

  const fetchLicenseDetails = async (key: string) => {
    if (!key.trim()) return;
    setIsValidatingKey(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${apiUrl}/v1/appsumo/license/${encodeURIComponent(key.trim())}`);
      if (!res.ok) {
        throw new Error('Could not verify license status');
      }
      const data = await res.json();
      setLicenseInfo(data);
    } catch (err: any) {
      console.warn('License status fetch error:', err);
      // Fallback display if license not yet synced or offline
      setLicenseInfo({
        exists: false,
        licenseKey: key,
        tier: 1,
        tierConfig: {
          tier: 1,
          name: 'AppSumo Tier 1 (Starter LTD)',
          maxUsers: 5,
          maxRecruiters: 5,
          maxActiveJobs: 25,
          maxResumesPerMonth: 1000
        },
        isLinked: false
      });
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleActivateNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setErrorMessage('Please enter your AppSumo license key.');
      return;
    }
    if (!email || !password) {
      setErrorMessage('Please provide work email and password.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${apiUrl}/v1/appsumo/activate-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: licenseKey.trim(),
          isExistingUser: false,
          name: name.trim(),
          companyName: companyName.trim() || `${name.trim() || 'User'}'s Workspace`,
          email: email.trim().toLowerCase(),
          password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to activate AppSumo license');
      }

      // Store JWT token for session
      if (typeof window !== 'undefined' && data.token) {
        localStorage.setItem('tasknera_token', data.token);
        localStorage.setItem('tasknera_email', data.user.email);
        localStorage.setItem('tasknera_name', data.user.name || '');
        localStorage.setItem('tasknera_role', data.user.role || 'CLIENT_ADMIN');
        localStorage.setItem('tasknera_user_id', data.user.id);
      }

      setSuccessData(data);
      setTimeout(() => {
        router.push('/admin');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during account activation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkExistingAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setErrorMessage('Please enter your AppSumo license key.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload: any = {
        licenseKey: licenseKey.trim(),
        isExistingUser: true
      };

      if (isAuthenticated && user?.id) {
        payload.userId = user.id;
      } else {
        if (!existingEmail || !existingPassword) {
          throw new Error('Please enter your existing TaskNera email and password.');
        }
        payload.email = existingEmail.trim().toLowerCase();
        payload.password = existingPassword;
      }

      const res = await fetch(`${apiUrl}/v1/appsumo/activate-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link AppSumo license to existing account');
      }

      if (typeof window !== 'undefined' && data.token) {
        localStorage.setItem('tasknera_token', data.token);
        localStorage.setItem('tasknera_email', data.user.email);
        localStorage.setItem('tasknera_name', data.user.name || '');
        localStorage.setItem('tasknera_role', data.user.role || 'CLIENT_ADMIN');
        localStorage.setItem('tasknera_user_id', data.user.id);
      }

      setSuccessData(data);
      setTimeout(() => {
        router.push(data.user.role === 'SUPER_ADMIN' ? '/super-admin' : '/admin');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to link account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Navigation Header */}
      <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-4 px-6 sm:px-12 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Logo href="/home" size="sm" variant="dark" />
          <span className="text-slate-500 text-sm font-semibold">|</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            AppSumo Partner Portal
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/signin" className="text-slate-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/home" className="text-amber-400 hover:text-amber-300 transition-colors">
            TaskNera Home →
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-[540px] bg-slate-800/90 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Top Gradient Banner */}
          <div className="h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-teal-400 w-full" />

          <div className="p-7 sm:p-9">
            {/* Success Celebration View */}
            {successData ? (
              <div className="text-center py-6 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg shadow-emerald-500/10">
                  ✓
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Welcome to TaskNera!
                </h2>
                <p className="text-emerald-400 font-semibold text-sm mt-1">
                  AppSumo Lifetime License Activated Successfully
                </p>
                <div className="my-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-700/60 text-left space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Organization:</span>
                    <span className="font-bold text-white">{successData.organization?.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Active Plan:</span>
                    <span className="font-bold text-amber-400">
                      AppSumo Tier {successData.license?.tier || 1} Lifetime
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Account:</span>
                    <span className="font-bold text-white">{successData.user?.email}</span>
                  </div>
                </div>
                <p className="text-slate-400 text-xs animate-pulse">
                  Redirecting to your recruitment dashboard...
                </p>
              </div>
            ) : (
              <>
                {/* Header Information */}
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black uppercase tracking-wider mb-3">
                    🚀 AppSumo Lifetime Deal Activation
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Activate Your TaskNera License
                  </h1>
                  <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                    Redeem your AppSumo code to unlock AI-powered recruitment, automated CV scoring, and candidate evaluations.
                  </p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                    <span className="text-rose-400 text-base leading-none">⚠️</span>
                    <span className="flex-1">{errorMessage}</span>
                  </div>
                )}

                {/* License Key Input & Status Card */}
                <div className="mb-6 p-4 rounded-2xl bg-slate-900/60 border border-slate-700/70">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    AppSumo License Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => {
                        setLicenseKey(e.target.value);
                        if (e.target.value.length > 8) {
                          fetchLicenseDetails(e.target.value);
                        }
                      }}
                      placeholder="e.g. SUMO-XXXX-XXXX-XXXX"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => fetchLicenseDetails(licenseKey)}
                      disabled={isValidatingKey || !licenseKey.trim()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 disabled:opacity-50 transition-colors"
                    >
                      {isValidatingKey ? '...' : 'Verify'}
                    </button>
                  </div>

                  {/* Detected Tier Feature Pills */}
                  {licenseInfo && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400">
                          Included LTD Quotas ({licenseInfo.tierConfig?.name || `Tier ${licenseInfo.tier}`}):
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          Tier {licenseInfo.tier}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300">
                          <span className="font-black text-amber-400">
                            {licenseInfo.tierConfig?.maxUsers || 5}
                          </span>{' '}
                          Team Seats
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300">
                          <span className="font-black text-amber-400">
                            {licenseInfo.tierConfig?.maxActiveJobs || 25}
                          </span>{' '}
                          Active Jobs
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300">
                          <span className="font-black text-teal-400">
                            {licenseInfo.tierConfig?.maxResumesPerMonth?.toLocaleString() || '1,000'}
                          </span>{' '}
                          AI Resumes/mo
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-300">
                          <span className="font-black text-teal-400">Lifetime</span> Access
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* If user is already logged in to TaskNera */}
                {isAuthenticated && user ? (
                  <div className="p-5 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                      <span className="text-xs font-bold text-teal-300">
                        Active TaskNera Session Detected
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      You are currently signed in as{' '}
                      <strong className="text-white">{user.name || user.email}</strong>. Would you like to link this AppSumo license to your current workspace?
                    </p>
                    <button
                      type="button"
                      onClick={handleLinkExistingAccount}
                      disabled={isSubmitting || !licenseKey.trim()}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Linking License...' : 'Activate & Link to My Workspace →'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Tabs for New vs Existing Account */}
                    <div className="flex rounded-xl bg-slate-900/90 p-1 mb-5 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('new');
                          setErrorMessage('');
                        }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                          activeTab === 'new'
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        I'm New to TaskNera
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('existing');
                          setErrorMessage('');
                        }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                          activeTab === 'existing'
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Existing TaskNera Account
                      </button>
                    </div>

                    {/* Form: New User Account Onboarding */}
                    {activeTab === 'new' ? (
                      <form onSubmit={handleActivateNewAccount} className="space-y-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Your Full Name
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Jane Doe"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Company or Organization Name
                          </label>
                          <input
                            type="text"
                            required
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="e.g. Acme Talent Labs"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Work Email
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="jane@company.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Create Password (min. 8 characters)
                          </label>
                          <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || !licenseKey.trim()}
                          className="w-full mt-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Creating Account & Activating...' : 'Create Workspace & Activate License →'}
                        </button>
                      </form>
                    ) : (
                      /* Form: Existing User Account Linking */
                      <form onSubmit={handleLinkExistingAccount} className="space-y-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            TaskNera Email Address
                          </label>
                          <input
                            type="email"
                            required
                            value={existingEmail}
                            onChange={(e) => setExistingEmail(e.target.value)}
                            placeholder="your.email@company.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            required
                            value={existingPassword}
                            onChange={(e) => setExistingPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || !licenseKey.trim()}
                          className="w-full mt-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Verifying & Linking...' : 'Sign In & Link License →'}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        TaskNera AI Recruitment Platform • Official AppSumo Licensing Partner Integration
      </footer>
    </div>
  );
}

export default function AppSumoActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-amber-400 font-bold text-sm">
          Loading AppSumo Activation Portal...
        </div>
      }
    >
      <AppSumoActivateContent />
    </Suspense>
  );
}
