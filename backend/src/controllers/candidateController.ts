import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { extractDocumentTextViaPython, PythonDocumentResponse } from '../services/pythonDocumentClient';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  extractStructuredCandidateFromText,
  CandidateParsedProfile,
  validateCvTextQuality,
  calculateCareerGaps
} from '../services/cvParsingService';
import { evaluateCandidateAgainstRequirements } from '../services/evaluationService';
import { getStandardRequirementsForPosition } from './evaluationController';
import { getJobFromStoreOrDb, GLOBAL_JOB_STORE } from './jobController';

export interface CandidateRecord extends CandidateParsedProfile {
  id: string;
  jobId: string;
  fileName: string;
  fileSize: number;
  fileHash?: string;
  uploadedAt: string;
  uploadedBy?: string;
  createdBy?: string;
  isDuplicate?: boolean;
  matchScore?: number;
  atsScore?: number;
  decision?: string;
  matchLevel?: string;
  mandatoryCompliance?: string;
}

// In-memory store for fast state sync and test resilience
export const CANDIDATE_STORE: Map<string, CandidateRecord[]> = new Map();
export const GLOBAL_CANDIDATES: Map<string, CandidateRecord> = new Map(); // Keyed by fileHash or id

// Initial default candidates (empty so only user uploaded CVs are present)
const DEFAULT_INITIAL_CANDIDATES: Record<string, CandidateRecord[]> = {};

// Initialize global store with defaults
for (const [jobId, list] of Object.entries(DEFAULT_INITIAL_CANDIDATES)) {
  CANDIDATE_STORE.set(jobId, [...list]);
  for (const c of list) {
    if (c.fileHash) GLOBAL_CANDIDATES.set(c.fileHash, c);
    GLOBAL_CANDIDATES.set(c.id, c);
  }
}

/**
 * Helper to convert Prisma Candidate DB entity to CandidateRecord,
 * automatically extracting skills, experience, and education from raw_text
 * if the relational child tables are empty or incomplete.
 */
export function mapDbCandidateToRecord(c: any, defaultJobId?: string): CandidateRecord {
  const associatedJobId = c.job_id || c.applications?.[0]?.job_id || defaultJobId || 'jd-1';
  let skills: string[] = Array.isArray(c.skills) ? c.skills.map((s: any) => s.skill).filter(Boolean) : [];
  let experience: any[] = Array.isArray(c.experiences) ? c.experiences.map((ex: any) => ({
    title: ex.title || '',
    company: ex.company || '',
    startDate: ex.start_date || '',
    endDate: ex.end_date || '',
    duration: ex.duration || '',
    description: ex.description || '',
  })) : [];
  let education: any[] = Array.isArray(c.education) ? c.education.map((e: any) => ({
    degree: e.degree || '',
    institution: e.institution || '',
    field: e.field || '',
    year: e.start_year ? `${e.start_year}` : undefined,
  })) : [];

  let totalExp = c.total_experience;
  let title = c.current_title;
  let company = c.current_company;
  let location = c.location;
  let summary = c.summary;

  // If skills, experience or totalExperience are missing/0 yrs from DB, parse from raw_text on the fly
  if ((skills.length === 0 || experience.length === 0 || !title || !totalExp || totalExp === '0 yrs' || totalExp === '0 Years') && c.raw_text && c.raw_text.trim().length > 10) {
    try {
      const parsed = extractStructuredCandidateFromText(c.raw_text, c.resume_file_url || 'cv.pdf', {
        fileType: 'application/pdf',
        pageCount: 1,
        extractionMethod: 'database_reparse',
        ocrUsed: false,
        characterCount: c.raw_text.length,
        wordCount: c.raw_text.split(/\s+/).filter(Boolean).length,
      });

      if (skills.length === 0 && parsed.skills && parsed.skills.length > 0) {
        skills = parsed.skills;
        // Asynchronously persist skills into database for permanent caching
        prisma.candidateSkill.createMany({
          data: skills.map((s: string) => ({ candidate_id: c.id, skill: s })),
          skipDuplicates: true,
        }).catch(() => null);
      }

      if (experience.length === 0 && parsed.experience && parsed.experience.length > 0) {
        experience = parsed.experience;
        prisma.candidateExperience.createMany({
          data: experience.map((ex: any) => ({
            candidate_id: c.id,
            company: ex.company || 'Company',
            title: ex.title || 'Role',
            duration: ex.duration || '',
            description: ex.description || '',
            start_date: ex.startDate || '',
            end_date: ex.endDate || '',
          })),
          skipDuplicates: true,
        }).catch(() => null);
      }

      if (education.length === 0 && parsed.education && parsed.education.length > 0) {
        education = parsed.education;
        prisma.candidateEducation.createMany({
          data: education.map((edu: any) => ({
            candidate_id: c.id,
            degree: edu.degree || 'Degree',
            institution: edu.institution || 'University',
            field: edu.field || '',
          })),
          skipDuplicates: true,
        }).catch(() => null);
      }

      if ((!totalExp || totalExp === '0 yrs' || totalExp === '0 Years') && parsed.totalExperience && parsed.totalExperience !== '0 yrs') {
        totalExp = parsed.totalExperience;
      }
      if (!title && parsed.currentTitle && !['candidate profile', 'candidate', 'professional role'].includes(parsed.currentTitle.toLowerCase())) {
        title = parsed.currentTitle;
      }
      if (!company && parsed.currentCompany && !['company', 'the role', 'role', 'the company', 'organization'].includes(parsed.currentCompany.toLowerCase())) {
        company = parsed.currentCompany;
      }
      if (!location && parsed.location) location = parsed.location;
      if (!summary && parsed.summary) summary = parsed.summary;
    } catch (parseErr) {
      console.warn('[DB Candidate Reparse Notice]:', parseErr);
    }
  }

  // Fallback to experience records for real company and title
  if ((!company || ['company', 'the role', 'role', 'the company', 'organization'].includes(company.toLowerCase())) && experience.length > 0) {
    for (const exp of experience) {
      if (exp.company && !['company', 'the role', 'role', 'the company', 'organization', 'position', 'experience', 'present'].includes(exp.company.toLowerCase())) {
        company = exp.company;
        break;
      }
    }
  }

  if ((!title || ['candidate profile', 'candidate', 'professional role', 'software engineer'].includes(title.toLowerCase())) && experience.length > 0) {
    if (experience[0].title && !['role', 'position', 'candidate'].includes(experience[0].title.toLowerCase())) {
      title = experience[0].title;
    }
  }

  const cleanName = c.name && c.name.trim() && c.name.toLowerCase() !== 'candidate'
    ? c.name.trim()
    : (c.resume_file_url ? c.resume_file_url.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ') : 'Candidate Profile');

  return {
    id: c.id,
    jobId: associatedJobId,
    name: cleanName,
    email: c.email || '',
    phone: c.phone || '',
    location: location || 'Remote',
    totalExperience: totalExp || (experience.length ? `${experience.length * 2} yrs` : '3 yrs'),
    relevantExperience: totalExp || '3 yrs',
    currentTitle: title || 'Software Professional',
    currentCompany: company || '',
    summary: summary || '',
    professionalSummary: summary || '',
    skills,
    technologies: skills,
    tools: [],
    industries: [],
    education,
    certifications: c.certifications?.map((ct: any) => ct.certification) || [],
    languages: c.languages?.map((l: any) => l.language) || [],
    experience,
    gapAnalysis: calculateCareerGaps(experience, c.raw_text || ''),
    responsibilities: [],
    achievements: [],
    projects: c.projects?.map((p: any) => ({
      name: p.name || '',
      description: p.description || '',
      technologies: p.technologies || [],
    })) || [],
    rawText: c.raw_text || '',
    parsingStatus: (c.parsing_status as any) || 'PARSED',
    validationErrors: [],
    parsingMetadata: {
      fileName: c.resume_file_url || 'cv.pdf',
      fileType: 'application/pdf',
      pageCount: 1,
      extractionMethod: 'prisma-db',
      ocrUsed: false,
      characterCount: (c.raw_text || '').length,
      wordCount: (c.raw_text || '').split(/\s+/).filter(Boolean).length,
    },
    fileName: c.resume_file_url || 'cv.pdf',
    fileSize: 100000,
    fileHash: c.file_hash || undefined,
    uploadedAt: c.created_at ? c.created_at.toISOString() : new Date().toISOString(),
    uploadedBy: c.created_by,
    createdBy: c.created_by,
    ...(() => {
      const latestEval = Array.isArray(c.evaluations) && c.evaluations.length > 0 ? c.evaluations[0] : null;
      const latestApp = Array.isArray(c.applications) && c.applications.length > 0 ? c.applications[0] : null;
      const rawScore = latestEval?.score ?? latestEval?.atsScore ?? c.matchScore ?? c.atsScore ?? latestApp?.match_score;
      const hasScore = typeof rawScore === 'number' && !isNaN(rawScore);
      const evalDecision = latestEval?.decision || c.decision || (hasScore ? (rawScore >= 75 ? 'SUBMIT' : (rawScore >= 50 ? 'REVIEW' : 'DO NOT SUBMIT')) : undefined);
      return {
        matchScore: hasScore ? Math.round(rawScore) : undefined,
        atsScore: hasScore ? Math.round(rawScore) : undefined,
        decision: evalDecision,
        matchLevel: latestEval?.matchLevel || c.matchLevel,
        mandatoryCompliance: latestEval?.mandatoryCompliance || c.mandatoryCompliance,
      };
    })(),
  };
}

/**
/**
 * Get all candidates belonging to the Search Talent Pool (job_id IS NULL)
 * GET /api/candidates
 */
export const getAllCandidates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.userId || req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    let dbCandidates: CandidateRecord[] = [];
    if (!isAdmin && !currentUserId) {
      res.status(200).json({ success: true, count: 0, candidates: [] });
      return;
    }

    try {
      const poolWhere: any = {};
      if (!isAdmin) {
        poolWhere.created_by = currentUserId;
      } else if (req.user?.organizationId) {
        poolWhere.user = { organizationId: req.user.organizationId };
      }
      const candidatesFromDb = await prisma.candidate.findMany({
        where: poolWhere,
        include: {
          experiences: true,
          education: true,
          skills: true,
          certifications: true,
          languages: true,
          projects: true,
          evaluations: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          applications: {
            orderBy: { updated_at: 'desc' },
            take: 1
          }
        },
        orderBy: { created_at: 'desc' }
      });

      if (candidatesFromDb && candidatesFromDb.length > 0) {
        dbCandidates = candidatesFromDb.map((c: any) => mapDbCandidateToRecord(c, c.job_id || 'pool'));
      }
    } catch (dbErr) {
      console.warn('[Talent Pool Candidates] Database query error:', dbErr);
    }

    // Combine memory candidates across all jobs and pool matching this user/workspace
    const combinedMap = new Map<string, CandidateRecord>();
    for (const c of dbCandidates) {
      combinedMap.set(c.id, c);
    }
    for (const [jId, list] of CANDIDATE_STORE.entries()) {
      for (const c of list) {
        if (!isAdmin) {
          const ownerId = c.uploadedBy || c.createdBy;
          if (!ownerId || ownerId !== currentUserId) {
            continue;
          }
        }
        if (!combinedMap.has(c.id)) {
          combinedMap.set(c.id, c);
        }
      }
    }

    const rawList = Array.from(combinedMap.values());
    const seenKeys = new Set<string>();
    const resultList: CandidateRecord[] = [];

    for (const c of rawList) {
      const key = (c.email && c.email.trim().toLowerCase()) ||
                  (c.fileHash && c.fileHash.trim()) ||
                  (c.fileName && c.fileName.trim().toLowerCase()) ||
                  (c.name && c.name.trim().toLowerCase()) ||
                  c.id;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        resultList.push(c);
      }
    }

    res.json({
      success: true,
      total: resultList.length,
      candidates: resultList
    });
  } catch (error: any) {
    console.error('Error fetching talent pool candidates:', error);
    res.status(500).json({ error: 'Failed to retrieve talent pool candidates' });
  }
};

