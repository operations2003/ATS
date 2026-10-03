'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import CandidateLinkModal from '@/components/CandidateLinkModal';

interface Requirement {
  id: string;
  requirement: string;
  category: string;
  is_mandatory: boolean;
  weight: number;
}

interface Job {
  id: string;
  client: string;
  position: string;
  location?: string;
  work_mode?: string;
  salary?: string;
  jd_text?: string;
  jd_file_url?: string;
  status: string;
  created_at: string;
  requirements: Requirement[];
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCandidateLinkOpen, setIsCandidateLinkOpen] = useState(false);

  useEffect(() => {
    async function fetchJob() {
      try {
        setLoading(true);
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const authToken = token || localStorage.getItem('tasknera_token');

        const res = await fetch(`${backendUrl}/jobs/${jobId}`, {
          headers: {
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          }
        });

        const data = await res.json();
        if (!res.ok || !data.job) {
          throw new Error(data.error || 'Job not found');
        }

        setJob(data.job);
      } catch (err: any) {
        console.error('Error fetching job details:', err);
        setErrorMsg(err.message || 'Failed to load job details');
      } finally {
        setLoading(false);
      }
    }

    if (jobId) {
      fetchJob();
    }
  }, [jobId, token]);

  const mandatoryCount = job?.requirements.filter(r => r.is_mandatory).length || 0;
  const preferredCount = job?.requirements.filter(r => !r.is_mandatory).length || 0;

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#1E293B] flex flex-col justify-between selection:bg-brand-orange-pale selection:text-brand-orange">
      <Header />

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-16 w-full flex-1">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/jobs" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-brand-orange transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Jobs List
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCandidateLinkOpen(true)}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Generate or copy public candidate application link"
            >
              <svg className="w-3.5 h-3.5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>Candidate Link</span>
            </button>
            <Link
              href={`/jobs/${jobId}/requirements`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
            >
              ⚙ Edit Requirements
            </Link>
            <Link
              href={`/jobs/${jobId}/candidates`}
              className="px-5 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-xl transition-all shadow-orange hover:shadow-orange-lg flex items-center gap-2"
            >
              <span>📄 Manage & Upload CVs</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center text-slate-400 animate-pulse bg-white border border-slate-200 rounded-3xl">
            <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span>Loading job details & requirement specifications...</span>
          </div>
        )}

        {/* Error State */}
        {errorMsg && !loading && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-8">
            <span className="font-bold block mb-1">Error Loading Job</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Job Details Card */}
        {job && !loading && (
          <div className="space-y-6">
            {/* Header Header Info */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-brand-orange-pale text-brand-orange border border-brand-orange-border rounded-full text-xs font-bold">
                      {job.work_mode || 'Hybrid'}
                    </span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase">
                      {job.status}
                    </span>
                  </div>
                  <h1 className="text-3xl font-extrabold text-[#1E293B] tracking-tight">{job.position}</h1>
                  <p className="text-slate-500 text-sm mt-1">Client: <span className="text-slate-900 font-bold">{job.client}</span> • Location: <span className="text-slate-700">{job.location || 'Pune, Maharashtra'}</span></p>
                </div>

                <div className="text-left md:text-right bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1 font-bold">Salary Range</span>
                  <span className="text-lg font-extrabold text-emerald-600">{job.salary || 'Competitive / In Line with Market'}</span>
                </div>
              </div>

              {/* Requirement Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200">
                  <span className="text-xs text-slate-400 uppercase block mb-1 font-bold">Total Requirements</span>
                  <span className="text-2xl font-extrabold text-[#1E293B]">{job.requirements.length}</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="text-xs text-rose-700 uppercase block mb-1 font-bold">Mandatory Criteria</span>
                  <span className="text-2xl font-extrabold text-rose-600">{mandatoryCount}</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                  <span className="text-xs text-blue-700 uppercase block mb-1 font-bold">Preferred Criteria</span>
                  <span className="text-2xl font-extrabold text-blue-600">{preferredCount}</span>
                </div>
              </div>
            </div>

            {/* Extracted Requirements List */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-orange"></span>
                  Candidate Evaluation Requirements ({job.requirements.length})
                </h2>
                <Link
                  href={`/jobs/${jobId}/requirements`}
                  className="text-xs text-brand-orange hover:underline font-bold"
                >
                  Edit Criteria →
                </Link>
              </div>

              <div className="space-y-3">
                {job.requirements.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">No requirement criteria extracted for this job.</p>
                ) : (
                  job.requirements.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                          req.is_mandatory
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {req.is_mandatory ? 'Mandatory' : 'Preferred'}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{req.requirement}</span>
                      </div>
                      <span className="text-xs text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                        {req.category || 'General'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions Footer Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-orange-50 to-amber-50 border border-brand-orange-border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div>
                <h3 className="text-base font-extrabold text-[#1E293B]">Candidates & Bulk CV Upload</h3>
                <p className="text-xs text-slate-600 mt-0.5">Upload candidate resumes (PDF, DOCX, TXT) and view parsing status for this job.</p>
              </div>

              <Link
                href={`/jobs/${jobId}/candidates`}
                className="px-6 py-3 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold rounded-xl transition-all shadow-orange hover:shadow-orange-lg whitespace-nowrap"
              >
                Go to Candidates & CVs →
              </Link>
            </div>
          </div>
        )}

        {/* Public Candidate Application Link Modal */}
        <CandidateLinkModal
          isOpen={isCandidateLinkOpen}
          onClose={() => setIsCandidateLinkOpen(false)}
          jobId={jobId}
          jobTitle={job?.position || 'Job Requisition'}
        />
      </main>

      <Footer />
    </div>
  );
}
