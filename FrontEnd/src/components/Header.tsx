'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import Logo from './Logo';

const Header: React.FC = () => {
  const [scrolled, setScrolled]         = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [authOpen, setAuthOpen]         = useState(false);
  const [authMode, setAuthMode]         = useState<'signin' | 'signup'>('signin');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname   = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const currentRole = user?.role || 'RECRUITER_MEMBER';

  const isAdmin = currentRole === 'ADMIN';

  // Clean navigation labels with dedicated SVG icons
  const nav = isAdmin
    ? [
        { label: 'Admin Hub', href: '/admin', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { label: 'Requisitions', href: '/jobs', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
        { label: 'Candidate Pool', href: '/candidates', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
      ]
    : [
        { label: 'My Workspace', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { label: 'My Requisitions', href: '/jobs', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
        { label: 'Post Job', href: '/jobs/create', icon: 'M12 4v16m8-8H4' },
        { label: 'Candidate Pool', href: '/candidates', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
      ];

  const active = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    if (href !== '/' && pathname.startsWith(href + '/')) {
      const hasMoreSpecificMatch = nav.some(
        other =>
          other.href !== href &&
          other.href.length > href.length &&
          (pathname === other.href || pathname.startsWith(other.href + '/'))
      );
      return !hasMoreSpecificMatch;
    }
    return false;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = () => {
      setDropdownOpen(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, []);

  const isAuth = isAuthenticated && user;
  const navBg = 'bg-white/95 backdrop-blur-xl';
  const navBorder = 'border-slate-200/80';
  const shadow = scrolled ? 'shadow-[0_4px_20px_rgba(30,41,59,0.06)]' : '';

  return (
    <>
      <nav className={`fixed top-0 w-full z-[150] transition-all duration-300 ${navBg} border-b ${navBorder} ${shadow}`}>
        <div className="max-w-screen-xl mx-auto px-6 h-[64px] flex items-center justify-between gap-3">

          {/* Logo */}
          <div className="flex-shrink-0">
            <Logo
              href={isAuth ? (isAdmin ? '/admin' : '/dashboard') : '/home'}
              size="sm"
              variant="dark"
            />
          </div>

          {/* Nav links - Clean alignment without overflow bar */}
          {isAuth && (
            <div className="hidden lg:flex items-center justify-center gap-1.5 flex-1 px-2">
              {nav.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    active(item.href)
                      ? (isAdmin ? 'bg-violet-600 text-white shadow-sm' : 'bg-brand-orange text-white shadow-orange')
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-2.5 flex-shrink-0">
            {isAuth ? (
              <>
                {/* Profile Dropdown */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setDropdownOpen(v => !v)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className={`w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      isAdmin ? 'bg-violet-600' : 'bg-brand-orange'
                    }`}>
                      {(user.name || user.email)[0].toUpperCase()}
                    </div>
                    <div className="text-left leading-none">
                      <span className="text-xs font-bold text-slate-800 block max-w-[110px] truncate">
                        {user.name || user.email.split('@')[0]}
                      </span>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                        isAdmin ? 'text-violet-600' : 'text-brand-orange'
                      }`}>
                        {isAdmin ? 'Admin' : 'TA Member'}
                      </span>
                    </div>
                    <svg className={`w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1 z-[200]">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                        <p className="text-xs font-bold text-slate-800 truncate">{user.name || 'User'}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                          isAdmin
                            ? 'bg-violet-50 text-violet-700 border-violet-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isAdmin ? '👑 Administrator (Reviewer)' : '👤 TA Team Member'}
                        </span>
                      </div>

                      <button
                        onClick={() => { setDropdownOpen(false); logout(); }}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Sign Out / Switch Account</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-brand-orange transition-colors cursor-pointer">
                  Sign In
                </button>
                <button onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}
                  className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-xl transition-all shadow-orange hover:shadow-orange-lg cursor-pointer">
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 rounded-lg transition-colors text-slate-700 hover:bg-slate-100"
            onClick={() => setMobileOpen(v => !v)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t px-4 py-3 space-y-1 bg-white/95 backdrop-blur-md border-slate-200/90 shadow-xl">
            {isAuth && nav.map(item => (
              <Link key={item.href} href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  active(item.href)
                    ? (isAdmin ? 'bg-violet-600 text-white' : 'bg-brand-orange text-white shadow-orange')
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}

            <div className="border-t border-slate-100 pt-3 mt-2 space-y-2">
              {isAuth ? (
                <button onClick={() => { setMobileOpen(false); logout(); }}
                  className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out / Switch Account</span>
                </button>
              ) : (
                <>
                  <button onClick={() => { setMobileOpen(false); setAuthMode('signin'); setAuthOpen(true); }}
                    className="block w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                    Sign In
                  </button>
                  <button onClick={() => { setMobileOpen(false); setAuthMode('signup'); setAuthOpen(true); }}
                    className="block w-full text-center px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white rounded-xl text-xs font-bold shadow-orange transition-all cursor-pointer">
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </>
  );
};

export default Header;