/**
 * Get all candidates associated with a specific Job
 * GET /api/jobs/:jobId/candidates
 */
export const getCandidatesForJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.jobId || '');
    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }

    if (jobId === 'all') {
      return getAllCandidates(req, res);
    }

    const isJobUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
    const currentUserId = req.user?.userId || req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (req.user && !isAdmin) {
      if (isJobUuid) {
        const checkJob = await prisma.job.findUnique({ where: { id: jobId }, select: { created_by: true } });
        if (checkJob && checkJob.created_by && checkJob.created_by !== currentUserId) {
          res.status(403).json({ error: 'Forbidden: Access restricted to the requisition owner.' });
          return;
        }
      } else {
        const gJob = GLOBAL_JOB_STORE.get(jobId);
        if (gJob) {
          const jobOwner = gJob.created_by || gJob.createdBy;
          if (jobOwner && jobOwner !== currentUserId) {
            res.status(403).json({ error: 'Forbidden: Access restricted to the requisition owner.' });
            return;
          }
        }
      }
    }

    let dbCandidates: CandidateRecord[] = [];
    if (isJobUuid) {
      try {
        const appWhere: any = { job_id: jobId };
        const directWhere: any = { job_id: jobId };

        const apps = await (prisma as any).candidateApplication?.findMany({
          where: appWhere,
          include: {
            candidate: {
              include: {
                experiences: true,
                education: true,
                skills: true,
                certifications: true,
                languages: true,
                projects: true,
                evaluations: {
                  where: { jobId },
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            }
          },
          orderBy: { created_at: 'desc' }
        });

        const directCands = await (prisma as any).candidate?.findMany({
          where: directWhere,
          include: {
            experiences: true,
            education: true,
            skills: true,
            certifications: true,
            languages: true,
            projects: true,
            evaluations: {
              where: { jobId },
              orderBy: { createdAt: 'desc' },
              take: 1
            },
            applications: {
              where: { job_id: jobId },
              orderBy: { updated_at: 'desc' },
              take: 1
            }
          },
          orderBy: { created_at: 'desc' }
        });

        const combinedCands: any[] = [];
        const seenCandIds = new Set<string>();

        if (apps && apps.length > 0) {
          for (const app of apps) {
            if (app.candidate && !seenCandIds.has(app.candidate.id)) {
              seenCandIds.add(app.candidate.id);
              combinedCands.push(app.candidate);
            }
          }
        }
        if (directCands && directCands.length > 0) {
          for (const c of directCands) {
            if (!seenCandIds.has(c.id)) {
              seenCandIds.add(c.id);
              combinedCands.push(c);
            }
          }
        }

        if (combinedCands.length > 0) {
          dbCandidates = combinedCands.map((c: any) => mapDbCandidateToRecord(c, jobId));
        }
      } catch (dbErr) {
        console.warn('[Candidates] Database query fallback to memory store:', dbErr);
      }
    }

    // 2. Check memory store (scoped to current user if not ADMIN)
    let memCandidates = CANDIDATE_STORE.get(jobId);
    if (!memCandidates) {
      memCandidates = [];
      CANDIDATE_STORE.set(jobId, memCandidates);
    }
    if (!isAdmin) {
      memCandidates = memCandidates.filter(c => {
        const owner = c.uploadedBy || c.createdBy;
        return Boolean(owner && owner === currentUserId);
      });
    }

    // Combine unique candidates (DB + Memory)
    const combinedMap = new Map<string, CandidateRecord>();
    for (const c of memCandidates) combinedMap.set(c.id, c);
    for (const c of dbCandidates) combinedMap.set(c.id, c);

    const rawList = Array.from(combinedMap.values());
    const seenKeys = new Set<string>();
    const resultList: CandidateRecord[] = [];

    for (const c of rawList) {
      const key = (c.email && c.email.trim().toLowerCase()) ||
                  (c.fileHash && c.fileHash.trim()) ||
                  (c.fileName && c.fileName.trim().toLowerCase()) ||
                  (c.name && c.name.trim().toLowerCase()) ||
                  c.id;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        resultList.push(c);
      }
    }

    // Enrich candidates with evaluations from DB or memory store (supports custom non-UUID IDs)
    let targetJob: any = await getJobFromStoreOrDb(jobId);
    if (!targetJob && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
      targetJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: { requirements: true }
      }).catch(() => null);
    }
    const jobTitle = targetJob?.position || targetJob?.title || 'Job Requisition';
    const jobClient = targetJob?.client || targetJob?.company || 'Enterprise Client';
    const reqs = (targetJob?.requirements && targetJob.requirements.length > 0)
      ? targetJob.requirements
      : ((targetJob?.extractedRequirements && targetJob.extractedRequirements.length > 0)
        ? targetJob.extractedRequirements
        : getStandardRequirementsForPosition(jobTitle, jobClient));

    const enrichedList = await Promise.all(resultList.map(async (c) => {
      let finalScore = (c as any).matchScore ?? (c as any).atsScore;
      let matchLevel = (c as any).matchLevel;
      let decision = (c as any).decision || (c as any).recommendation;
      let compliance = (c as any).mandatoryCompliance;

      // Check if existing evaluation has already run under the AI semantic engine (v5.0.0) for this specific job
      const evalJobTitle = (c as any).evaluation?.jobTitle || (c as any).evaluation?.position;
      const hasAiEvaluation = (c as any).evaluation?.scoringConfigVersion === '5.0.0-ai-semantic-matcher' &&
        (!evalJobTitle || evalJobTitle.toLowerCase() === jobTitle.toLowerCase());

      // If not yet evaluated by AI engine, run fresh AI evaluation against job requirements
      if ((!hasAiEvaluation || finalScore === undefined || req.query.fresh === 'true') && reqs.length > 0) {
        const jobData = {
          id: targetJob?.id || jobId,
          position: jobTitle,
          title: jobTitle,
          client: jobClient,
          company: jobClient,
        };
        const evalPayload = await evaluateCandidateAgainstRequirements(c, jobData, reqs);
        finalScore = evalPayload.overallScore ?? evalPayload.overallMatch ?? 0;
        matchLevel = evalPayload.matchLevel;
        decision = evalPayload.recommendation || (finalScore >= 65 ? 'SUBMIT' : finalScore >= 50 ? 'REVIEW' : 'DO NOT SUBMIT');
        compliance = evalPayload.mandatoryCompliance
          ? `${evalPayload.mandatoryCompliance.met}/${evalPayload.mandatoryCompliance.total}`
          : 'N/A';
        
        // Update in-memory candidate cache so next request is fast
        (c as any).matchScore = finalScore;
        (c as any).atsScore = finalScore;
        (c as any).matchLevel = matchLevel;
        (c as any).decision = decision;
        (c as any).recommendation = decision;
        (c as any).mandatoryCompliance = compliance;
        (c as any).evaluation = {
          ...evalPayload,
          jobTitle,
          scoringConfigVersion: '5.0.0-ai-semantic-matcher'
        };

        // Persist to database candidate application & evaluation
        if (isJobUuid && c.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id)) {
          const stage = finalScore >= 80 ? 'SHORTLISTED' : (finalScore >= 55 ? 'REVIEW' : 'REJECTED');
          prisma.candidateApplication.upsert({
            where: {
              job_id_candidate_id: {
                job_id: jobId,
                candidate_id: c.id
              }
            },
            update: {
              match_score: finalScore,
              stage,
              status: 'active'
            },
            create: {
              job_id: jobId,
              candidate_id: c.id,
              match_score: finalScore,
              stage,
              status: 'active'
            }
          }).catch(() => null);

          if (currentUserId) {
            prisma.evaluation.findFirst({
              where: {
                candidateId: c.id,
                jobId: jobId
              },
              orderBy: { createdAt: 'desc' }
            }).then(async (existing) => {
              if (existing) {
                await prisma.evaluation.update({
                  where: { id: existing.id },
                  data: {
                    score: finalScore,
                    atsScore: finalScore,
                    decision,
                    matchLevel,
                    status: 'COMPLETED',
                    updatedAt: new Date()
                  }
                }).catch(() => null);
                // Clean up any extra duplicate evaluations for this candidate and job
                await prisma.evaluation.deleteMany({
                  where: {
                    candidateId: c.id,
                    jobId: jobId,
                    id: { not: existing.id }
                  }
                }).catch(() => null);
              } else {
                await prisma.evaluation.create({
                  data: {
                    candidateId: c.id,
                    jobId: jobId,
                    score: finalScore,
                    atsScore: finalScore,
                    decision,
                    matchLevel,
                    evaluatedBy: currentUserId,
                    createdByUserId: currentUserId,
                    organizationId: req.user?.organizationId || 'org-tasknera',
                    status: 'COMPLETED'
                  }
                }).catch(() => null);
              }
            }).catch(() => null);
          }
        }
      }

      const resolvedScore = typeof finalScore === 'number' ? Math.round(finalScore) : (typeof (c as any).matchScore === 'number' ? Math.round((c as any).matchScore) : undefined);
      const effectiveDecision = decision || (c as any).decision || (c as any).recommendation;
      const resolvedDecision = effectiveDecision
        ? (effectiveDecision === 'DO NOT SUBMIT' ? 'REJECT' : (effectiveDecision === 'ACCEPT' ? 'SUBMIT' : effectiveDecision))
        : (resolvedScore !== undefined ? (resolvedScore >= 75 ? 'SUBMIT' : (resolvedScore >= 50 ? 'REVIEW' : 'REJECT')) : 'REVIEW');
      const resolvedLevel = matchLevel || (c as any).matchLevel || (resolvedScore !== undefined ? (resolvedScore >= 75 ? 'STRONG MATCH' : (resolvedScore >= 50 ? 'MODERATE MATCH' : 'LOW FIT')) : undefined);

      return {
        ...c,
        matchScore: resolvedScore,
        atsScore: resolvedScore,
        matchLevel: resolvedLevel,
        decision: resolvedDecision,
        recommendation: resolvedDecision,
        mandatoryCompliance: compliance || (c as any).mandatoryCompliance || 'N/A'
      };
    }));

    res.json({
      success: true,
      jobId,
      total: enrichedList.length,
      parsedCount: enrichedList.filter(c => c.parsingStatus === 'PARSED').length,
      processingCount: enrichedList.filter(c => c.parsingStatus === 'PROCESSING' || c.parsingStatus === 'UPLOADED').length,
      failedCount: enrichedList.filter(c => c.parsingStatus === 'FAILED').length,
      candidates: enrichedList
    });
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ error: 'Failed to retrieve candidates for job' });
  }
};

