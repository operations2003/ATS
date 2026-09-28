'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface MyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MyProfileModal: React.FC<MyProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, getUserPassword, updatePassword, logout } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Change password states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Reset internal states on open
  useEffect(() => {
    if (isOpen) {
      setShowPassword(false);
      setIsChangingPassword(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setChangeError('');
      setChangeSuccess('');
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const currentPassword = getUserPassword() || user.password || '';
  const username = user.email.includes('@') ? user.email.split('@')[0] : user.email;
  const isAdmin = user.role === 'ADMIN';

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2200);
    }
  };

  const handleCopyAll = () => {
    const credentialsSummary = `TaskNera ATS Credentials:\nUsername: ${username}\nEmail: ${user.email}\nPassword: ${currentPassword || '••••••••'}\nRole: ${isAdmin ? 'Administrator' : 'TA Recruiter Member'}`;
    copyToClipboard(credentialsSummary, 'all');
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    setChangeSuccess('');

    if (newPasswordInput.length < 8) {
      setChangeError('New password must be at least 8 characters long.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setChangeError('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePassword(newPasswordInput, currentPasswordInput || undefined);
      setChangeSuccess('Password updated successfully!');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setCurrentPasswordInput('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setChangeSuccess('');
      }, 2000);
    } catch (err: any) {
      setChangeError(err?.message || 'Failed to update password. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden z-10 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Top Header Banner */}
        <div className={`relative px-6 pt-6 pb-5 border-b border-slate-100 ${
          isAdmin
            ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 text-white'
            : 'bg-gradient-to-r from-brand-orange via-amber-600 to-orange-700 text-white'
        }`}>
          {/* Close X Button */}
          <button
            onClick={onClose}
            aria-label="Close Profile Modal"
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* User Profile Header Information */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/40 backdrop-blur-md text-white text-xl font-black flex items-center justify-center shadow-lg flex-shrink-0">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0 pr-8">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white truncate">
                  {user.name || username}
                </h2>
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-white/80 text-xs truncate mt-0.5">{user.email}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/20 text-white/95">
                  {isAdmin ? '👑 Administrator' : '👤 TA Team Member'}
                </span>
                <span className="text-white/70 text-[10px]">
                  TaskNera ATS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Main Credentials Card */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Access Credentials
                </h3>
              </div>
              
              {/* Copy All Button */}
              <button
                type="button"
                onClick={handleCopyAll}
                className="text-[11px] font-bold text-brand-orange hover:text-brand-orange-hover flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span>{copiedField === 'all' ? '✓ Copied All!' : 'Copy Credentials'}</span>
              </button>
            </div>

            {/* Username Row */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Username
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 select-all truncate">
                  {username}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(username, 'username')}
                  className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  title="Copy username"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copiedField === 'username' ? '✓ Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Email Address Row */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 select-all truncate">
                  {user.email}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(user.email, 'email')}
                  className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  title="Copy email address"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copiedField === 'email' ? '✓ Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Password Row */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {currentPassword ? 'Stored securely in session' : 'Password protected'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-800 select-all truncate pr-10">
                    {currentPassword
                      ? (showPassword ? currentPassword : '••••••••••••••••')
                      : '••••••••••••••••'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(currentPassword, 'password')}
                  disabled={!currentPassword}
                  className="px-3 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  title="Copy password"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copiedField === 'password' ? '✓ Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Toggle Change Password Form */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsChangingPassword(v => !v)}
                className="text-xs font-bold text-slate-600 hover:text-brand-orange flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{isChangingPassword ? '− Cancel Password Change' : '+ Change / Update Password'}</span>
              </button>
            </div>

            {/* Change Password Collapsible Section */}
            {isChangingPassword && (
              <form onSubmit={handlePasswordUpdate} className="pt-3 border-t border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                {changeError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{changeError}</span>
                  </div>
                )}

                {changeSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{changeSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    New Password (minimum 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPasswordInput}
                      onChange={e => setNewPasswordInput(e.target.value)}
                      placeholder="Enter new strong password"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showNewPassword ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPasswordInput}
                    onChange={e => setConfirmPasswordInput(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-xl shadow-orange transition-all cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {isSubmitting ? 'Saving...' : 'Save New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Account Details & Role Permissions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                System Role
              </span>
              <span className="block text-xs font-extrabold text-slate-800 mt-0.5">
                {isAdmin ? 'System Administrator' : 'Talent Acquisition Member'}
              </span>
              <span className="block text-[10px] text-slate-500 mt-1">
                {isAdmin ? 'Full governance, evaluation reviews, member provisioning' : 'Candidate evaluations, CV upload & job management'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Organization Pod
              </span>
              <span className="block text-xs font-extrabold text-slate-800 mt-0.5">
                {user.teamName || 'TaskNera Talent Pod'}
              </span>
              <span className="block text-[10px] text-slate-500 mt-1">
                Enterprise ATS & Screening Pipeline
              </span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="px-4 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Profile
          </button>
        </div>

      </div>
    </div>
  );
};

export default MyProfileModal;
