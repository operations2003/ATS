'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import { computeComprehensiveMatchScore } from '@/utils/requirementUtils';

interface JobItem {
  id: string;
  title: string;
  client: string;
  location: string;
  mode: string;
  candidates: number;
  topScore: number | null;
  status: string;
  created?: string;
}

interface CandidateEvaluationItem {
  id: string;
  name: string;
  role: string;
  match: number;
  decision: string;
  time: string;
  jobId?: string;
}

const scoreColor = (n: number | null) => {
  if (n === null || n === undefined) return 'text-slate-400';
  return n >= 80 ? 'text-emerald-600' : n >= 65 ? 'text-amber-500' : 'text-rose-500';
};

function getEffectiveSkills(candidate: any, jobReqs?: any[]): string[] {
  const matched = new Set<string>();
  if (Array.isArray(candidate.skills)) {
    for (const s of candidate.skills) {
      if (typeof s === 'string' && s.trim()) matched.add(s.trim());
    }
  }
  const text = (candidate.rawText || candidate.summary || candidate.professionalSummary || '').toLowerCase();
  if (jobReqs && jobReqs.length > 0) {
    for (const r of jobReqs) {
      const phrase = (r.requirement || r.text || '').trim();
      if (phrase.length > 2) {
        const clean = phrase.replace(/(\d+\+?\s*years?|experience|minimum|required|hands-on|relevant|professional|industry|proven|in|with|of|for|and|to)/gi, ' ').trim();
        const tokens = clean.split(/[\s,;/()\[\]{}*+?^$|\\]+/).filter((t: string) => t.length > 2);
        for (const tok of tokens) {
          if (tok.length >= 3) {
            try {
              const escTok = tok.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
              if (new RegExp(`(?:^|[^a-zA-Z0-9_])${escTok}(?:[^a-zA-Z0-9_]|$)`, 'i').test(text)) {
                matched.add(tok);
              }
            } catch (err) {}
          }
        }
      }
    }
  }
  return Array.from(matched);
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [recentEvaluations, setRecentEvaluations] = useState<CandidateEvaluationItem[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real jobs and candidate evaluations for the authenticated user
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setIsLoading(true);
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('tasknera_token') : null);
        const headers: Record<string, string> = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};

        // 1. Fetch user's JDs from API
        let apiJobs: any[] = [];
        try {
          const resJobs = await fetch(`${backendUrl}/jobs`, { headers });
          if (resJobs.ok) {
            const data = await resJobs.json();
            apiJobs = Array.isArray(data.jobs) ? data.jobs : (Array.isArray(data.data) ? data.data : []);
          }
        } catch (e) {
          console.warn('[Dashboard] Jobs fetch error:', e);
        }

        // 2. Fetch user's local created jobs as client-side fallback
        let localCreated: any[] = [];
        if (typeof window !== 'undefined') {
          try {
            const raw = JSON.parse(localStorage.getItem('tasknera_created_jobs') || '[]');
            const currentUserId = user?.id;
            const currentUserEmail = user?.email?.toLowerCase();
            const isAdmin = user?.role === 'ADMIN';

            localCreated = (Array.isArray(raw) ? raw : []).filter((j: any) => {
              if (isAdmin) return true;
              if (!currentUserId && !currentUserEmail) return false;
              const jUserId = j.created_by || j.createdBy;
              const jEmail = (j.creatorEmail || j.email || '').toLowerCase();
              return (currentUserId && jUserId === currentUserId) || (currentUserEmail && jEmail === currentUserEmail);
            });
          } catch {}
        }

        // Merge API + local jobs
        const jobMap = new Map<string, any>();
        for (const j of apiJobs) jobMap.set(String(j.id), j);
        for (const lj of localCreated) {
          if (!jobMap.has(String(lj.id))) jobMap.set(String(lj.id), lj);
        }

        const mergedJobs: JobItem[] = Array.from(jobMap.values()).map((j: any) => {
          const rawStatus = (j.status || 'Active').toLowerCase();
          const normalizedStatus = rawStatus === 'draft' ? 'Draft' : rawStatus === 'closed' ? 'Closed' : 'Active';
          const rawMode = (j.work_mode || j.workMode || 'Remote').trim();
          const normalizedMode = rawMode.charAt(0).toUpperCase() + rawMode.slice(1).toLowerCase();

          // Calculate candidate count
          let count = typeof j.candidatesCount === 'number' ? j.candidatesCount : (typeof j.candidates === 'number' ? j.candidates : (Array.isArray(j.candidates) ? j.candidates.length : 0));
          if (typeof window !== 'undefined') {
            try {
              const localCands = JSON.parse(localStorage.getItem(`tasknera_candidates_${j.id}`) || '[]');
              if (Array.isArray(localCands) && localCands.length > count) count = localCands.length;
            } catch {}
          }

          return {
            id: String(j.id),
            title: j.position || j.title || 'Untitled Position',
            client: j.client || j.company || 'Direct Client',
            location: j.location || 'Remote',
            mode: ['Remote', 'Hybrid', 'Onsite'].includes(normalizedMode) ? normalizedMode : 'Remote',
            candidates: count,
            topScore: typeof j.topScore === 'number' ? j.topScore : null,
            status: normalizedStatus,
            created: j.created_at ? new Date(j.created_at).toLocaleDateString() : 'Recent'
          };
        });

        // 3. Fetch candidate evaluations and scores across user's active jobs
        let evals: CandidateEvaluationItem[] = [];

        // 3a. First check direct /evaluations API
        try {
          const evalUrl = user?.role === 'ADMIN' ? `${backendUrl}/evaluations?view=all` : `${backendUrl}/evaluations`;
          const resEval = await fetch(evalUrl, { headers });
          if (resEval.ok) {
            const evalData = await resEval.json();
            const evalList = evalData.evaluations || evalData.data || [];
            if (Array.isArray(evalList) && evalList.length > 0) {
              for (const e of evalList) {
                const rawVal = e.score ?? e.atsScore ?? e.ats ?? e.match;
                if (typeof rawVal === 'number' && rawVal > 0) {
                  const score = Math.round(rawVal);
                  const isSubmit = e.decision === 'SUBMIT' || e.decision === 'ACCEPT' || e.decision === 'REVIEW' || score >= 65;
                  const candId = String(e.candidateId || e.id || '');
                  const candName = String(e.candidate || e.name || '').trim().toLowerCase();

                  const existingIdx = evals.findIndex(ex =>
                    (candId && ex.id === candId) ||
                    (candName && ex.name && ex.name.trim().toLowerCase() === candName)
                  );

                  const evalItem: CandidateEvaluationItem = {
                    id: candId || `eval-${evals.length + 1}`,
                    name: e.candidate || e.name || 'Candidate',
                    role: e.role || e.job || 'Applicant',
                    match: score,
                    decision: isSubmit ? 'SUBMIT' : 'DO NOT SUBMIT',
                    time: e.date || 'Recently',
                    jobId: e.jobId
                  };

                  if (existingIdx >= 0) {
                    evals[existingIdx] = evalItem;
                  } else {
                    evals.push(evalItem);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('[Dashboard] Evaluations fetch error:', e);
        }

        // 3b. Fetch candidates for each job that has applicants to compute real ATS scores
        for (const j of mergedJobs) {
          if (j.candidates > 0) {
            try {
              let jobCands: any[] = [];
              if (typeof window !== 'undefined') {
                try {
                  jobCands = JSON.parse(localStorage.getItem(`tasknera_candidates_${j.id}`) || '[]');
                } catch {}
              }

              try {
                const res = await fetch(`${backendUrl}/jobs/${j.id}/candidates`, { headers });
                if (res.ok) {
                  const data = await res.json();
                  const apiCands = Array.isArray(data.candidates) ? data.candidates : [];
                  if (apiCands.length > 0) {
                    jobCands = apiCands;
                  }
                }
              } catch (e) {
                console.warn(`[Dashboard] Could not fetch candidates for job ${j.id}:`, e);
              }

              if (Array.isArray(jobCands) && jobCands.length > 0) {
                const rawJob = jobMap.get(j.id) || {};
                const reqs = rawJob.requirements || [];

                let maxJobScore = j.topScore;

                for (const c of jobCands) {
                  let score: number | null = null;
                  if (typeof c.matchScore === 'number' && c.matchScore > 0) {
                    score = Math.round(c.matchScore);
                  } else if (typeof c.atsScore === 'number' && c.atsScore > 0) {
                    score = Math.round(c.atsScore);
                  }

                  // Only compute fallback score if candidate has no evaluated score from backend
                  if (score === null || score === 0) {
                    try {
                      const effectiveSkills = getEffectiveSkills(c, reqs);
                      const comp = computeComprehensiveMatchScore(
                        {
                          skills: effectiveSkills.length > 0 ? effectiveSkills : (Array.isArray(c.skills) ? c.skills : []),
                          totalExperience: c.totalExperience || c.totalExperienceYears,
                          totalExperienceYears: c.totalExperienceYears,
                          education: c.education || [],
                          rawText: c.rawText || '',
                          summary: c.summary || c.professionalSummary || '',
                          currentTitle: c.currentTitle || '',
                        },
                        {
                          position: j.title,
                          jd_text: rawJob.jd_text || j.title,
                          requirements: reqs,
                        }
                      );
                      if (comp && typeof comp.overallScore === 'number' && comp.overallScore > 0) {
                        score = Math.round(comp.overallScore);
                      }
                    } catch (e) {}
                  }

                  if (score !== null && score > 0) {
                    if (maxJobScore === null || score > maxJobScore) {
                      maxJobScore = score;
                    }
                    const isSubmit = score >= 65 || c.decision === 'SUBMIT' || c.decision === 'ACCEPT' || c.decision === 'REVIEW';
                    const existingIdx = evals.findIndex(e => e.id === c.id || (e.name && c.name && e.name.toLowerCase() === c.name.toLowerCase()));
                    const evalItem: CandidateEvaluationItem = {
                      id: c.id,
                      name: c.name || 'Candidate',
                      role: c.currentTitle || j.title || 'Applicant',
                      match: score,
                      decision: isSubmit ? 'SUBMIT' : 'DO NOT SUBMIT',
                      time: c.uploadedAt ? new Date(c.uploadedAt).toLocaleDateString() : 'Recently',
                      jobId: j.id,
                    };

                    if (existingIdx >= 0) {
                      evals[existingIdx] = evalItem;
                    } else {
                      evals.push(evalItem);
                    }
                  }
                }

                j.topScore = maxJobScore;
              }
            } catch (err) {
              console.warn(`[Dashboard] Error processing candidates for job ${j.id}:`, err);
            }
          }
        }

        // 3c. Fall back to /candidates if evals is still empty
        if (evals.length === 0) {
          try {
            const resCand = await fetch(`${backendUrl}/candidates`, { headers });
            if (resCand.ok) {
              const candData = await resCand.json();
              const candList = candData.candidates || candData.data || [];
              for (const c of candList) {
                const rawVal = c.matchScore ?? c.atsScore;
                if (typeof rawVal === 'number' && rawVal > 0) {
                  const matchScore = Math.round(rawVal);
                  const isSubmit = c.decision === 'SUBMIT' || c.decision === 'ACCEPT' || matchScore >= 70;
                  evals.push({
                    id: c.id,
                    name: c.name || 'Candidate',
                    role: c.currentTitle || c.role || 'Applicant',
                    match: matchScore,
                    decision: isSubmit ? 'SUBMIT' : 'DO NOT SUBMIT',
                    time: c.uploadedAt ? new Date(c.uploadedAt).toLocaleDateString() : 'Recently',
                    jobId: c.jobId
                  });
                }
              }
            }
          } catch (e) {
            console.warn('[Dashboard] Candidates fetch error:', e);
          }
        }

        // 3d. Strict deduplication (guarantee exactly 1 evaluation item per candidate)
        const dedupedEvalsMap = new Map<string, CandidateEvaluationItem>();
        for (const ev of evals) {
          const key = (ev.name || '').trim().toLowerCase() || ev.id;
          if (!dedupedEvalsMap.has(key)) {
            dedupedEvalsMap.set(key, ev);
          } else {
            const existing = dedupedEvalsMap.get(key)!;
            if (ev.match > existing.match) {
              dedupedEvalsMap.set(key, ev);
            }
          }
        }
        const finalEvals = Array.from(dedupedEvalsMap.values());

        // Update topScore on each job from finalEvals
        for (const j of mergedJobs) {
          const jobEvals = finalEvals.filter(ev => ev.jobId === j.id || (j.candidates > 0 && finalEvals.length === 1));
          if (jobEvals.length > 0) {
            j.topScore = Math.max(...jobEvals.map(ev => ev.match));
          }
        }

        if (isMounted) {
          setJobs(mergedJobs);
          setRecentEvaluations(finalEvals);
        }
      } catch (err) {
        console.error('[Dashboard] Error loading dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user, token]);

  // Dynamic calculations
  const activeJobs = useMemo(() => jobs.filter(j => j.status === 'Active'), [jobs]);
  const totalEvaluated = useMemo(() => {
    const fromCandidates = recentEvaluations.length;
    const fromJobApplicants = jobs.reduce((acc, j) => acc + (j.candidates || 0), 0);
    return Math.max(fromCandidates, fromJobApplicants);
  }, [recentEvaluations, jobs]);

  const submitCount = useMemo(() => {
    return recentEvaluations.filter(e => e.decision === 'SUBMIT' || e.decision === 'ACCEPT' || e.match >= 65).length;
  }, [recentEvaluations]);

  const rejectCount = useMemo(() => {
    return recentEvaluations.filter(e => (e.decision === 'DO NOT SUBMIT' || e.decision === 'REJECT') && e.match < 50).length;
  }, [recentEvaluations]);

  const avgCompliance = useMemo(() => {
    if (recentEvaluations.length === 0) return null;
    const sum = recentEvaluations.reduce((acc, curr) => acc + curr.match, 0);
    return Math.round((sum / recentEvaluations.length) * 10) / 10;
  }, [recentEvaluations]);


  const filteredJobs = useMemo(() => {
    return jobs.filter(j =>
      j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
      j.client.toLowerCase().includes(jobSearch.toLowerCase()) ||
      j.location.toLowerCase().includes(jobSearch.toLowerCase())
    );
  }, [jobs, jobSearch]);

  const kpis = [
    {
      label: 'Active Requisitions',
      value: activeJobs.length.toString(),
      sub: jobs.length === 0 ? 'No active jobs' : `${jobs.length} total requisitions`,
      accent: 'bg-brand-orange',
      textAccent: 'text-brand-orange',
      bgAccent: 'bg-brand-orange-pale',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Candidates Evaluated',
      value: totalEvaluated.toLocaleString(),
      sub: totalEvaluated === 0 ? '0 in talent pool' : `${recentEvaluations.length} evaluated profiles`,
      accent: 'bg-violet-500',
      textAccent: 'text-violet-600',
      bgAccent: 'bg-violet-50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Avg Match Compliance',
      value: avgCompliance !== null ? `${avgCompliance}%` : '—',
      sub: avgCompliance !== null ? 'Deterministic average' : 'Awaiting evaluations',
      accent: 'bg-emerald-500',
      textAccent: 'text-emerald-600',
      bgAccent: 'bg-emerald-50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Rejected Profiles',
      value: rejectCount.toString(),
      sub: rejectCount === 0 ? 'No rejected profiles' : `${rejectCount} rejected candidates`,
      accent: 'bg-rose-500',
      textAccent: 'text-rose-600',
      bgAccent: 'bg-rose-50',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  ];

  const pipeline = [
    { stage: 'Total Evaluated', value: totalEvaluated, color: 'bg-brand-charcoal' },
    { stage: 'Submit (Accept)', value: submitCount,    color: 'bg-emerald-500'    },
    { stage: 'Reject',          value: rejectCount,    color: 'bg-rose-400'       },
  ];

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#1E293B] flex flex-col selection:bg-brand-orange-pale selection:text-brand-orange">
      <Header />

      <main className="max-w-screen-xl mx-auto px-6 pt-24 pb-16 flex-1 w-full">

        {/* Page header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-orange-pale border border-brand-orange-border rounded-full text-xs font-bold text-brand-orange mb-2">
              <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
              Recruiter Workspace • {user?.name || user?.email?.split('@')[0] || 'My Workspace'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] tracking-tight">Executive Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time candidate intelligence, active requisitions, and deterministic ATS pipeline</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/jobs/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-xl transition-all shadow-orange"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Post Job Requisition</span>
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {kpis.map((k, i) => (
            <div key={i} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all card-hover-lift relative overflow-hidden group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${k.bgAccent} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <div className={k.textAccent}>{k.icon}</div>
                </div>
                <span className="text-xs font-bold text-slate-500 text-right leading-tight">{k.label}</span>
              </div>
              <div className="text-3xl font-extrabold text-[#1E293B] tracking-tight">{k.value}</div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>{k.sub}</span>
                <span className="text-slate-400 font-semibold flex items-center gap-0.5">
                  Verified
                </span>
              </div>
            </div>
          ))}
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active jobs table */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h2 className="text-base font-bold text-[#1E293B]">Your Active Requisitions & JDs</h2>
                <p className="text-xs text-slate-500 mt-0.5">Click a position to review requirements or evaluate candidate CVs</p>
              </div>

              <div className="flex items-center gap-3">
                {jobs.length > 0 && (
                  <input
                    type="text"
                    placeholder="Filter positions..."
                    value={jobSearch}
                    onChange={e => setJobSearch(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 w-44"
                  />
                )}
                <Link href="/jobs" className="text-xs text-brand-orange font-bold hover:underline whitespace-nowrap">
                  All ({jobs.length}) →
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {isLoading ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-medium">Loading requisitions...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-16 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-brand-orange-pale text-brand-orange flex items-center justify-center mx-auto mb-4 border border-brand-orange-border">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-[#1E293B] mb-1">No job requisitions created yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                    Start by posting your first Job Description. TaskNera will extract criteria and evaluate candidates deterministically.
                  </p>
                  <Link
                    href="/jobs/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-xl transition-all shadow-orange"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Post Job Requisition
                  </Link>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No positions match "{jobSearch}"
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#F1F5F9] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Position & Client</th>
                      <th className="px-4 py-3.5 text-center">Applicants</th>
                      <th className="px-4 py-3.5 text-center">Mode</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredJobs.map(j => (
                      <tr key={j.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <Link href={`/jobs/${j.id}/requirements`} className="text-sm font-bold text-[#1E293B] group-hover:text-brand-orange transition-colors">
                            {j.title}
                          </Link>
                          <div className="text-xs text-slate-500 mt-0.5">{j.client} • {j.location}</div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-bold text-[#1E293B]">{j.candidates}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-700">
                            {j.mode}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/jobs/${j.id}/candidates`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-orange-pale hover:bg-brand-orange hover:text-white text-brand-orange text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                          >
                            Evaluate CVs →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Recent evaluations */}
            <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
                <h2 className="text-sm font-bold text-[#1E293B]">Recent ATS Evaluations</h2>
                <Link href="/candidates" className="text-xs text-brand-orange font-bold hover:underline">Talent Pool →</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentEvaluations.length === 0 ? (
                  <div className="py-12 px-5 text-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-xs font-bold text-slate-700">No evaluations yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Upload candidate resumes to see automated ATS scores and hiring decisions.
                    </p>
                  </div>
                ) : (
                  recentEvaluations.slice(0, 5).map((r, i) => {
                    const isAcc = r.decision === 'SUBMIT' || r.decision === 'ACCEPT' || r.match >= 65;
                    return (
                      <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand-orange-pale text-brand-orange font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                            {r.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#1E293B] truncate">{r.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{r.role}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                            isAcc
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}>
                            {isAcc ? '✓ ACCEPT' : '✕ REJECT'}
                          </span>
                          <div className="text-[11px] font-mono font-bold text-slate-700 mt-0.5">
                            {r.match}% ATS
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pipeline funnel */}
            <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#1E293B]">Recruitment Pipeline</h2>
                <span className="text-xs text-slate-500">{totalEvaluated} total</span>
              </div>
              <div className="space-y-3.5">
                {pipeline.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-semibold text-slate-600">{p.stage}</span>
                      <span className="font-bold text-[#1E293B]">{p.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.color} transition-all duration-700`}
                        style={{ width: `${totalEvaluated > 0 ? Math.min((p.value / totalEvaluated) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