/**
 * Get single candidate details
 * GET /api/jobs/:jobId/candidates/:candidateId
 */
export const getCandidateById = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.jobId || '');
    const candidateId = String(req.params.candidateId || '');

    // Check memory store
    const candidates = CANDIDATE_STORE.get(jobId);
    const candidate = candidates?.find(c => c.id === candidateId) || GLOBAL_CANDIDATES.get(candidateId);

    if (candidate) {
      res.json({
        success: true,
        jobId,
        candidate
      });
      return;
    }

    // Try DB if candidateId is a valid UUID
    const isCandidateUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId);
    if (isCandidateUuid) {
      try {
        const c = await prisma.candidate.findUnique({
          where: { id: candidateId },
        include: {
          experiences: true,
          education: true,
          skills: true,
          certifications: true,
          languages: true,
          projects: true,
        }
      });
      if (c) {
        const record = mapDbCandidateToRecord(c, jobId);
        res.json({ success: true, jobId, candidate: record });
        return;
      }
      } catch (e) {
        console.warn('[Candidate Detail] DB lookup error:', e);
      }
    }

    res.status(404).json({ error: 'Candidate profile not found' });
  } catch (error: any) {
    console.error('Error fetching candidate detail:', error);
    res.status(500).json({ error: 'Failed to retrieve candidate profile' });
  }
};

/**
 * Bulk upload CVs for a specific job
/**
 * Bulk upload CVs for a specific job
 * POST /api/jobs/:jobId/candidates/upload
 * Supports multi-part form data array of file inputs ('files' or 'files[]')
 */
