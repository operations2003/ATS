'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';

// ── Types & Interfaces ────────────────────────────────────────────────────────
export type FileUploadStatus = 'Pending' | 'Uploading' | 'Parsing' | 'Success' | 'Failed' | 'Duplicate';

export interface BatchFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: FileUploadStatus;
  progress: number;
  errorMessage?: string;
  candidateInfo?: {
    id?: string;
    name?: string;
    email?: string;
    title?: string;
    experience?: string;
    matchScore?: number;
    atsScore?: number;
    recommendation?: string;
    decision?: string;
    compliance?: string;
  };
}

interface JobDetails {
  id: string;
  position: string;
  client: string;
  location?: string;
  work_mode?: string;
  salary?: string;
  status?: string;
  requirementsCount?: number;
  requirements?: any[];
}

const MAX_BATCH_FILES = 15;
const MAX_CUMULATIVE_SIZE_BYTES = 14 * 1024 * 1024; // 14 MB total limit
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per CV
const MAX_CONCURRENT_UPLOADS = 3;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];

// Helper: Format bytes to KB / MB
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Helper: Get file extension badge styling
const getFileFormatBadge = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', bg: 'bg-red-50 text-red-700 border-red-200' };
    case 'docx':
    case 'doc':
      return { label: ext.toUpperCase(), bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'txt':
      return { label: 'TXT', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { label: ext?.toUpperCase() || 'FILE', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
};

export default function BatchCVUploadPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const jobId = (params?.id as string) || '';

  // Job Details State
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);

  // File Queue State
  const [fileQueue, setFileQueue] = useState<BatchFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationAlert, setValidationAlert] = useState<{ message: string; type: 'warning' | 'error' | 'info' } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  // ── Fetch Job Details ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchJobInfo() {
      if (!jobId) return;
      try {
        setLoadingJob(true);
        let localClient = '';
        let localPosition = '';
        if (typeof window !== 'undefined') {
          try {
            localClient = localStorage.getItem(`tasknera_company_${jobId}`) || '';
            localPosition = localStorage.getItem(`tasknera_position_${jobId}`) || '';

            const direct = JSON.parse(localStorage.getItem(`tasknera_job_${jobId}`) || 'null');
            if (direct?.client) localClient = direct.client;
            if (direct?.position) localPosition = direct.position;

            if (!localClient) {
              const created = JSON.parse(localStorage.getItem('tasknera_created_jobs') || '[]');
              const found = created.find((c: any) => String(c.id) === String(jobId)) || (jobId.startsWith('job-') ? created[0] : null);
              if (found?.client) localClient = found.client;
              if (found?.position) localPosition = found.position;
            }
          } catch {}
        }

        const res = await fetch(`${backendUrl}/jobs/${jobId}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (res.ok) {
          const data = await res.json();
          const jobObj = data.job || data;
          const isGenericClient = !jobObj.client || jobObj.client === 'Enterprise Client' || jobObj.client === 'Client Organization' || jobObj.client === 'Company Requisition';
          const isGenericPos = !jobObj.position || /^Job \d+$/i.test(jobObj.position) || jobObj.position.startsWith('Job 1788');

          setJob({
            id: jobObj.id || jobId,
            position: (!isGenericPos && jobObj.position) ? jobObj.position : (localPosition || 'Job Candidate Sourcing'),
            client: (!isGenericClient && jobObj.client) ? jobObj.client : (localClient || 'Hiring Organization'),
            location: jobObj.location || 'Hybrid / Remote',
            work_mode: jobObj.work_mode || 'Full-time',
            salary: jobObj.salary,
            status: jobObj.status || 'Active',
            requirementsCount: jobObj.requirements?.length || 0,
          });
        } else {
          setJob({
            id: jobId,
            position: localPosition || 'Job Candidate Sourcing',
            client: localClient || 'Hiring Organization',
            location: 'Multiple Locations',
            work_mode: 'Full-time',
            requirementsCount: 5,
          });
        }
      } catch (err) {
        console.warn('Could not fetch job info for CV upload:', err);
        setJob({
          id: jobId,
          position: 'Candidate CV Studio',
          client: 'Recruitment Studio',
          requirementsCount: 0,
        });
      } finally {
        setLoadingJob(false);
      }
    }

    fetchJobInfo();
  }, [backendUrl, jobId, token]);

  // ── Validation & Adding Files to Queue ───────────────────────────────────────
  const validateAndAddFiles = useCallback((incomingFiles: FileList | File[]) => {
    setValidationAlert(null);
    const rawFilesArray = Array.from(incomingFiles);
    if (rawFilesArray.length === 0) return;

    // Filter duplicates within the incoming batch itself (comparing filename + file size)
    const seenBatchKeys = new Set<string>();
    let duplicateRemovedCount = 0;
    const filesArray: File[] = [];

    rawFilesArray.forEach(file => {
      const key = `${file.name.toLowerCase()}_${file.size}`;
      if (seenBatchKeys.has(key)) {
        duplicateRemovedCount++;
      } else {
        seenBatchKeys.add(key);
        filesArray.push(file);
      }
    });

    // 1. File Count Restriction: Limit total files selected to maximum 15 files
    if (filesArray.length > MAX_BATCH_FILES) {
      setValidationAlert({
        message: 'Maximum 15 CVs can be uploaded at once. Please reduce your selection.',
        type: 'error',
      });
      return;
    }

    setFileQueue(currentQueue => {
      // Filter out files that already exist in currentQueue
      const uniqueIncomingFiles: File[] = [];
      filesArray.forEach(file => {
        const isDuplicateInQueue = currentQueue.some(
          q => q.name.toLowerCase() === file.name.toLowerCase() && q.size === file.size
        );
        if (isDuplicateInQueue) {
          duplicateRemovedCount++;
        } else {
          uniqueIncomingFiles.push(file);
        }
      });

      if (uniqueIncomingFiles.length === 0 && duplicateRemovedCount > 0) {
        setValidationAlert({
          message: 'Duplicate files removed from selection. Only unique CVs will be processed.',
          type: 'info',
        });
        return currentQueue;
      }

      // Reject if adding unique incoming files exceeds maximum 15 files limit
      if (currentQueue.length + uniqueIncomingFiles.length > MAX_BATCH_FILES) {
        setValidationAlert({
          message: 'Maximum 15 CVs can be uploaded at once. Please reduce your selection.',
          type: 'error',
        });
        return currentQueue;
      }

      // 2. Cumulative Size Limit: If total combined file size > 14 MB (14 * 1024 * 1024 bytes)
      const currentQueueSize = currentQueue.reduce((acc, item) => acc + item.size, 0);
      const incomingSize = uniqueIncomingFiles.reduce((acc, file) => acc + file.size, 0);
      const totalCombinedSize = currentQueueSize + incomingSize;

      if (totalCombinedSize > MAX_CUMULATIVE_SIZE_BYTES) {
        setValidationAlert({
          message: 'Total combined file size exceeds 14 MB limit. Please select smaller files.',
          type: 'error',
        });
        return currentQueue;
      }

      const newValidItems: BatchFileItem[] = [];
      const invalidMessages: string[] = [];

      uniqueIncomingFiles.forEach(file => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
        const isValidMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type) || file.type.startsWith('text/');

        if (!isValidExt && !isValidMime) {
          invalidMessages.push(`"${file.name}": Unsupported format. Allowed: .pdf, .docx, .doc, .txt`);
          return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          invalidMessages.push(`"${file.name}": Exceeds 5MB size limit (${formatBytes(file.size)}).`);
          return;
        }

        newValidItems.push({
          id: `cv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || ext,
          status: 'Pending',
          progress: 0,
        });
      });

      if (duplicateRemovedCount > 0 && invalidMessages.length === 0) {
        setValidationAlert({
          message: 'Duplicate files removed from selection. Only unique CVs will be processed.',
          type: 'info',
        });
      } else if (invalidMessages.length > 0) {
        if (duplicateRemovedCount > 0) {
          invalidMessages.unshift('Duplicate files removed from selection. Only unique CVs will be processed.');
        }
        setValidationAlert({
          message: invalidMessages.join(' | '),
          type: newValidItems.length > 0 ? 'warning' : 'error',
        });
      }

      return [...currentQueue, ...newValidItems];
    });
  }, []);


  // ── Drag & Drop Event Handlers ──────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleManualFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      // Reset input value so same files can be re-selected if removed
      e.target.value = '';
    }
  };

  // ── Queue Management ────────────────────────────────────────────────────────
  const handleRemoveItem = (id: string) => {
    setFileQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    if (isProcessing) return;
    setFileQueue([]);
    setValidationAlert(null);
  };

  const handleResetCompleted = () => {
    setFileQueue(prev => prev.filter(item => item.status === 'Pending' || item.status === 'Uploading' || item.status === 'Parsing'));
  };

  // ── Single File Upload & Parsing Execution ──────────────────────────────────
  const uploadSingleCV = async (item: BatchFileItem): Promise<void> => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('tasknera_token') : null);

    try {
      // Step 1: Advance to Uploading status with progress
      setFileQueue(prev =>
        prev.map(it => (it.id === item.id ? { ...it, status: 'Uploading', progress: 35, errorMessage: undefined } : it))
      );

      const formData = new FormData();
      formData.append('files', item.file);
      if (job?.position) formData.append('jobPosition', job.position);
      if (job?.client) formData.append('jobClient', job.client);
      if (job?.requirements && Array.isArray(job.requirements)) {
        formData.append('requirements', JSON.stringify(job.requirements));
      }

      // Transition to Parsing state right as request reaches backend
      setTimeout(() => {
        setFileQueue(prev =>
          prev.map(it => (it.id === item.id && it.status === 'Uploading' ? { ...it, status: 'Parsing', progress: 70 } : it))
        );
      }, 500);

      const res = await fetch(`${backendUrl}/jobs/${jobId}/candidates/upload`, {
        method: 'POST',
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const matchedCandidate = data.candidates?.find(
        (c: any) => c.fileName === item.name || c.parsingMetadata?.fileName === item.name
      ) || data.candidates?.[0];

      // Check if duplicate was detected on backend
      const isDuplicate = data.status === 'duplicate' ||
                          matchedCandidate?.isDuplicate ||
                          matchedCandidate?.status === 'duplicate' ||
                          matchedCandidate?.status === 'DUPLICATE';

      if (isDuplicate) {
        setFileQueue(prev =>
          prev.map(it => {
            if (it.id !== item.id) return it;
            return {
              ...it,
              status: 'Duplicate',
              progress: 100,
              errorMessage: data.message || matchedCandidate?.errorMessage || matchedCandidate?.message || 'This CV is already uploaded to this JD.',
              candidateInfo: matchedCandidate
                ? {
                    id: matchedCandidate.id,
                    name: matchedCandidate.name || 'Existing Candidate Profile',
                    email: matchedCandidate.email || '',
                    title: matchedCandidate.currentTitle || 'Applicant',
                    experience: matchedCandidate.totalExperience || '',
                    matchScore: matchedCandidate.matchScore ?? matchedCandidate.atsScore,
                    atsScore: matchedCandidate.atsScore ?? matchedCandidate.matchScore,
                    recommendation: matchedCandidate.recommendation || matchedCandidate.decision,
                    decision: matchedCandidate.decision || matchedCandidate.recommendation,
                    compliance: matchedCandidate.mandatoryCompliance,
                  }
                : undefined,
            };
          })
        );
        return;
      }

      setFileQueue(prev =>
        prev.map(it => {
          if (it.id !== item.id) return it;

          if (matchedCandidate && matchedCandidate.parsingStatus === 'FAILED') {
            return {
              ...it,
              status: 'Failed',
              progress: 100,
              errorMessage: matchedCandidate.errorMessage || 'CV parsing failed on server',
            };
          }

          return {
            ...it,
            status: 'Success',
            progress: 100,
            candidateInfo: matchedCandidate
              ? {
                  id: matchedCandidate.id,
                  name: matchedCandidate.name || 'Candidate Profile',
                  email: matchedCandidate.email || '',
                  title: matchedCandidate.currentTitle || 'Applicant',
                  experience: matchedCandidate.totalExperience || '',
                  matchScore: matchedCandidate.matchScore ?? matchedCandidate.atsScore,
                  atsScore: matchedCandidate.atsScore ?? matchedCandidate.matchScore,
                  recommendation: matchedCandidate.recommendation || matchedCandidate.decision,
                  decision: matchedCandidate.decision || matchedCandidate.recommendation,
                  compliance: matchedCandidate.mandatoryCompliance,
                }
              : undefined,
          };
        })
      );

      // Increment applicant count for this job in localStorage
      if (typeof window !== 'undefined') {
        try {
          const currentCount = parseInt(localStorage.getItem(`tasknera_candidates_count_${jobId}`) || '0', 10);
          const newCount = currentCount + 1;
          localStorage.setItem(`tasknera_candidates_count_${jobId}`, String(newCount));

          const created = JSON.parse(localStorage.getItem('tasknera_created_jobs') || '[]');
          const updatedCreated = created.map((cj: any) => {
            if (String(cj.id) === String(jobId)) {
              const prev = typeof cj.candidatesCount === 'number' ? cj.candidatesCount : (typeof cj.candidates === 'number' ? cj.candidates : 0);
              return { ...cj, candidatesCount: prev + 1, candidates: prev + 1 };
            }
            return cj;
          });
          localStorage.setItem('tasknera_created_jobs', JSON.stringify(updatedCreated));
        } catch {}
      }
    } catch (err: any) {
      console.error(`Upload failed for ${item.name}:`, err);
      setFileQueue(prev =>
        prev.map(it =>
          it.id === item.id
            ? {
                ...it,
                status: 'Failed',
                progress: 100,
                errorMessage: err.message || 'Network error during upload',
              }
            : it
        )
      );
    }
  };

  // ── Concurrency-Controlled Batch Processing ─────────────────────────────────
  const startBatchProcessing = async () => {
    if (isProcessing) return;

    if (fileQueue.length > MAX_BATCH_FILES) {
      setValidationAlert({
        message: 'Maximum 15 CVs can be uploaded at once. Please reduce your selection.',
        type: 'error',
      });
      return;
    }

    const totalBatchSize = fileQueue.reduce((acc, it) => acc + it.size, 0);
    if (totalBatchSize > MAX_CUMULATIVE_SIZE_BYTES) {
      setValidationAlert({
        message: 'Total combined file size exceeds 14 MB limit. Please select smaller files.',
        type: 'error',
      });
      return;
    }

    const pendingItems = fileQueue.filter(it => it.status === 'Pending' || it.status === 'Failed');
    if (pendingItems.length === 0) {
      setValidationAlert({
        message: 'No pending or failed files to process. Add new files to upload.',
        type: 'info',
      });
      return;
    }

    setIsProcessing(true);
    setValidationAlert(null);

    // Queue of item IDs to process
    const queue = [...pendingItems];
    let activeWorkers = 0;

    return new Promise<void>(resolve => {
      const runNext = () => {
        // If queue is empty and no workers active, finish
        if (queue.length === 0 && activeWorkers === 0) {
          setIsProcessing(false);
          resolve();
          return;
        }

        // Spawn workers up to MAX_CONCURRENT_UPLOADS (3 at a time)
        while (queue.length > 0 && activeWorkers < MAX_CONCURRENT_UPLOADS) {
          const nextItem = queue.shift();
          if (!nextItem) break;

          activeWorkers++;
          uploadSingleCV(nextItem).finally(() => {
            activeWorkers--;
            runNext();
          });
        }
      };

      runNext();
    });
  };

  // ── Retry a Single Failed File ──────────────────────────────────────────────
  const handleRetrySingle = (item: BatchFileItem) => {
    if (isProcessing) return;
    setFileQueue(prev =>
      prev.map(it => (it.id === item.id ? { ...it, status: 'Pending', progress: 0, errorMessage: undefined } : it))
    );
  };

  // ── Summary Metrics ─────────────────────────────────────────────────────────
  const totalCount = fileQueue.length;
  const pendingCount = fileQueue.filter(f => f.status === 'Pending').length;
  const inProgressCount = fileQueue.filter(f => f.status === 'Uploading' || f.status === 'Parsing').length;
  const successCount = fileQueue.filter(f => f.status === 'Success').length;
  const failedCount = fileQueue.filter(f => f.status === 'Failed').length;
  const duplicateCount = fileQueue.filter(f => f.status === 'Duplicate').length;
  const completedCount = successCount + failedCount + duplicateCount;

  const globalProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;


  return (
    <div className="min-h-screen bg-[#EEF2F6] flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Breadcrumb & Top Bar ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <nav className="flex items-center gap-2 text-xs font-semibold text-brand-charcoal-3 mb-2">
              <Link href="/jobs" className="hover:text-brand-orange transition-colors">
                Jobs
              </Link>
              <span>/</span>
              <Link href={`/jobs/${jobId}`} className="hover:text-brand-orange transition-colors truncate max-w-[200px]">
                {job?.position || 'Job Overview'}
              </Link>
              <span>/</span>
              <span className="text-brand-orange font-bold">Batch CV Upload</span>
            </nav>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">
              Batch CV Upload Studio
            </h1>
            <p className="text-sm text-brand-charcoal-2 mt-1">
              Upload 10–15 candidate resumes simultaneously with instant text extraction, parsing, and candidate matching.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/jobs/${jobId}/candidates`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-border bg-white text-brand-charcoal hover:border-brand-orange hover:text-brand-orange font-semibold text-sm shadow-xs transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              View Candidates Directory
            </Link>
          </div>
        </div>

        {/* ── Job Banner Card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 border border-brand-border/60 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-orange-pale text-brand-orange flex items-center justify-center font-bold text-lg border border-brand-orange-border">
              {job?.position ? job.position.substring(0, 2).toUpperCase() : 'JD'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-brand-charcoal">
                  {loadingJob ? 'Loading Job Details...' : (job?.position || 'Salesforce Developer')}
                </h2>

                {job?.status && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {job.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-charcoal-3 mt-0.5 flex items-center gap-3">
                <span><strong>Client:</strong> {job?.client || 'Hexaware Technologies'}</span>
                {job?.location && <span>• <strong>Location:</strong> {job.location}</span>}
                {job?.work_mode && <span>• <strong>Mode:</strong> {job.work_mode}</span>}
                {job?.requirementsCount ? <span>• <strong>Requirements:</strong> {job.requirementsCount} Verified</span> : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold bg-[#F8FAFC] border border-brand-border/80 px-3.5 py-2 rounded-xl text-brand-charcoal-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Concurrency Active: <strong>Max {MAX_CONCURRENT_UPLOADS} parallel CVs</strong>
          </div>
        </div>

        {/* ── Validation / Warning Alert Banner ────────────────────────────── */}
        {validationAlert && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm font-medium flex items-start gap-3 border transition-all ${
              validationAlert.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : validationAlert.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">{validationAlert.message}</div>
            <button
              onClick={() => setValidationAlert(null)}
              className="text-xs font-bold hover:opacity-75 transition-opacity px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Drag & Drop Zone ────────────────────────────────────────────── */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 mb-8 ${
            isDragging
              ? 'border-brand-orange bg-brand-orange-pale/50 scale-[1.005] shadow-orange-glow'
              : 'border-brand-border bg-white hover:border-brand-orange/60 hover:bg-[#FDFEFE] shadow-xs'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleManualFileInput}
            className="hidden"
          />

          <div className="max-w-md mx-auto flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 ${
              isDragging ? 'bg-brand-orange text-white scale-110' : 'bg-brand-orange-pale text-brand-orange'
            }`}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-brand-charcoal mb-1">
              {isDragging ? 'Drop CV files right here' : 'Drag & drop 10–15 CV files here'}
            </h3>
            <p className="text-sm text-brand-charcoal-2 mb-4">
              or <span className="text-brand-orange font-bold underline underline-offset-2">browse files</span> from your computer
            </p>

            {/* Constraints Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-brand-charcoal-3">
              <span className="px-3 py-1 rounded-lg bg-[#F1F5F9] border border-brand-border/60">
                PDF, DOCX, DOC, TXT
              </span>
              <span className="px-3 py-1 rounded-lg bg-[#F1F5F9] border border-brand-border/60">
                Max 15 files / batch
              </span>
              <span className="px-3 py-1 rounded-lg bg-[#F1F5F9] border border-brand-border/60">
                Up to 5MB per CV
              </span>
            </div>
          </div>
        </div>

        {/* ── Global Progress & Summary Stats Card ────────────────────────── */}
        {totalCount > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-brand-border shadow-xs mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-extrabold text-brand-charcoal">
                    Batch Processing Progress
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#F1F5F9] text-brand-charcoal border border-brand-border">
                    {completedCount} of {totalCount} files completed ({globalProgress}%)
                  </span>
                </div>
                <p className="text-xs text-brand-charcoal-3 mt-1">
                  Processes up to {MAX_CONCURRENT_UPLOADS} files concurrently for optimal performance.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                {fileQueue.some(f => f.status === 'Pending' || f.status === 'Failed') && (
                  <button
                    onClick={startBatchProcessing}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange text-white font-bold text-sm shadow-orange hover:bg-brand-orange-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Processing Queue ({inProgressCount} active)...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Processing ({pendingCount + failedCount})
                      </>
                    )}
                  </button>
                )}

                {successCount > 0 && !isProcessing && (
                  <Link
                    href={`/jobs/${jobId}/candidates`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xs hover:bg-emerald-700 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Review Parsed Candidates ({successCount})
                  </Link>
                )}

                <button
                  onClick={handleClearAll}
                  disabled={isProcessing}
                  className="px-3.5 py-2.5 rounded-xl border border-brand-border bg-white text-brand-charcoal-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Global Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-5">
              <div
                className="bg-brand-orange h-full rounded-full transition-all duration-300 relative"
                style={{ width: `${globalProgress}%` }}
              >
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                )}
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-brand-border/60">
              <div className="bg-[#F8FAFC] p-3 rounded-xl border border-brand-border/60 text-center">
                <span className="text-xs font-semibold text-brand-charcoal-3 block">Total in Queue</span>
                <span className="text-lg font-extrabold text-brand-charcoal">{totalCount}</span>
              </div>
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/60 text-center">
                <span className="text-xs font-semibold text-amber-700 block">Pending</span>
                <span className="text-lg font-extrabold text-amber-800">{pendingCount}</span>
              </div>
              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200/60 text-center">
                <span className="text-xs font-semibold text-blue-700 block">In Progress</span>
                <span className="text-lg font-extrabold text-blue-800">{inProgressCount}</span>
              </div>
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60 text-center">
                <span className="text-xs font-semibold text-emerald-700 block">Success</span>
                <span className="text-lg font-extrabold text-emerald-800">{successCount}</span>
              </div>
              <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-200/60 text-center col-span-2 sm:col-span-1">
                <span className="text-xs font-semibold text-rose-700 block">Failed</span>
                <span className="text-lg font-extrabold text-rose-800">{failedCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── ATS Evaluation Results Hero Card ────────────────────────────── */}
        {completedCount > 0 && inProgressCount === 0 && (
          <div className="bg-gradient-to-r from-slate-950 via-[#0B1528] to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-indigo-500/40 shadow-2xl mb-8 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-extrabold mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Automated ATS Evaluation Ready
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  CV Parsing & ATS Evaluation Results Ready!
                </h2>
                <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                  {successCount} candidate {successCount === 1 ? 'resume has' : 'resumes have'} been parsed, verified against this job&apos;s criteria, and assigned ATS match scores.
                </p>


                {/* Quick summary stats */}
                <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-semibold">
                  <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                    <span className="text-slate-400">Total Uploaded: </span>
                    <span className="text-white font-bold">{completedCount}</span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                    <span className="text-slate-400">Successfully Evaluated: </span>
                    <span className="text-emerald-400 font-bold">{successCount}</span>
                  </div>
                  {duplicateCount > 0 && (
                    <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                      <span className="text-slate-400">Existing Reused: </span>
                      <span className="text-purple-300 font-bold">{duplicateCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 flex-shrink-0">
                <Link
                  href={`/jobs/${jobId}/candidates`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 transition-all hover:scale-105 text-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  View Candidate ATS Rankings
                </Link>

                {fileQueue.find(f => f.candidateInfo?.id)?.candidateInfo?.id && (
                  <Link
                    href={`/evaluations/${fileQueue.find(f => f.candidateInfo?.id)!.candidateInfo!.id}?jobId=${jobId}`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition-colors text-center"
                  >
                    Open Candidate Scorecard ➔
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── File Queue Preview List ─────────────────────────────────────── */}
        {fileQueue.length > 0 ? (
          <div className="bg-white rounded-2xl border border-brand-border shadow-xs overflow-hidden mb-8">
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-brand-charcoal">
                  Queued Files Preview ({fileQueue.length}/{MAX_BATCH_FILES})
                </h3>
                <p className="text-xs text-brand-charcoal-3">
                  Check individual status, extracted candidate previews, and retry any failed items.
                </p>
              </div>

              {completedCount > 0 && (
                <button
                  onClick={handleResetCompleted}
                  className="text-xs font-bold text-brand-orange hover:underline"
                >
                  Clear Finished Items
                </button>
              )}
            </div>

            <div className="divide-y divide-brand-border/60">
              {fileQueue.map((item, index) => {
                const formatBadge = getFileFormatBadge(item.name);

                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      item.status === 'Uploading' || item.status === 'Parsing'
                        ? 'bg-orange-50/20'
                        : item.status === 'Success'
                        ? 'bg-emerald-50/15'
                        : item.status === 'Failed'
                        ? 'bg-rose-50/20'
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {/* Left: File Info & Extracted Candidate Preview */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-brand-charcoal-3 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        #{index + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${formatBadge.bg}`}>
                            {formatBadge.label}
                          </span>
                          <span className="font-bold text-sm text-brand-charcoal truncate max-w-xs sm:max-w-md" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-xs text-brand-charcoal-3">
                            ({formatBytes(item.size)})
                          </span>
                        </div>

                        {/* Extracted Candidate Information Preview & ATS Score */}
                        {item.status === 'Success' && item.candidateInfo && (
                          <div className="mt-2 text-xs bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 text-emerald-950 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-bold flex items-center gap-1.5 text-sm text-emerald-900">
                                <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                {item.candidateInfo.name}
                              </span>
                              {item.candidateInfo.title && (
                                <span>• Role: <strong>{item.candidateInfo.title}</strong></span>
                              )}
                              {item.candidateInfo.experience && (
                                <span>• Exp: <strong>{item.candidateInfo.experience}</strong></span>
                              )}
                              {item.candidateInfo.email && (
                                <span>• {item.candidateInfo.email}</span>
                              )}
                              {item.candidateInfo.matchScore !== undefined && item.candidateInfo.matchScore !== null && (
                                <span className={`px-2.5 py-0.5 rounded-full font-black text-xs border ${
                                  item.candidateInfo.matchScore >= 80
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : item.candidateInfo.matchScore >= 60
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}>
                                  ⚡ ATS Match: {Math.round(item.candidateInfo.matchScore)}%
                                  {item.candidateInfo.recommendation ? ` • ${item.candidateInfo.recommendation}` : ''}
                                </span>
                              )}
                            </div>

                            <Link
                              href={item.candidateInfo.id ? `/evaluations/${item.candidateInfo.id}?jobId=${jobId}` : `/jobs/${jobId}/candidates`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all hover:scale-105"
                            >
                              View ATS Evaluation ➔
                            </Link>
                          </div>
                        )}

                        {/* Error Message Display */}
                        {item.status === 'Failed' && item.errorMessage && (
                          <div className="mt-1.5 text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>Error: {item.errorMessage}</span>
                          </div>
                        )}

                        {/* Duplicate / Already Uploaded Status Display */}
                        {item.status === 'Duplicate' && (
                          <div className="mt-1.5 text-xs text-purple-700 font-semibold flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 flex-shrink-0 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>Skipped (Duplicate): {item.errorMessage || 'This CV is already uploaded to this JD.'}</span>
                          </div>
                        )}

                        {/* Live progress indicator for individual file */}
                        {(item.status === 'Uploading' || item.status === 'Parsing') && (
                          <div className="mt-2 w-full max-w-xs bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-brand-orange h-full rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Status Badge & Actions */}
                    <div className="flex items-center gap-3 justify-between sm:justify-end flex-shrink-0">
                      {/* Status Badges */}
                      {item.status === 'Pending' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pending
                        </span>
                      )}

                      {item.status === 'Uploading' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Uploading...
                        </span>
                      )}

                      {item.status === 'Parsing' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
                          <svg className="w-3.5 h-3.5 animate-spin text-purple-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Parsing AI...
                        </span>
                      )}

                      {item.status === 'Success' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Success
                        </span>
                      )}

                      {item.status === 'Duplicate' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                          Already Uploaded
                        </span>
                      )}

                      {item.status === 'Failed' && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Failed
                          </span>
                          {!isProcessing && (
                            <button
                              onClick={() => handleRetrySingle(item)}
                              title="Retry upload"
                              className="p-1.5 rounded-lg border border-brand-border bg-white text-brand-charcoal hover:text-brand-orange hover:border-brand-orange transition-colors text-xs font-bold"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}


                      {/* Remove Button */}
                      {item.status !== 'Uploading' && item.status !== 'Parsing' && (
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          title="Remove file"
                          className="p-1.5 text-brand-charcoal-3 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── Help / Guidance Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-brand-border shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center font-bold mb-3">
              1
            </div>
            <h4 className="font-bold text-brand-charcoal text-sm mb-1">Batch Sizing</h4>
            <p className="text-xs text-brand-charcoal-2 leading-relaxed">
              Upload up to 15 CVs at once. Optimal batches of 10–15 resumes allow faster comparison and ranking across job requirements.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-brand-border shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3">
              2
            </div>
            <h4 className="font-bold text-brand-charcoal text-sm mb-1">Parallel Extraction</h4>
            <p className="text-xs text-brand-charcoal-2 leading-relaxed">
              Engine processes 3 files concurrently using Python PyMuPDF & OCR fallback to extract work history, skills, and gaps.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-brand-border shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3">
              3
            </div>
            <h4 className="font-bold text-brand-charcoal text-sm mb-1">Automated Evaluation</h4>
            <p className="text-xs text-brand-charcoal-2 leading-relaxed">
              After upload, immediately navigate to the Candidate Directory to view overall fit, mandatory requirement matches, and career timeline gaps.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
