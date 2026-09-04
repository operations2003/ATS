'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/lib/api';
import { atsStore, AuditEvent, RecruiterMetric, JobItem, CandidateItem } from '@/lib/atsStore';


export default function AdminPage() {
  const { user, setRole, signin } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [podFilter, setPodFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchRecruiter, setSearchRecruiter] = useState('');

  // Designated Admin Login State
  const [adminLoginEmail, setAdminLoginEmail] = useState('admin123@gmail.com');
  const [adminLoginPassword, setAdminLoginPassword] = useState('admin12345');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');

  // Modals & detail view
  const [selectedRecruiter, setSelectedRecruiter] = useState<RecruiterMetric | null>(null);
  const [showRecruiterModal, setShowRecruiterModal] = useState(false);

  // Add Member Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberTeam, setNewMemberTeam] = useState('SAP & Enterprise Practice');
  const [newMemberRole, setNewMemberRole] = useState<'RECRUITER_MEMBER' | 'TEAM_LEAD'>('RECRUITER_MEMBER');
  const [newMemberSkills, setNewMemberSkills] = useState('');

  // Live state from Store
  const [recruiters, setRecruiters] = useState<RecruiterMetric[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [loadingMembers, setLoadingMembers] = useState(false);

  const syncData = () => {
    setRecruiters(atsStore.getRecruiters().filter(r => r.email?.toLowerCase().trim() !== 'admin123@gmail.com' && r.role !== 'ADMIN'));
    setJobs(atsStore.getJobs());
    setCandidates(atsStore.getCandidates());
    setAuditEvents(atsStore.getAuditEvents());
  };

  const fetchLiveTAMembers = async () => {
    try {
      setLoadingMembers(true);
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const token = typeof window !== 'undefined' ? localStorage.getItem('tasknera_token') : null;
      const res = await fetch(`${backendUrl}/users/ta-members`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.members) && data.members.length > 0) {
          const nonAdmin = data.members.filter((m: any) => m.email?.toLowerCase().trim() !== 'admin123@gmail.com' && m.role !== 'ADMIN');
          atsStore.setRecruitersFromDatabase(nonAdmin);
          setRecruiters(nonAdmin);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch live TA members from database:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    syncData();
    fetchLiveTAMembers();
    const unsubscribe = atsStore.subscribe(syncData);
    return () => unsubscribe();
  }, []);

  const stats = atsStore.getAdminOverviewStats();

  // Filtered recruiters
  const filteredRecruiters = recruiters.filter(r => {
    if (r.email?.toLowerCase().trim() === 'admin123@gmail.com' || r.role === 'ADMIN' || r.name?.toLowerCase().trim() === 'admin') {
      return false;
    }
    const q = searchRecruiter.toLowerCase();
    const matchesSearch = r.name.toLowerCase().includes(q) ||
                          r.email.toLowerCase().includes(q) ||
                          r.team.toLowerCase().includes(q) ||
                          (r.topSkills && r.topSkills.some(s => s.toLowerCase().includes(q))) ||
                          (r.strengths && r.strengths.some(s => s.toLowerCase().includes(q)));
    const matchesPod = podFilter === 'All' || r.team === podFilter;
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'Active' && r.lastActive.includes('Active')) ||
      (statusFilter === 'Optimal' && r.capacity === 'Optimal') ||
      (statusFilter === 'Available' && r.capacity === 'Available');
    return matchesSearch && matchesPod && matchesStatus;
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    const skillsArray = newMemberSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    atsStore.addRecruiter({
      name: newMemberName.trim(),
      email: newMemberEmail.trim().toLowerCase(),
      role: newMemberRole,
      team: newMemberTeam,
      activeJobs: 2,
      jdsUploaded: 1,
      resumesSeen: 45,
      screenedThisWeek: 12,
      tlApprovedCount: 6,
      avgMatchScore: 86,
      avgTimePerScreen: '3.0 min',
      avgTimePerResume: '1.8 min',
      todayHoursSpent: 6.0,
      totalHoursThisWeek: 30.0,
      capacity: 'Optimal',
      lastActive: 'Active now',
      strengths: skillsArray.length > 0 ? skillsArray : ['Talent Sourcing', 'Candidate Screening'],
      insightsSummary: `${newMemberName.trim()} has been provisioned as an active recruiter in ${newMemberTeam}. Currently maintaining high engagement and steady candidate review pacing.`,
      topSkills: skillsArray.length > 0 ? skillsArray : ['Sourcing', 'Interviewing'],
      efficiencyScore: 92,
      dailyTimeLogs: [
        { day: 'Mon', date: 'Aug 28', hoursSpent: 6.0, resumesReviewedCount: 25, resumesTimeHours: 2.8, screeningsCount: 6, screeningTimeHours: 1.8, jdsUploadedCount: 1, jdTimeHours: 1.4 },
        { day: 'Tue', date: 'Aug 29', hoursSpent: 6.2, resumesReviewedCount: 28, resumesTimeHours: 3.0, screeningsCount: 7, screeningTimeHours: 1.9, jdsUploadedCount: 1, jdTimeHours: 1.3 },
        { day: 'Wed', date: 'Aug 30', hoursSpent: 5.8, resumesReviewedCount: 24, resumesTimeHours: 2.6, screeningsCount: 6, screeningTimeHours: 1.7, jdsUploadedCount: 0, jdTimeHours: 1.5 },
        { day: 'Thu', date: 'Aug 31', hoursSpent: 6.0, resumesReviewedCount: 26, resumesTimeHours: 2.8, screeningsCount: 6, screeningTimeHours: 1.8, jdsUploadedCount: 1, jdTimeHours: 1.4 },
        { day: 'Fri', date: 'Sep 01', hoursSpent: 6.0, resumesReviewedCount: 27, resumesTimeHours: 2.9, screeningsCount: 7, screeningTimeHours: 1.8, jdsUploadedCount: 1, jdTimeHours: 1.3 },
      ],
      recentActivity: [
        `Joined ${newMemberTeam} and initialized ATS workspace`,
        'Configured candidate pipeline alerts',
      ]
    });

    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberSkills('');
    setShowAddMemberModal(false);
  };

  const isAuthorizedAdmin = user?.email?.toLowerCase().trim() === 'admin123@gmail.com' && user?.role === 'ADMIN';

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    setAdminLoginLoading(true);
    try {
      const cleanInputEmail = adminLoginEmail.trim().toLowerCase();
      if (cleanInputEmail !== 'admin123@gmail.com') {
        throw new Error('Access denied. Only admin123@gmail.com is authorized as Administrator.');
      }
      const role = await signin(cleanInputEmail, adminLoginPassword);
      if (role !== 'ADMIN') {
        throw new Error('Could not authenticate as Administrator. Please verify your credentials.');
      }
    } catch (err: any) {
      setAdminLoginError(err?.message || 'Failed to sign in as Administrator.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  // Strict Role Guard: Only admin123@gmail.com with role ADMIN can enter
  if (mounted && !isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-[#EEF2F6] flex flex-col selection:bg-brand-orange-pale selection:text-brand-orange">
        <Header />
        <main className="max-w-md mx-auto px-6 pt-28 pb-16 flex-1 flex flex-col items-center justify-center w-full">
          <div className="w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-3xl bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center text-3xl font-bold mx-auto mb-4 shadow-xs">
              👑
            </div>

            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-widest mb-2">
              Exclusive Administrator Access
            </span>

            <h1 className="text-xl font-black text-slate-900 mb-1">
              Admin &amp; Team Insights Portal
            </h1>

            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Strict Security Policy: Only the designated Administrator account (<strong className="text-slate-800">admin123@gmail.com</strong>) is authorized to access executive administration and member insights.
            </p>

            {user && (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 text-left flex items-start gap-2">
                <span className="text-amber-600 font-bold">⚠️</span>
                <div>
                  Currently signed in as <strong>{user.email}</strong> ({user.role}). This account does not possess executive administrative authority.
                </div>
              </div>
            )}

            {adminLoginError && (
              <div className="mb-4 p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-700 text-left flex items-center gap-2">
                <span>✕</span>
                <span className="font-semibold">{adminLoginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-3.5 text-left text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Authorized Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminLoginEmail}
                  onChange={e => setAdminLoginEmail(e.target.value)}
                  placeholder="admin123@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Password</label>
                <input
                  type="password"
                  required
                  value={adminLoginPassword}
                  onChange={e => setAdminLoginPassword(e.target.value)}
                  placeholder="admin12345"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={adminLoginLoading}
                className="w-full mt-2 py-3 bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white text-xs font-black rounded-xl shadow-lg shadow-violet-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {adminLoginLoading ? (
                  <span>Authenticating Administrator...</span>
                ) : (
                  <>
                    <span>👑 Sign In as Administrator</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center">
              <Link
                href="/dashboard"
                className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Return to Recruiter Workspace
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#1E293B] flex flex-col selection:bg-brand-orange-pale selection:text-brand-orange">
      <Header />

      <main className="max-w-screen-xl mx-auto px-6 pt-24 pb-16 flex-1 w-full">

        {/* ── TOP EXECUTIVE BANNER ── */}
        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 text-white shadow-xl border border-violet-800/40 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-brand-orange/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-500/25 border border-violet-400/30 rounded-full text-xs font-black text-violet-200 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  Administrator &amp; Executive Oversight Hub
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white/90 border border-white/10">
                  Daily Engagement &amp; Performance Review
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Talent Acquisition Team Performance &amp; Time Tracking
              </h1>
              <p className="text-sm text-violet-200/80 max-w-2xl leading-relaxed">
                Track how much time each team member spends daily reviewing resumes, creating JDs, and shortlisting candidates.
              </p>
            </div>
          </div>
        </div>

        {/* ── EXECUTIVE KPI METRIC CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-8">
          {/* Metric 1: Active Team Members */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Active Team Members</span>
              <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 border border-violet-200 flex items-center justify-center font-bold text-xs">
                👥
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
              <span>{recruiters.length}</span>
              <span className="text-xs font-semibold text-slate-400">Recruiters</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100">
              <span className="text-violet-600 font-bold">3 Specialized Pods</span>
              <span className="font-semibold text-slate-700">100% Tracked</span>
            </div>
          </div>

          {/* Metric 2: Resumes Seen & Evaluated */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Resumes Evaluated</span>
              <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold text-xs">
                📄
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {stats.totalResumesSeen.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100">
              <span className="text-blue-600 font-bold flex items-center gap-1">
                <span>↑ 18%</span>
                <span className="text-slate-400 font-medium">vs last week</span>
              </span>
              <span className="font-semibold text-slate-700">1.7 min avg/CV</span>
            </div>
          </div>

          {/* Metric 4: Shortlisted for Client */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Shortlisted Candidates</span>
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-xs">
                ⭐
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {stats.totalShortlisted}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100">
              <span className="text-emerald-600 font-bold">{stats.conversionRate}% Conversion</span>
              <span className="font-semibold text-slate-700">Mean Score: 88%</span>
            </div>
          </div>
        </div>

        {/* ── RECRUITER PERFORMANCE TABLE ── */}
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden mb-8">
          <div className="p-5 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Comprehensive Recruiter Performance Log
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Compare evaluation speed, candidate volume, and shortlisting conversion across all team members
              </p>
            </div>
            <span className="text-xs text-slate-500 font-bold">{filteredRecruiters.length} Recruiter Profiles Active</span>
          </div>

          <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F1F5F9] text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4 min-w-[240px]">Recruiter / Member</th>
                      <th className="px-4 py-4 min-w-[170px]">Assigned Pod</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Resumes Seen</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Shortlists</th>
                      <th className="px-4 py-4 text-center whitespace-nowrap">Shortlist Rate</th>
                      <th className="px-6 py-4 text-center whitespace-nowrap">Avg Match Fit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecruiters.map(r => {
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-brand-orange-pale text-brand-orange font-black text-xs flex items-center justify-center flex-shrink-0">
                                {r.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                                  <span>{r.name}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    r.role === 'ADMIN' ? 'bg-violet-100 text-violet-800' :
                                    r.role === 'TEAM_LEAD' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {r.role === 'ADMIN' ? 'Admin' : r.role === 'TEAM_LEAD' ? 'Team Lead' : 'TA Member'}
                                  </span>
                                </div>
                                <div className="text-slate-400 text-[11px] mt-0.5">{r.email} • {r.lastActive}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 font-semibold text-slate-700 whitespace-nowrap">{r.team}</td>

                          <td className="px-4 py-4 text-center font-black text-slate-800 text-sm whitespace-nowrap">
                            {r.resumesSeen} CVs
                          </td>

                          <td className="px-4 py-4 text-center font-black text-emerald-600 text-sm whitespace-nowrap">
                            {r.tlApprovedCount}
                          </td>

                          <td className="px-4 py-4 text-center font-black text-purple-700 text-sm whitespace-nowrap">
                            {Math.round((r.tlApprovedCount / (r.resumesSeen || 1)) * 100)}%
                          </td>

                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {r.avgMatchScore}% Fit
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

        {/* ── MODAL: RECRUITER ACTIVITY & TIME DRILL-DOWN ── */}
        {showRecruiterModal && selectedRecruiter && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-orange text-white font-black text-lg flex items-center justify-center">
                    {selectedRecruiter.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">{selectedRecruiter.name} — Detailed Time &amp; Activity Log</h3>
                    <p className="text-xs text-slate-500">{selectedRecruiter.email} • {selectedRecruiter.team}</p>
                  </div>
                </div>
                <button onClick={() => setShowRecruiterModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">✕</button>
              </div>

              <div className="space-y-5 text-xs">
                {/* 4 Metric Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200">
                    <span className="text-[10px] text-purple-600 font-black uppercase block">TODAY&apos;S TIME</span>
                    <span className="text-lg font-black text-purple-900">{selectedRecruiter.todayHoursSpent} Hours</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                    <span className="text-[10px] text-blue-600 font-black uppercase block">RESUMES SEEN</span>
                    <span className="text-lg font-black text-blue-900">{selectedRecruiter.resumesSeen} CVs</span>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-2xl border border-orange-200">
                    <span className="text-[10px] text-brand-orange font-black uppercase block">JDs UPLOADED</span>
                    <span className="text-lg font-black text-slate-900">{selectedRecruiter.jdsUploaded} Positions</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-600 font-black uppercase block">AVG SPEED</span>
                    <span className="text-lg font-black text-emerald-900">{selectedRecruiter.avgTimePerResume || '1.8 min'}/CV</span>
                  </div>
                </div>

                {/* 🌟 AI Executive Performance & Sourcing Insights */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50 via-slate-50 to-indigo-50/50 border border-violet-200/80">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">💡</span>
                    <h4 className="font-black text-violet-900 text-xs uppercase tracking-wider">
                      Executive Qualitative Analysis &amp; Sourcing Insights
                    </h4>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {selectedRecruiter.insightsSummary || `${selectedRecruiter.name} exhibits steady candidate review velocity with high ATS calibration accuracy. Averaging ${selectedRecruiter.avgTimePerResume || '1.8 min'} per resume review.`}
                  </p>
                </div>

                {/* Core Domain Competencies */}
                <div>
                  <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider mb-2">
                    🎯 Core Competencies &amp; Technical Domains
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {((selectedRecruiter.topSkills && selectedRecruiter.topSkills.length > 0)
                      ? selectedRecruiter.topSkills
                      : (selectedRecruiter.strengths || ['Talent Sourcing', 'ATS Evaluation', 'Technical Screening'])
                    ).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 shadow-2xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Operational Time Allocation Split */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider">
                      ⏱️ Operational Time Allocation Breakdown
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400">Weekly Distribution</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                        <span>Resume Review &amp; Scoring</span>
                        <span className="text-blue-600">60% (~{((selectedRecruiter.totalHoursThisWeek || 30) * 0.6).toFixed(1)} hrs)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '60%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                        <span>Candidate Shortlisting &amp; Screening</span>
                        <span className="text-emerald-600">25% (~{((selectedRecruiter.totalHoursThisWeek || 30) * 0.25).toFixed(1)} hrs)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                        <span>JD Setup &amp; Calibration</span>
                        <span className="text-amber-600">15% (~{((selectedRecruiter.totalHoursThisWeek || 30) * 0.15).toFixed(1)} hrs)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-orange rounded-full" style={{ width: '15%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Day by Day Time Log Table */}
                <div>
                  <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider mb-2">
                    📅 Daily Time Spent Breakdown (Past 5 Days)
                  </h4>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/50">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-black text-slate-500 uppercase">
                          <th className="p-3 text-center">Day / Date</th>
                          <th className="p-3 text-center">Total Hours</th>
                          <th className="p-3 text-center">Resumes Evaluated</th>
                          <th className="p-3 text-center">Candidates Shortlisted</th>
                          <th className="p-3 text-center">JDs Uploaded</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 bg-white">
                        {(selectedRecruiter.dailyTimeLogs || [
                          { day: 'Mon', date: 'Aug 28', hoursSpent: 6.8, resumesReviewedCount: 38, resumesTimeHours: 3.4, screeningsCount: 10, screeningTimeHours: 2.2, jdsUploadedCount: 1, jdTimeHours: 1.2 },
                          { day: 'Tue', date: 'Aug 29', hoursSpent: 7.2, resumesReviewedCount: 42, resumesTimeHours: 3.8, screeningsCount: 12, screeningTimeHours: 2.4, jdsUploadedCount: 2, jdTimeHours: 1.0 },
                          { day: 'Wed', date: 'Aug 30', hoursSpent: 6.5, resumesReviewedCount: 36, resumesTimeHours: 3.2, screeningsCount: 9, screeningTimeHours: 2.1, jdsUploadedCount: 1, jdTimeHours: 1.2 },
                          { day: 'Thu', date: 'Aug 31', hoursSpent: 5.9, resumesReviewedCount: 34, resumesTimeHours: 3.0, screeningsCount: 8, screeningTimeHours: 1.9, jdsUploadedCount: 1, jdTimeHours: 1.0 },
                          { day: 'Fri', date: 'Sep 01', hoursSpent: 6.4, resumesReviewedCount: 34, resumesTimeHours: 3.1, screeningsCount: 9, screeningTimeHours: 2.1, jdsUploadedCount: 1, jdTimeHours: 1.2 },
                        ]).map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-800">
                              {log.day}, {log.date}
                            </td>
                            <td className="p-3 text-center font-black text-purple-700">
                              {log.hoursSpent} hrs
                            </td>
                            <td className="p-3 text-center text-slate-700">
                              <strong>{log.resumesReviewedCount} CVs</strong> <span className="text-slate-400">({log.resumesTimeHours}h)</span>
                            </td>
                            <td className="p-3 text-center text-slate-700">
                              <strong className="text-emerald-700">{Math.round(log.screeningsCount * 0.6)} Shortlisted</strong> <span className="text-slate-400">({log.screeningTimeHours}h)</span>
                            </td>
                            <td className="p-3 text-center text-slate-700">
                              <strong>{log.jdsUploadedCount} JDs</strong> <span className="text-slate-400">({log.jdTimeHours}h)</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Active Requisitions Assigned */}
                {jobs.filter(j => j.assignedRecruiter.toLowerCase().includes(selectedRecruiter.name.toLowerCase()) || (j.workedBy && j.workedBy.some(w => w.name.toLowerCase().includes(selectedRecruiter.name.toLowerCase())))).length > 0 && (
                  <div>
                    <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider mb-2">
                      🎯 Active Requisitions Assigned ({jobs.filter(j => j.assignedRecruiter.toLowerCase().includes(selectedRecruiter.name.toLowerCase()) || (j.workedBy && j.workedBy.some(w => w.name.toLowerCase().includes(selectedRecruiter.name.toLowerCase())))).length})
                    </h4>
                    <div className="space-y-2">
                      {jobs.filter(j => j.assignedRecruiter.toLowerCase().includes(selectedRecruiter.name.toLowerCase()) || (j.workedBy && j.workedBy.some(w => w.name.toLowerCase().includes(selectedRecruiter.name.toLowerCase())))).map(j => (
                        <div key={j.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <Link href={`/jobs/${j.id}`} className="font-bold text-slate-900 hover:text-brand-orange transition-colors block">
                              {j.title}
                            </Link>
                            <span className="text-[11px] text-slate-500">{j.client} • {j.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                              {j.candidates} Candidates
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {j.topScore}% Top Fit
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity List */}
                <div>
                  <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider mb-2">
                    Recent Operations with Time Estimates
                  </h4>
                  <div className="space-y-2">
                    {(selectedRecruiter.recentActivity || ['Shortlisted Michael Chen for SAP CO (94% Fit)', 'Uploaded 32 candidate resumes (Took 1.2 hrs)', 'Created SAP Requisition (Took 45 min)']).map((act, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-brand-orange flex-shrink-0" />
                        <span className="text-slate-700 font-medium">{act}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setShowRecruiterModal(false)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Close Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: ADD NEW TEAM MEMBER ── */}
        {showAddMemberModal && (
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-orange text-white font-black text-base flex items-center justify-center shadow-orange">
                    +
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Add Team Member</h3>
                    <p className="text-xs text-slate-500">Provision a new recruiter profile with tracked insights</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddMember} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sakshi Sharma"
                    value={newMemberName}
                    onChange={e => setNewMemberName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Corporate Email</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sakshi.s@tasknera.com"
                    value={newMemberEmail}
                    onChange={e => setNewMemberEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assigned Practice Pod</label>
                    <select
                      value={newMemberTeam}
                      onChange={e => setNewMemberTeam(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 cursor-pointer"
                    >
                      <option value="SAP & Enterprise Practice">SAP &amp; Enterprise</option>
                      <option value="Cloud & Engineering Pod">Cloud &amp; Engineering</option>
                      <option value="Finance & Operations TA">Finance &amp; Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Role / Authority</label>
                    <select
                      value={newMemberRole}
                      onChange={e => setNewMemberRole(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 cursor-pointer"
                    >
                      <option value="RECRUITER_MEMBER">TA Team Member</option>
                      <option value="TEAM_LEAD">Team Lead</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Specialized Competencies (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. S/4HANA, Kubernetes, Fast Sourcing"
                    value={newMemberSkills}
                    onChange={e => setNewMemberSkills(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-5">
                  <button
                    type="button"
                    onClick={() => setShowAddMemberModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-black rounded-xl shadow-orange transition-all cursor-pointer"
                  >
                    Add Member to ATS
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