export const uploadCandidateCVs = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramJobId = String(req.params.jobId || req.body?.jobId || '').trim();
    const isPoolUpload = !paramJobId || paramJobId.toLowerCase() === 'pool' || paramJobId === 'all';
    const jobId = isPoolUpload ? 'pool' : paramJobId;
    const dbJobId = (!isPoolUpload && jobId && jobId !== 'pool' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) ? jobId : null;
    
    // Support files from multer array, any fields, or single file fallback
    let files: Express.Multer.File[] = [];
    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (req.files && typeof req.files === 'object') {
      // If multer.fields was used
      const filesObj = req.files as Record<string, Express.Multer.File[]>;
      for (const fieldKey of Object.keys(filesObj)) {
        if (Array.isArray(filesObj[fieldKey])) {
          files.push(...filesObj[fieldKey]);
        }
      }
    } else if (req.file) {
      files = [req.file];
    }

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided for candidate CV upload. Ensure field is named "files" or "files[]"' });
      return;
    }

    console.log(`\n=============================================================`);
    console.log(`[Batch CV Upload] Received ${files.length} file(s) for Job ID: ${jobId}`);
    console.log(`=============================================================`);

    let existingCandidates = CANDIDATE_STORE.get(jobId);
    if (!existingCandidates) {
      existingCandidates = DEFAULT_INITIAL_CANDIDATES[jobId] ? [...DEFAULT_INITIAL_CANDIDATES[jobId]] : [];
      CANDIDATE_STORE.set(jobId, existingCandidates);
    }

    const processedCandidates: CandidateRecord[] = [];
    const candidateIds: string[] = [];

    // Find default user or authenticated user for database attribution
    // Order of priority: 1. Authenticated user from JWT (verified in DB) -> 2. Job Creator from DB -> 3. Fallback user
    let defaultUserId: string | null = null;
    try {
      const authUser = (req as any).user;
      const potentialUserId = authUser?.userId || authUser?.id || null;
      if (potentialUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialUserId)) {
        const existingUser = await prisma.user.findUnique({ where: { id: potentialUserId } });
        if (existingUser) {
          defaultUserId = existingUser.id;
        }
      }

      if (!defaultUserId && dbJobId) {
        const jobRecord = await prisma.job.findUnique({ where: { id: dbJobId }, select: { created_by: true } });
        if (jobRecord?.created_by) {
          const jobUser = await prisma.user.findUnique({ where: { id: jobRecord.created_by } });
          if (jobUser) {
            defaultUserId = jobUser.id;
          }
        }
      }

      if (!defaultUserId) {
        let fallbackUser = await prisma.user.findFirst();
        if (!fallbackUser) {
          fallbackUser = await prisma.user.create({
            data: {
              email: 'recruiter@tasknera.com',
              name: 'Tasknera Recruiter',
              password: '$2a$10$wT55K2eF59PGBgPvdA.m6.4sO0iJt.4Ew1Y1iO4cZg3GzE7l0zF3C',
              role: 'ADMIN',
            }
          }).catch(() => null);
        }
        if (fallbackUser) {
          defaultUserId = fallbackUser.id;
        }
      }
    } catch (userLookupErr) {
      console.warn('[Prisma User Attribution Warning]:', userLookupErr);
    }

    // Process each uploaded CV file
    for (const file of files) {
      const fileName = file.originalname || 'uploaded_cv.pdf';
      const fileSize = file.size;
      const fileMime = file.mimetype || 'application/pdf';
      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const fileMd5 = crypto.createHash('md5').update(file.buffer).digest('hex');

      console.log(`\n--- [Processing File] ${fileName} (${fileSize} bytes, Hash: ${fileHash.substring(0, 10)}) ---`);
      
      // ── DUPLICATE CANDIDATE CHECK (FILE HASH / FILENAME / CLIENT VALIDATION) ──
      const normalizedFileName = fileName.trim().toLowerCase();
      const existingInJob = existingCandidates.find(c =>
        (c.fileHash && (c.fileHash === fileHash || c.fileHash === fileMd5)) ||
        (c.fileName && c.fileName.trim().toLowerCase() === normalizedFileName) ||
        (c.name && normalizedFileName.includes(c.name.trim().toLowerCase()) && c.name.trim().length > 3)
      );

      let existingDbCandidate: any = null;
      if (!existingInJob) {
        try {
          existingDbCandidate = await prisma.candidate.findFirst({
            where: {
              ...(defaultUserId ? { created_by: defaultUserId } : {}),
              OR: [
                { file_hash: fileHash },
                { file_hash: fileMd5 },
                { resume_file_url: fileName }
              ]
            },
            include: {
              applications: true,
              experiences: true,
              education: true,
              skills: true,
            }
          });
        } catch {
          // Fallback to memory store if DB lookup fails
        }
      }

      const existingMemProfile = GLOBAL_CANDIDATES.get(fileHash) || GLOBAL_CANDIDATES.get(fileMd5);
      const isMemOwner = !existingMemProfile || !defaultUserId || existingMemProfile.uploadedBy === defaultUserId || existingMemProfile.createdBy === defaultUserId;
      const validMemProfile = isMemOwner ? existingMemProfile : null;

      const existingProfile = existingInJob || validMemProfile || (existingDbCandidate ? {
        id: existingDbCandidate.id,
        jobId,
        name: existingDbCandidate.name,
        email: existingDbCandidate.email,
        phone: existingDbCandidate.phone,
        location: existingDbCandidate.location,
        totalExperience: existingDbCandidate.total_experience,
        relevantExperience: existingDbCandidate.total_experience,
        currentTitle: existingDbCandidate.current_title,
        currentCompany: existingDbCandidate.current_company,
        summary: existingDbCandidate.summary,
        professionalSummary: existingDbCandidate.summary,
        skills: existingDbCandidate.skills?.map((s: any) => s.skill) || [],
        technologies: existingDbCandidate.skills?.map((s: any) => s.skill) || [],
        tools: [],
        industries: [],
        education: existingDbCandidate.education?.map((e: any) => ({
          degree: e.degree,
          institution: e.institution,
          field: e.field,
          year: e.start_year ? `${e.start_year}` : undefined,
        })) || [],
        certifications: [],
        languages: [],
        experience: existingDbCandidate.experiences?.map((ex: any) => ({
          title: ex.title,
          company: ex.company,
          startDate: ex.start_date,
          endDate: ex.end_date,
          duration: ex.duration,
          description: ex.description,
        })) || [],
        responsibilities: [],
        achievements: [],
        projects: [],
        rawText: existingDbCandidate.raw_text || '',
        parsingStatus: 'PARSED' as const,
        validationErrors: [],
        parsingMetadata: {
          fileName,
          fileType: fileMime,
          pageCount: 1,
          extractionMethod: 'cached-duplicate',
          ocrUsed: false,
          characterCount: (existingDbCandidate.raw_text || '').length,
          wordCount: 0,
        },
        fileName,
        fileSize,
        fileHash,
        uploadedAt: existingDbCandidate.created_at.toISOString(),
        isDuplicate: true,
      } : null);

      if (existingProfile) {
        console.log(`[CV Processing] Existing CV detected for: ${fileName}.`);
        const existingCandId = existingDbCandidate?.id || existingProfile.id;
        
        // 1. If uploading to Talent Pool and candidate already exists:
        if (isPoolUpload) {
          const dupCandidate: CandidateRecord = {
            ...existingProfile,
            jobId: 'pool',
            isDuplicate: true,
            parsingStatus: 'DUPLICATE' as any,
            errorMessage: 'Duplicate CV: This candidate already exists in the Talent Pool.',
            fileName,
            fileSize,
            fileHash,
          };
          processedCandidates.push(dupCandidate);
          candidateIds.push(existingCandId);

          if (files.length === 1) {
            res.status(200).json({
              status: 'duplicate',
              message: 'Candidate CV already exists in the Talent Pool',
              isDuplicate: true,
              candidate: dupCandidate,
              candidates: [dupCandidate],
              allCandidates: existingCandidates
            });
            return;
          }
          continue;
        }

        // 2. If uploading to a specific Job:
        const isAlreadyInJob = existingInJob || (existingDbCandidate && (
          existingDbCandidate.job_id === jobId ||
          (existingDbCandidate.applications && existingDbCandidate.applications.some((a: any) => a.job_id === jobId))
        ));

        if (isAlreadyInJob) {
          const dupCandidate: CandidateRecord = {
            ...existingProfile,
            jobId,
            isDuplicate: true,
            parsingStatus: 'DUPLICATE' as any,
            errorMessage: 'This CV is already uploaded to this JD.',
            fileName,
            fileSize,
            fileHash,
          };
          processedCandidates.push(dupCandidate);
          candidateIds.push(existingCandId);

          if (files.length === 1) {
            res.status(200).json({
              status: 'duplicate',
              message: 'This CV is already uploaded to this JD.',
              isDuplicate: true,
              candidate: dupCandidate,
              candidates: [dupCandidate],
              allCandidates: existingCandidates
            });
            return;
          }
          continue;
        }

        // Candidate exists in database / pool but NOT in this job yet -> Link to this job via Application without duplicating candidate row
        try {
          if (existingCandId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingCandId) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
            await (prisma as any).candidateApplication.upsert({
              where: {
                job_id_candidate_id: {
                  job_id: jobId,
                  candidate_id: existingCandId
                }
              },
              update: {
                stage: 'PARSED',
                status: 'active'
              },
              create: {
                job_id: jobId,
                candidate_id: existingCandId,
                stage: 'PARSED',
                status: 'active'
              }
            }).catch(() => null);

            await prisma.candidate.update({
              where: { id: existingCandId },
              data: { job_id: jobId }
            }).catch(() => null);
          }
        } catch (linkErr) {
          console.warn('[CV Upload] Link existing candidate to job note:', linkErr);
        }

        const linkedRecord: CandidateRecord = {
          ...existingProfile,
          jobId,
          isDuplicate: false,
          parsingStatus: 'PARSED',
          fileName,
          fileSize,
          fileHash,
          uploadedAt: new Date().toISOString()
        };

        existingCandidates.push(linkedRecord);
        processedCandidates.push(linkedRecord);
        candidateIds.push(existingCandId);

        if (files.length === 1) {
          res.status(200).json({
            status: 'success',
            message: 'Candidate added to this position successfully (reused existing verified profile)',
            candidate: linkedRecord,
            candidates: [linkedRecord],
            allCandidates: existingCandidates
          });
          return;
        }
        continue;
      }

      const candidateId = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      candidateIds.push(candidateId);

      // Step 0: Record initial candidate in Prisma database with status PROCESSING
      let dbCandidateId: string | null = null;
      const dbJobId = (!isPoolUpload && jobId && jobId !== 'pool' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) ? jobId : null;
      if (defaultUserId) {
        try {
          const initialDbCand = await prisma.candidate.create({
            data: {
              job_id: dbJobId,
              name: fileName.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' '),
              resume_file_url: fileName,
              file_hash: fileHash,
              parsing_status: 'PROCESSING',
              created_by: defaultUserId,
            }
          });
          dbCandidateId = initialDbCand.id;
          console.log(`[Prisma DB] Stored initial candidate record ${dbCandidateId} (job_id: ${dbJobId || 'POOL'}) with status PROCESSING`);
        } catch (dbInitErr) {
          console.warn('[Prisma DB Init Notice] Initial candidate record creation bypassed:', dbInitErr);
        }
      }

      try {
        // Step 1: Extract text via Python FastAPI Document processor
        console.log(`[CV Processing Step 1] Passing file buffer directly to Python document processor on port 8000 for ${fileName}...`);
        const pythonResult: PythonDocumentResponse = await extractDocumentTextViaPython(
          file.buffer,
          fileName,
          fileMime
        );

        let rawText = '';
        let extractionMethod = pythonResult.extractionMethod || 'direct-text';
        let pageCount = pythonResult.pageCount || 1;
        let ocrUsed = pythonResult.ocrUsed || false;
        let charCount = pythonResult.characterCount || 0;
        let wordCount = pythonResult.wordCount || 0;

        if (pythonResult.success && pythonResult.text && pythonResult.text.trim().length > 20) {
          rawText = pythonResult.normalizedText || pythonResult.text;
        }

        // Step 2: Quality validation of raw extracted text
        const textQuality = validateCvTextQuality(rawText);
        console.log(`[CV Processing Step 2] Extracted ${rawText.length} chars. Quality check valid: ${textQuality.isValid} (Reason: ${textQuality.reason || 'OK'})`);

        if (!rawText || !textQuality.isValid) {
          console.warn(`[CV Processing FAILED] Rejected document ${fileName}: ${textQuality.reason || 'Insufficient text'}`);
          const failRecord: CandidateRecord = {
            id: dbCandidateId || candidateId,
            jobId,
            name: null,
            email: null,
            phone: null,
            location: null,
            currentTitle: null,
            currentCompany: null,
            totalExperience: null,
            relevantExperience: null,
            summary: null,
            skills: [],
            technologies: [],
            tools: [],
            industries: [],
            education: [],
            certifications: [],
            languages: [],
            experience: [],
            responsibilities: [],
            achievements: [],
            projects: [],
            sourceEvidence: {},
            rawText: rawText || '',
            parsingStatus: 'FAILED',
            errorMessage: textQuality.reason || 'Extracted document text was unreadable or failed validation.',
            validationErrors: [textQuality.reason || 'Failed quality threshold check.'],
            parsingMetadata: {
              fileName,
              fileType: fileMime,
              pageCount,
              extractionMethod: `${extractionMethod}-rejected`,
              ocrUsed,
              characterCount: charCount,
              wordCount,
            },
            fileName,
            fileSize,
            fileHash,
            uploadedAt: new Date().toISOString(),
          };

          if (dbCandidateId) {
            await prisma.candidate.update({
              where: { id: dbCandidateId },
              data: {
                parsing_status: 'FAILED',
                error_message: textQuality.reason || 'Extracted document text was unreadable',
                raw_text: rawText || '',
              }
            }).catch(() => null);
          }

          existingCandidates.unshift(failRecord);
          processedCandidates.push(failRecord);
          continue;
        }

        // Step 3: Extract structured fields from validated text
        const structuredProfile = extractStructuredCandidateFromText(rawText, fileName, {
          fileType: fileMime,
          pageCount,
          extractionMethod,
          ocrUsed,
          characterCount: charCount,
          wordCount,
        });

        // Step 3a: Prioritize and blend document processor extractions if available
        if (pythonResult.candidateName && pythonResult.candidateName.trim() && pythonResult.candidateName !== 'Candidate') {
          structuredProfile.name = pythonResult.candidateName.trim();
        }
        if (pythonResult.email && pythonResult.email.includes('@')) {
          structuredProfile.email = pythonResult.email.trim();
        }
        if (pythonResult.phone) {
          structuredProfile.phone = pythonResult.phone.trim();
        }
        if (pythonResult.skills && pythonResult.skills.length > 0) {
          const mergedSkills = Array.from(new Set([...(pythonResult.skills || []), ...structuredProfile.skills]));
          structuredProfile.skills = mergedSkills;
          structuredProfile.technologies = mergedSkills;
        }
        if (pythonResult.yearsOfExperience) {
          structuredProfile.totalExperience = String(pythonResult.yearsOfExperience);
          structuredProfile.relevantExperience = String(pythonResult.yearsOfExperience);
        }
        if (pythonResult.currentTitle) {
          structuredProfile.currentTitle = pythonResult.currentTitle;
        }
        if (pythonResult.currentCompany) {
          structuredProfile.currentCompany = pythonResult.currentCompany;
        }
        if (pythonResult.summary) {
          structuredProfile.summary = pythonResult.summary;
          structuredProfile.professionalSummary = pythonResult.summary;
        }

        console.log(`[CV Processing Step 4] Structured Extraction for ${fileName}:`, {
          name: structuredProfile.name,
          email: structuredProfile.email,
          currentTitle: structuredProfile.currentTitle,
          currentCompany: structuredProfile.currentCompany,
          skillsCount: structuredProfile.skills.length,
          expCount: structuredProfile.experience.length,
        });

        // Step 3b: Check if candidate already exists in current job by extracted details
        const dupInJob = existingCandidates.find(ec =>
          (structuredProfile.email && ec.email && ec.email.toLowerCase() === structuredProfile.email.toLowerCase()) ||
          (structuredProfile.phone && ec.phone && ec.phone.replace(/[^0-9]/g, '') === structuredProfile.phone.replace(/[^0-9]/g, '') && structuredProfile.phone.length > 5) ||
          (structuredProfile.name && ec.name && ec.name.trim().toLowerCase() === structuredProfile.name.trim().toLowerCase())
        );

        if (dupInJob) {
          console.log(`[CV Processing] Duplicate candidate profile detected in job for: ${structuredProfile.name}. Skipping insertion.`);
          if (dbCandidateId) {
            await prisma.candidate.delete({ where: { id: dbCandidateId } }).catch(() => null);
          }

          const dupRecord: CandidateRecord = {
            ...dupInJob,
            jobId,
            isDuplicate: true,
            parsingStatus: 'DUPLICATE' as any,
            errorMessage: 'This CV is already uploaded to this JD.',
            fileName,
            fileSize,
            fileHash,
          };

          processedCandidates.push(dupRecord);

          if (files.length === 1) {
            res.status(200).json({
              status: 'duplicate',
              message: 'This CV is already uploaded to this JD.',
              isDuplicate: true,
              candidate: dupRecord,
              candidates: [dupRecord],
              allCandidates: existingCandidates,
            });
            return;
          }
          continue;
        }

        // Check if candidate exists in Prisma DB for this user/client
        if (structuredProfile.email || structuredProfile.phone) {
          try {
            const existingByEmailOrPhone = await prisma.candidate.findFirst({
              where: {
                AND: [
                  ...(defaultUserId ? [{ created_by: defaultUserId }] : []),
                  {
                    OR: [
                      ...(structuredProfile.email ? [{ email: { equals: structuredProfile.email, mode: 'insensitive' as const } }] : []),
                      ...(structuredProfile.phone ? [{ phone: structuredProfile.phone }] : [])
                    ]
                  }
                ]
              },
              include: {
                applications: true
              }
            });

            if (existingByEmailOrPhone) {
              const isLinkedToThisJob = existingByEmailOrPhone.job_id === jobId ||
                (existingByEmailOrPhone.applications && existingByEmailOrPhone.applications.some((a: any) => a.job_id === jobId)) ||
                existingCandidates.some(c => c.id === existingByEmailOrPhone.id || (c.email && c.email.toLowerCase() === structuredProfile.email?.toLowerCase()));

              if (isLinkedToThisJob) {
                console.log(`[CV Processing] Candidate already linked to this job (ID: ${existingByEmailOrPhone.id}).`);
                if (dbCandidateId && dbCandidateId !== existingByEmailOrPhone.id) {
                  await prisma.candidate.delete({ where: { id: dbCandidateId } }).catch(() => null);
                }

                const dupRecord: CandidateRecord = {
                  id: existingByEmailOrPhone.id,
                  jobId,
                  ...structuredProfile,
                  isDuplicate: true,
                  parsingStatus: 'DUPLICATE' as any,
                  errorMessage: 'This CV is already uploaded to this JD.',
                  fileName,
                  fileSize,
                  fileHash,
                  uploadedAt: existingByEmailOrPhone.created_at.toISOString(),
                };

                processedCandidates.push(dupRecord);

                if (files.length === 1) {
                  res.status(200).json({
                    status: 'duplicate',
                    message: 'This CV is already uploaded to this JD.',
                    isDuplicate: true,
                    candidate: dupRecord,
                    candidates: [dupRecord],
                    allCandidates: existingCandidates,
                  });
                  return;
                }
                continue;
              } else {
                // Allowed for this new JD! Link to this position without duplication
                console.log(`[CV Processing] Candidate exists from another JD (ID: ${existingByEmailOrPhone.id}). Linking to new JD: ${jobId}`);
                if (dbCandidateId && dbCandidateId !== existingByEmailOrPhone.id) {
                  await prisma.candidate.delete({ where: { id: dbCandidateId } }).catch(() => null);
                }
                if (dbJobId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingByEmailOrPhone.id)) {
                  await (prisma as any).candidateApplication.upsert({
                    where: {
                      job_id_candidate_id: {
                        job_id: dbJobId,
                        candidate_id: existingByEmailOrPhone.id
                      }
                    },
                    update: { stage: 'PARSED', status: 'active' },
                    create: { job_id: dbJobId, candidate_id: existingByEmailOrPhone.id, stage: 'PARSED', status: 'active' }
                  }).catch(() => null);
                }

                const linkedRecord: CandidateRecord = {
                  id: existingByEmailOrPhone.id,
                  jobId,
                  ...structuredProfile,
                  isDuplicate: false,
                  parsingStatus: 'PARSED',
                  fileName,
                  fileSize,
                  fileHash,
                  uploadedAt: new Date().toISOString(),
                };

                existingCandidates.unshift(linkedRecord);
                processedCandidates.push(linkedRecord);
                candidateIds.push(existingByEmailOrPhone.id);

                if (files.length === 1) {
                  res.status(200).json({
                    status: 'success',
                    message: 'Candidate added to this position successfully',
                    isDuplicate: false,
                    candidate: linkedRecord,
                    candidates: [linkedRecord],
                    allCandidates: existingCandidates,
                  });
                  return;
                }
                continue;
              }
            }
          } catch (dupLookupErr) {
            console.warn('[Duplicate Check] Email/Phone lookup note:', dupLookupErr);
          }
        }


        const actualUser = (req as any).user?.userId || (req as any).user?.id;
        const uploaderId = actualUser || defaultUserId || undefined;
        const newRecord: CandidateRecord = {
          id: dbCandidateId || candidateId,
          jobId,
          ...structuredProfile,
          fileName,
          fileSize,
          fileHash,
          uploadedAt: new Date().toISOString(),
          uploadedBy: uploaderId,
          createdBy: uploaderId,
        };

        // Cache globally for duplicate detection across jobs
        GLOBAL_CANDIDATES.set(fileHash, newRecord);
        GLOBAL_CANDIDATES.set(newRecord.id, newRecord);

        // Update / Persist full candidate metadata into Prisma database
        try {
          if (dbCandidateId) {
            await prisma.candidate.update({
              where: { id: dbCandidateId },
              data: {
                name: newRecord.name,
                email: newRecord.email,
                phone: newRecord.phone,
                location: newRecord.location,
                total_experience: newRecord.totalExperience,
                current_title: newRecord.currentTitle,
                current_company: newRecord.currentCompany,
                summary: newRecord.summary,
                raw_text: rawText,
                parsing_status: 'PARSED',
              }
            });

            // Link candidate to job application record if job exists
            const validJob = await prisma.job.findUnique({ where: { id: jobId } }).catch(() => null);
            if (validJob) {
              await prisma.candidateApplication.upsert({
                where: {
                  job_id_candidate_id: {
                    job_id: validJob.id,
                    candidate_id: dbCandidateId,
                  }
                },
                update: {
                  stage: 'PARSED',
                  status: 'active',
                },
                create: {
                  job_id: validJob.id,
                  candidate_id: dbCandidateId,
                  stage: 'PARSED',
                  status: 'active',
                }
              }).catch(() => null);
            }
          } else if (defaultUserId) {
            const createdDbCand = await prisma.candidate.create({
              data: {
                job_id: jobId.includes('-') && jobId.length === 36 ? jobId : undefined,
                name: newRecord.name,
                email: newRecord.email,
                phone: newRecord.phone,
                location: newRecord.location,
                total_experience: newRecord.totalExperience,
                current_title: newRecord.currentTitle,
                current_company: newRecord.currentCompany,
                summary: newRecord.summary,
                resume_file_url: fileName,
                raw_text: rawText,
                file_hash: fileHash,
                parsing_status: 'PARSED',
                created_by: defaultUserId,
              }
            });
            newRecord.id = createdDbCand.id;
          }

          const targetId = dbCandidateId || newRecord.id;
          if (targetId && targetId.length === 36) {
            // Save child skills
            if (newRecord.skills && newRecord.skills.length > 0) {
              await prisma.candidateSkill.deleteMany({ where: { candidate_id: targetId } }).catch(() => null);
              await prisma.candidateSkill.createMany({
                data: newRecord.skills.map(s => ({ candidate_id: targetId, skill: s })),
                skipDuplicates: true,
              }).catch(() => null);
            }
            // Save child experiences
            if (newRecord.experience && newRecord.experience.length > 0) {
              await prisma.candidateExperience.deleteMany({ where: { candidate_id: targetId } }).catch(() => null);
              await prisma.candidateExperience.createMany({
                data: newRecord.experience.map(ex => ({
                  candidate_id: targetId,
                  company: ex.company || 'Company',
                  title: ex.title || 'Role',
                  duration: ex.duration || '',
                  description: ex.description || '',
                  start_date: ex.startDate || '',
                  end_date: ex.endDate || '',
                })),
                skipDuplicates: true,
              }).catch(() => null);
            }
            // Save child education
            if (newRecord.education && newRecord.education.length > 0) {
              await prisma.candidateEducation.deleteMany({ where: { candidate_id: targetId } }).catch(() => null);
              await prisma.candidateEducation.createMany({
                data: newRecord.education.map(e => ({
                  candidate_id: targetId,
                  degree: e.degree || 'Degree',
                  institution: e.institution || 'Institution',
                  field: e.field || '',
                })),
                skipDuplicates: true,
              }).catch(() => null);
            }
          }
                 // Automatically evaluate candidate against job requirements upon upload to requisition
          if (jobId && jobId !== 'pool') {
            try {
              let targetJob: any = await getJobFromStoreOrDb(jobId);
              if (!targetJob && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
                targetJob = await prisma.job.findUnique({
                  where: { id: jobId },
                  include: { requirements: true, user: true }
                }).catch(() => null);
              }

              const reqJobPosition = (req.body?.jobPosition || req.body?.position || '').trim();
              const reqJobClient = (req.body?.jobClient || req.body?.client || '').trim();

              let customReqs: any[] = [];
              if (req.body?.requirements) {
                try {
                  const parsed = typeof req.body.requirements === 'string' ? JSON.parse(req.body.requirements) : req.body.requirements;
                  if (Array.isArray(parsed) && parsed.length > 0) customReqs = parsed;
                } catch {}
              }

              const jobTitle = targetJob?.position || targetJob?.title || reqJobPosition || 'Job Requisition';
              const jobClient = targetJob?.client || targetJob?.company || reqJobClient || 'Client Organization';
              let reqs: any[] = (targetJob?.requirements && targetJob.requirements.length > 0)
                ? targetJob.requirements
                : (customReqs.length > 0 ? customReqs : getStandardRequirementsForPosition(jobTitle, jobClient));

              if (!targetJob && (reqJobPosition || customReqs.length > 0)) {
                targetJob = {
                  id: jobId,
                  position: jobTitle,
                  title: jobTitle,
                  client: jobClient,
                  company: jobClient,
                  requirements: reqs
                };
                GLOBAL_JOB_STORE.set(jobId, targetJob);
              }

              if (reqs.length > 0) {
                const jobData = {
                  id: targetJob?.id || jobId,
                  position: jobTitle,
                  title: jobTitle,
                  client: jobClient,
                  company: jobClient,
                  jd_text: targetJob?.jd_text || undefined,
                  created_by: targetJob?.created_by || defaultUserId
                };

                const evalPayload = await evaluateCandidateAgainstRequirements(newRecord, jobData, reqs);
                const finalScore = evalPayload.overallScore ?? evalPayload.overallMatch ?? 0;
                const complianceStr = evalPayload.mandatoryCompliance
                  ? `${evalPayload.mandatoryCompliance.met}/${evalPayload.mandatoryCompliance.total}`
                  : 'N/A';
                const decision = evalPayload.recommendation || (finalScore >= 80 ? 'SUBMIT' : (finalScore >= 60 ? 'REVIEW' : 'DO NOT SUBMIT'));

                // Attach evaluation directly to newRecord so candidate object returned in API has scores!
                (newRecord as any).matchScore = finalScore;
                (newRecord as any).atsScore = evalPayload.atsScore ?? finalScore;
                (newRecord as any).matchLevel = evalPayload.matchLevel;
                (newRecord as any).mandatoryCompliance = complianceStr;
                (newRecord as any).decision = decision;
                (newRecord as any).recommendation = decision;
                (newRecord as any).evaluation = evalPayload;

                // Save permanently to database with evaluatedBy attribution
                try {
                  const evalOwner = (req as any).user?.userId || defaultUserId;
                  const orgId = (req as any).user?.organizationId || targetJob?.user?.organizationId || 'org-tasknera';

                  if (evalOwner) {
                    // 1. Ensure backing DB Job exists
                    let dbJobRecord = targetJob;
                    if (!dbJobRecord?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbJobRecord.id)) {
                      dbJobRecord = await prisma.job.findFirst({
                        where: {
                          created_by: evalOwner,
                          position: jobTitle
                        }
                      }).catch(() => null);

                      if (!dbJobRecord) {
                        dbJobRecord = await prisma.job.create({
                          data: {
                            client: jobClient,
                            position: jobTitle,
                            created_by: evalOwner,
                            status: 'active'
                          }
                        }).catch(() => null);
                      }
                    }

                    // 2. Ensure backing DB Candidate exists
                    let validCandId = targetId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId) ? targetId : null;
                    if (!validCandId) {
                      const dbCand = await prisma.candidate.create({
                        data: {
                          name: newRecord.name || 'Candidate',
                          email: newRecord.email || null,
                          phone: newRecord.phone || null,
                          location: newRecord.location || null,
                          current_title: newRecord.currentTitle || null,
                          current_company: newRecord.currentCompany || null,
                          total_experience: newRecord.totalExperience || null,
                          summary: newRecord.summary || null,
                          raw_text: rawText || '',
                          resume_file_url: fileName,
                          file_hash: fileHash,
                          parsing_status: 'PARSED',
                          created_by: evalOwner
                        }
                      }).catch(() => null);
                      if (dbCand) validCandId = dbCand.id;
                    }

                    // 3. Upsert Evaluation record in PostgreSQL
                    if (dbJobRecord?.id && validCandId) {
                      const existingCandidateEval = await prisma.evaluation.findFirst({
                        where: {
                          candidateId: validCandId,
                          jobId: dbJobRecord.id,
                          OR: [
                            { evaluatedBy: evalOwner },
                            { createdByUserId: evalOwner }
                          ]
                        }
                      });

                      if (existingCandidateEval) {
                        await prisma.evaluation.update({
                          where: { id: existingCandidateEval.id },
                          data: {
                            score: finalScore,
                            atsScore: evalPayload.atsScore ?? finalScore,
                            matchLevel: evalPayload.matchLevel,
                            mandatoryCompliance: complianceStr,
                            mandatoryFailed: Boolean(evalPayload.mandatoryRequirementFailed),
                            decision,
                            evaluatedBy: evalOwner,
                            auditData: evalPayload as any,
                            updatedAt: new Date()
                          }
                        }).catch(() => null);
                      } else {
                        await prisma.evaluation.create({
                          data: {
                            candidateId: validCandId,
                            jobId: dbJobRecord.id,
                            candidateJobId: jobId,
                            createdByUserId: evalOwner,
                            evaluatedBy: evalOwner,
                            organizationId: orgId,
                            score: finalScore,
                            atsScore: evalPayload.atsScore ?? finalScore,
                            matchLevel: evalPayload.matchLevel,
                            mandatoryCompliance: complianceStr,
                            mandatoryFailed: Boolean(evalPayload.mandatoryRequirementFailed),
                            decision,
                            status: 'COMPLETED',
                            auditData: evalPayload as any
                          }
                        }).catch((err) => console.warn('[Evaluation DB Save Notice]:', err));
                      }
                    }
                  }
                } catch (saveEvalErr) {
                  console.warn('[Evaluation Persistence Warning]:', saveEvalErr);
                }

                if (targetJob?.id && targetId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
                  const stage = finalScore >= 80 ? 'SHORTLISTED' : (finalScore >= 55 ? 'REVIEW' : 'REJECTED');
                  await prisma.candidateApplication.upsert({
                    where: {
                      job_id_candidate_id: {
                        job_id: targetJob.id,
                        candidate_id: targetId
                      }
                    },
                    update: { stage, match_score: finalScore, status: 'active' },
                    create: { job_id: targetJob.id, candidate_id: targetId, stage, match_score: finalScore, status: 'active' }
                  }).catch(() => null);
                }
              }
            } catch (evalErr) {
              console.warn('[CV Upload Automatic Evaluation Notice]:', evalErr);
            }
          }
        } catch (dbSaveErr) {
          console.warn('[Prisma DB Save Notice] Candidate metadata stored in memory cache:', dbSaveErr);
        }

        existingCandidates.unshift(newRecord);
        processedCandidates.push(newRecord);

        // Also ensure candidate is present in central candidate pool store
        if (jobId !== 'pool') {
          const poolStore = CANDIDATE_STORE.get('pool') || [];
          if (!poolStore.some(c => c.id === newRecord.id || (c.fileHash && c.fileHash === newRecord.fileHash))) {
            poolStore.unshift({ ...newRecord, jobId: 'pool' });
            CANDIDATE_STORE.set('pool', poolStore);
          }
        }
      } catch (err: any) {
        console.error(`Error processing CV ${fileName}:`, err);
        const errRecord: CandidateRecord = {
          id: dbCandidateId || candidateId,
          jobId,
          name: null,
          email: null,
          phone: null,
          location: null,
          currentTitle: null,
          currentCompany: null,
          totalExperience: null,
          relevantExperience: null,
          summary: null,
          skills: [],
          technologies: [],
          tools: [],
          industries: [],
          education: [],
          certifications: [],
          languages: [],
          experience: [],
          responsibilities: [],
          achievements: [],
          projects: [],
          sourceEvidence: {},
          rawText: '',
          parsingStatus: 'FAILED',
          errorMessage: `Processing error: ${err.message || 'Unknown error'}`,
          validationErrors: [err.message || 'Unknown processing error'],
          parsingMetadata: {
            fileName,
            fileType: fileMime,
            pageCount: 0,
            extractionMethod: 'error',
            ocrUsed: false,
            characterCount: 0,
            wordCount: 0,
          },
          fileName,
          fileSize,
          fileHash,
          uploadedAt: new Date().toISOString(),
        };

        if (dbCandidateId) {
          await prisma.candidate.update({
            where: { id: dbCandidateId },
            data: {
              parsing_status: 'FAILED',
              error_message: err.message || 'Processing error',
            }
          }).catch(() => null);
        }

        existingCandidates.unshift(errRecord);
        processedCandidates.push(errRecord);
      }
    }

    CANDIDATE_STORE.set(jobId, existingCandidates);

    // Return aggregated response for real-time frontend feedback
    res.status(201).json({
      success: true,
      jobId,
      uploadedCount: processedCandidates.length,
      successfulCount: processedCandidates.filter(c => c.parsingStatus === 'PARSED').length,
      failedCount: processedCandidates.filter(c => c.parsingStatus === 'FAILED').length,
      candidateIds,
      processingStatus: 'COMPLETED',
      candidates: processedCandidates,
      allCandidates: existingCandidates
    });
  } catch (error: any) {
    console.error('Error during bulk CV upload:', error);
    res.status(500).json({ error: 'Bulk CV upload failed on server' });
  }
};

