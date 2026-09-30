'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('Recruiter');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate enterprise access request routing
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-100 flex flex-col justify-between selection:bg-brand-orange selection:text-white">
      {/* Top Navigation Bar */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 py-4 px-6 sm:px-12 flex items-center justify-between sticky top-0 z-20">
        <Logo href="/home" size="sm" variant="dark" />
        <div className="flex items-center gap-4">
          <Link
            href="/signin"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Already have an account? <span className="text-brand-orange font-bold">Sign In</span>
          </Link>
          <Link
            href="/home"
            className="text-xs font-bold text-slate-700 hover:text-brand-orange transition-colors flex items-center gap-1.5"
          >
            <span>←</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 sm:my-10">
        <div className="w-full max-w-[480px] bg-white border border-slate-200/90 rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden transition-all">
          {/* Top Brand Accent Line */}
          <div className="h-1.5 bg-gradient-to-r from-brand-orange via-amber-500 to-[#00D2B4] w-full" />

          <div className="p-7 sm:p-9">
            {isSubmitted ? (
              /* Success State */
              <div className="text-center py-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-3xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                  Request Dispatched
                </div>

                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                  Access Request Received
                </h2>

                <p className="text-slate-600 text-xs leading-relaxed max-w-sm mx-auto mb-6">
                  Your request for <strong className="font-bold text-slate-900">{workEmail}</strong> has been routed to your organization administrator (<strong className="font-semibold text-slate-800">admin@gmail.com</strong>). You will receive an invitation email once approved.
                </p>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left text-xs text-slate-600 space-y-2 mb-6">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                    Next Steps:
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Admin verifies your corporate email and organization role.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>An invitation link with temporary credentials is sent to your inbox.</span>
                  </div>
                </div>

                <Link
                  href="/signin"
                  className="w-full py-3 px-4 bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-orange hover:shadow-orange-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Return to Sign In Portal</span>
                  <span>→</span>
                </Link>
              </div>
            ) : (
              /* Request Access Form */
              <>
                {/* Header Badge & Title */}
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                    Enterprise Onboarding
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    Request Workspace Access
                  </h1>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                    HireIQ accounts are provisioned under enterprise governance. Submit your details to join your team workspace.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Corporate Email */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Work Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        required
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all font-medium"
                      />
                    </div>
                  </div>

                  {/* Organization & Role Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Company / Org
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="TaskNera / Client Corp"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Role
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all font-medium"
                      >
                        <option value="Recruiter">Recruiter / Sourcer</option>
                        <option value="TA Lead">Talent Acquisition Lead</option>
                        <option value="Hiring Manager">Hiring Manager</option>
                        <option value="HR Operations">HR & Operations</option>
                        <option value="Executive">Executive / Director</option>
                      </select>
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Request Reason <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Need access to Q3 Engineering hiring campaigns"
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/20 focus:border-brand-orange transition-all font-medium"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-orange hover:shadow-orange-lg cursor-pointer flex items-center justify-center gap-2 mt-3"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Workspace Request</span>
                        <span className="text-base font-bold leading-none">→</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Bottom Card Footer */}
                <div className="mt-7 pt-6 border-t border-slate-100 flex flex-col items-center gap-3">
                  <p className="text-xs text-slate-500 text-center">
                    Already provisioned with credentials?{' '}
                    <Link
                      href="/signin"
                      className="font-bold text-brand-orange hover:text-brand-orange-hover hover:underline transition-colors"
                    >
                      Sign In here
                    </Link>
                  </p>

                  {/* Security Indicator */}
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Enterprise RBAC Protected • SOC-2 Type II Architecture</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Corporate Page Footer */}
      <footer className="w-full py-4 px-6 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white/50">
        © {new Date().getFullYear()} HireIQ by TaskNera. Enterprise Recruitment Intelligence Platform.
      </footer>
    </div>
  );
}
