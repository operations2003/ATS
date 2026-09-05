'use client';

import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Brand Header */}
      <header className="w-full bg-white border-b border-slate-200/80 py-4 px-6 sm:px-12 flex items-center justify-between">
        <Logo href="/home" size="sm" variant="dark" />
        <Link
          href="/home"
          className="text-xs font-bold text-slate-600 hover:text-brand-orange transition-colors"
        >
          ← Back to Homepage
        </Link>
      </header>

      {/* Center Restricted Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="h-1.5 bg-brand-orange w-full" />

          <div className="p-7 sm:p-8 text-center">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-2xs">
              🔒
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest mb-2">
              Registration Restricted
            </span>

            <h1 className="text-xl font-black text-slate-900 tracking-tight mb-2">
              Account Creation is Restricted
            </h1>

            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              In accordance with enterprise security governance, self-registration is disabled. All team member accounts are provisioned exclusively by system administrators.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left mb-6 space-y-3">
              <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                How to get access:
              </h2>
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>Contact your organization administrator to create your team profile.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>Receive your authorized login credentials and temporary password.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-brand-orange/10 text-brand-orange text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>Use the official Sign In portal to log in to your ATS workspace.</span>
              </div>
            </div>

            <Link
              href="/signin"
              className="w-full py-3 px-4 bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-xs rounded-xl transition-all shadow-orange hover:shadow-orange-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              Sign In to Your Account →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer Note */}
      <footer className="w-full py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} TaskNera. People. Processes. Performance.
      </footer>
    </div>
  );
}