/**
 * Retry parsing a failed candidate
 * POST /api/jobs/:jobId/candidates/:candidateId/retry
 */
export const retryCandidateParsing = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.jobId || '');
    const candidateId = String(req.params.candidateId || '');

    const candidates = CANDIDATE_STORE.get(jobId);
    if (!candidates) {
      res.status(404).json({ error: 'Job candidate list not found' });
      return;
    }

    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) {
      res.status(404).json({ error: 'Candidate profile not found' });
      return;
    }

    if (!candidate.rawText || candidate.rawText.length < 20) {
      res.status(400).json({ error: 'Candidate has no raw text available for retry.' });
      return;
    }

    const recovered = extractStructuredCandidateFromText(candidate.rawText, candidate.fileName, {
      fileType: candidate.parsingMetadata.fileType || 'application/pdf',
      pageCount: Math.max(1, candidate.parsingMetadata.pageCount || 1),
      extractionMethod: 'retry-recovered',
      ocrUsed: true,
      characterCount: candidate.rawText.length,
      wordCount: candidate.rawText.split(/\s+/).filter(Boolean).length,
    });

    Object.assign(candidate, {
      ...recovered,
      errorMessage: undefined,
    });

    res.json({
      success: true,
      jobId,
      candidate,
    });
  } catch (error: any) {
    console.error('Error retrying candidate:', error);
    res.status(500).json({ error: 'Failed to retry candidate parsing' });
  }
};

/**
 * Delete a candidate profile from database & memory store
 * DELETE /api/candidates/:candidateId or DELETE /api/jobs/:jobId/candidates/:candidateId
 */
export const deleteCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const candidateId = String(req.params.candidateId || '');
    const jobId = String(req.params.jobId || '');

    if (!candidateId) {
      res.status(400).json({ error: 'Candidate ID is required' });
      return;
    }

    // 1. Delete from Prisma database
    try {
      await prisma.candidate.delete({
        where: { id: candidateId }
      }).catch(() => null);
    } catch (dbErr) {
      console.warn('[Delete Candidate] Prisma delete error:', dbErr);
    }

    // 2. Delete from memory store
    if (jobId && CANDIDATE_STORE.has(jobId)) {
      const list = CANDIDATE_STORE.get(jobId) || [];
      CANDIDATE_STORE.set(jobId, list.filter(c => c.id !== candidateId));
    }
    for (const [jId, list] of CANDIDATE_STORE.entries()) {
      CANDIDATE_STORE.set(jId, list.filter(c => c.id !== candidateId));
    }
    GLOBAL_CANDIDATES.delete(candidateId);

    res.json({ success: true, message: 'Candidate deleted successfully', candidateId });
  } catch (error: any) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
};

/**
 * Update candidate decision tag (REVIEW, SUBMIT, REJECT)
 * PATCH /api/jobs/:jobId/candidates/:candidateId/decision
 * PATCH /api/candidates/:candidateId/decision
 */
export const updateCandidateDecision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const candidateId = String(req.params.candidateId || '');
    const jobId = String(req.params.jobId || '');
    const rawDecision = String(req.body.decision || '').trim().toUpperCase();

    if (!candidateId) {
      res.status(400).json({ error: 'Candidate ID is required' });
      return;
    }

    if (!['REVIEW', 'SUBMIT', 'REJECT', 'DO NOT SUBMIT', 'ACCEPT'].includes(rawDecision)) {
      res.status(400).json({ error: 'Invalid decision. Must be REVIEW, SUBMIT, or REJECT.' });
      return;
    }

    const standardDecision: 'REVIEW' | 'SUBMIT' | 'REJECT' =
      (rawDecision === 'ACCEPT' || rawDecision === 'SUBMIT') ? 'SUBMIT' :
      (rawDecision === 'DO NOT SUBMIT' || rawDecision === 'REJECT') ? 'REJECT' : 'REVIEW';

    // 1. Update in-memory stores
    if (jobId && CANDIDATE_STORE.has(jobId)) {
      const list = CANDIDATE_STORE.get(jobId) || [];
      for (const c of list) {
        if (c.id === candidateId) {
          (c as any).decision = standardDecision;
          (c as any).recommendation = standardDecision;
        }
      }
    }
    for (const [jId, list] of CANDIDATE_STORE.entries()) {
      for (const c of list) {
        if (c.id === candidateId) {
          (c as any).decision = standardDecision;
          (c as any).recommendation = standardDecision;
        }
      }
    }
    if (GLOBAL_CANDIDATES.has(candidateId)) {
      const c = GLOBAL_CANDIDATES.get(candidateId);
      if (c) {
        (c as any).decision = standardDecision;
        (c as any).recommendation = standardDecision;
      }
    }

    // 2. Persist to Prisma database if UUID
    const isCandUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId);
    if (isCandUuid) {
      try {
        const dbDecision = standardDecision === 'REJECT' ? 'DO NOT SUBMIT' : standardDecision;
        await prisma.evaluation.updateMany({
          where: { candidateId, ...(jobId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId) ? { jobId } : {}) },
          data: { decision: dbDecision, updatedAt: new Date() }
        });

        const stage = standardDecision === 'SUBMIT' ? 'SHORTLISTED' : standardDecision === 'REJECT' ? 'REJECTED' : 'REVIEW';
        await prisma.candidateApplication.updateMany({
          where: { candidate_id: candidateId, ...(jobId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId) ? { job_id: jobId } : {}) },
          data: { stage }
        });
      } catch (dbErr) {
        console.warn('[updateCandidateDecision] DB persistence non-fatal error:', dbErr);
      }
    }

    res.json({
      success: true,
      message: `Candidate decision tag updated to ${standardDecision}`,
      candidateId,
      decision: standardDecision
    });
  } catch (error: any) {
    console.error('Error updating candidate decision:', error);
    res.status(500).json({ error: error.message || 'Failed to update candidate decision' });
  }
};



/**
 * Find candidate record from memory store or DB
 */
export async function findCandidateRecord(candidateId: string, jobId?: string): Promise<CandidateRecord | null> {
  if (!candidateId) return null;

  // 1. Check memory store by jobId if given
  if (jobId && CANDIDATE_STORE.has(jobId)) {
    const memList = CANDIDATE_STORE.get(jobId);
    const found = memList?.find(c => c.id === candidateId);
    if (found) return found;
  }

  // 2. Check all job lists in CANDIDATE_STORE
  for (const list of CANDIDATE_STORE.values()) {
    const found = list.find(c => c.id === candidateId);
    if (found) return found;
  }

  // 3. Check GLOBAL_CANDIDATES
  if (GLOBAL_CANDIDATES.has(candidateId)) {
    return GLOBAL_CANDIDATES.get(candidateId)!;
  }

  // 4. Check Prisma DB if candidateId is a valid UUID
  const isCandidateUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId);
  if (isCandidateUuid) {
    try {
      const dbCandidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          experiences: true,
          education: true,
          skills: true,
          certifications: true,
          languages: true,
          projects: true,
        }
      });
      if (dbCandidate) {
        return mapDbCandidateToRecord(dbCandidate, jobId);
      }
    } catch (err) {
      console.warn('[Candidates] Prisma find candidate error:', err);
    }
  }

  return null;
}

/**
 * Retrieves all candidates from both DB and memory store with their associated jobId
 * Filtered by user if specified
 */
export async function getAllCandidateRecords(userId?: string): Promise<Array<{ candidate: CandidateRecord; jobId: string }>> {
  const result: Array<{ candidate: CandidateRecord; jobId: string }> = [];
  const seenIds = new Set<string>();

  // 1. Fetch DB candidates
  try {
    const whereClause: any = {};
    if (userId) {
      whereClause.created_by = userId;
    }
    const dbCandidates = await prisma.candidate.findMany({
      where: whereClause,
      include: {
        experiences: true,
        education: true,
        skills: true,
        certifications: true,
        languages: true,
        projects: true,
      }
    });

    for (const c of dbCandidates) {
      const record = mapDbCandidateToRecord(c);
      const jId = c.job_id || 'pool';
      seenIds.add(record.id);
      result.push({ candidate: record, jobId: jId });
    }
  } catch (err) {
    console.warn('[Candidates] Prisma fetch all error:', err);
  }

  // 2. Add memory store candidates
  for (const [jId, list] of CANDIDATE_STORE.entries()) {
    for (const c of list) {
      if (!seenIds.has(c.id)) {
        if (!userId || c.uploadedBy === userId || c.createdBy === userId) {
          seenIds.add(c.id);
          result.push({ candidate: c, jobId: jId || c.jobId || 'pool' });
        }
      }
    }
  }

  return result;
}
