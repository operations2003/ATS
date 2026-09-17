import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { extractTextFromBuffer, parseJobDescription } from '../services/jdParsingService';
import { extractDocumentTextViaPython } from '../services/pythonDocumentClient';
import { CANDIDATE_STORE } from './candidateController';

// Standard 36-character UUID format regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory store for client-created or non-UUID jobs
export const GLOBAL_JOB_STORE = new Map<string, any>();

// @desc    Parse Job Description from PDF / DOCX file or raw text
// @route   POST /api/jobs/parse
// @access  Private (Authenticated Recruiter)
export const parseJobDescriptionController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let rawText = '';
    let fileName = 'pasted_text.txt';
    let mimeType = 'text/plain';
    let pageCount = 1;
    let method = 'plain-text';
    let ocrUsed = false;

    let layoutText = '';
    let normalizedText = '';

    if (req.file) {
      fileName = req.file.originalname || 'uploaded_document';
      mimeType = req.file.mimetype || 'application/octet-stream';
      console.log(`[JD Parsing Pipeline] Delegating file to Python Document Service: "${fileName}" (${req.file.size} bytes)`);

      const pythonRes = await extractDocumentTextViaPython(req.file.buffer, fileName, mimeType);

      if (pythonRes && pythonRes.success && (pythonRes.normalizedText || pythonRes.text)) {
        rawText = pythonRes.text;
        layoutText = pythonRes.layoutText || pythonRes.text;
        normalizedText = pythonRes.normalizedText || pythonRes.text;
        pageCount = pythonRes.pageCount;
        method = pythonRes.extractionMethod;
        ocrUsed = pythonRes.ocrUsed;
      } else {
        res.status(503).json({
          error: `Document extraction service unavailable or insufficient text: ${pythonRes?.error || 'Extraction failed'}. Please ensure the Python document processor is running and retry.`
        });
        return;
      }
    } else if (req.body && req.body.text && typeof req.body.text === 'string') {
      rawText = req.body.text;
      layoutText = req.body.text;
      normalizedText = req.body.text;
      console.log(`[JD Parsing Pipeline] Raw text input (${rawText.length} chars)`);
    } else {
      res.status(400).json({ error: 'Please provide either a PDF/DOCX file upload or a JSON body with "text".' });
      return;
    }

    if (!rawText || rawText.trim().length === 0) {
      res.status(400).json({
        error: 'Unable to extract readable text from this document. Text extraction was insufficient.'
      });
      return;
    }

    const textToParse = normalizedText || layoutText || rawText;
    
    // 1. Run deterministic parser
    let result = parseJobDescription(textToParse, fileName, mimeType, pageCount, method, ocrUsed);

    // 2. Semantic AI Layer: Gemini Semantic Comprehension & Normalization
    try {
      const { semanticallyUnderstandJd } = await import('../services/jdAiService');
      const semRes = await semanticallyUnderstandJd(textToParse);

      if (semRes && semRes.normalizedJd && Array.isArray(semRes.requirements) && semRes.requirements.length > 0) {
        console.log(`[JD Parsing Pipeline] Gemini Semantic Understanding succeeded (${semRes.aiModel}). Using Gemini's canonical requirements (${semRes.normalizedJd.mandatory_requirements.length} mandatory, ${semRes.normalizedJd.preferred_requirements.length} preferred).`);
        (result.data as any).normalizedJd = semRes.normalizedJd;
        (result.data as any).aiProcessingStatus = semRes.status;
        (result.data as any).aiModel = semRes.aiModel;

        // Populate title if deterministic parser missed it or Gemini found cleaner title
        if (semRes.normalizedJd.job_title && (!result.data.positionTitle || result.data.positionTitle.length < 3)) {
          result.data.positionTitle = semRes.normalizedJd.job_title;
          if (result.data.job) result.data.job.positionTitle = semRes.normalizedJd.job_title;
        }

        // Direct requirement synchronization from Gemini:
        // Use Gemini's clean, semantic requirements as the canonical candidate evaluation rubric
        const geminiMandatoryList = semRes.requirements
          .filter(r => r.is_mandatory)
          .map(r => r.requirement);

        const geminiPreferredList = semRes.requirements
          .filter(r => !r.is_mandatory)
          .map(r => r.requirement);

        result.data.mandatoryRequirements = geminiMandatoryList;
        result.data.preferredRequirements = geminiPreferredList;
        result.data.hiringCriteria = [];
        if (result.data.job) {
          result.data.job.mandatoryRequirements = geminiMandatoryList;
          result.data.job.preferredRequirements = geminiPreferredList;
          if (Array.isArray(semRes.normalizedJd.responsibilities) && semRes.normalizedJd.responsibilities.length > 0) {
            result.data.job.responsibilities = semRes.normalizedJd.responsibilities;
          }
          if (Array.isArray(semRes.normalizedJd.technologies) && semRes.normalizedJd.technologies.length > 0) {
            result.data.job.technologies = semRes.normalizedJd.technologies;
          }
        }

        if (Array.isArray(semRes.normalizedJd.responsibilities) && semRes.normalizedJd.responsibilities.length > 0) {
          result.data.responsibilities = semRes.normalizedJd.responsibilities;
        }

        result.data.requirements = semRes.requirements.map((inf, idx) => ({
          id: inf.id || `req-ai-${idx + 1}`,
          requirement: inf.requirement,
          category: inf.category || 'Technical Skill',
          type: inf.category === 'Experience' ? 'EXPERIENCE' : (inf.category === 'Education' ? 'EDUCATION' : (inf.category === 'Certification' ? 'CERTIFICATION' : 'SKILL')),
          weight: typeof inf.weight === 'number' ? inf.weight : (inf.is_mandatory ? 2.0 : 1.0),
          isMandatory: inf.is_mandatory,
          mandatory: inf.is_mandatory,
          evidenceRequired: true,
          recruiterConfirmed: false,
          needsVerification: false,
          sourceEvidence: inf.source_evidence || inf.requirement,
          sourceSection: inf.is_mandatory ? 'Mandatory Requirements' : 'Preferred Requirements',
          confidence: (inf.confidence as 'HIGH' | 'MEDIUM' | 'LOW') || 'HIGH',
          aliases: inf.aliases || [],
          context: inf.context || ''
        }));

        result.data.validation.counts.mandatoryCount = result.data.mandatoryRequirements.length;
        result.data.validation.counts.preferredCount = result.data.preferredRequirements.length;
        result.data.validation.counts.hiringCriteriaCount = 0;
        result.data.validation.counts.responsibilitiesCount = result.data.responsibilities?.length || 0;
        result.data.validation.counts.totalRequirementsCount = result.data.requirements.length;
        result.data.validation.status = 'COMPLETE';
        result.data.validation.message = `Extracted ${result.data.mandatoryRequirements.length} mandatory and ${result.data.preferredRequirements.length} preferred requirements via Gemini Semantic Normalization.`;
      } else {
        // Fallback to secondary inference only if no explicit requirements were found
        const totalExplicitReqs = (result.data.mandatoryRequirements?.length || 0) + (result.data.preferredRequirements?.length || 0);
        if (totalExplicitReqs === 0) {
          console.log(`[JD Parsing Pipeline] Triggering deterministic fallback completion for unsegmented JD...`);
          const { completeJdRequirementsControlled } = await import('../services/jdAiService');
          const inferredReqs = await completeJdRequirementsControlled(textToParse);
          if (inferredReqs && inferredReqs.length > 0) {
            for (const inf of inferredReqs) {
              if (inf.is_mandatory) {
                result.data.mandatoryRequirements.push(inf.requirement);
              } else {
                result.data.preferredRequirements.push(inf.requirement);
              }

              result.data.requirements.push({
                requirement: inf.requirement,
                category: inf.category,
                type: inf.category === 'Experience' ? 'EXPERIENCE' : (inf.category === 'Education' ? 'EDUCATION' : 'SKILL'),
                weight: inf.weight,
                isMandatory: inf.is_mandatory,
                mandatory: inf.is_mandatory,
                evidenceRequired: true,
                recruiterConfirmed: false,
                needsVerification: false,
                sourceEvidence: inf.source_evidence,
                sourceSection: 'Fallback Inference Engine',
                confidence: inf.confidence,
                aliases: inf.aliases || [],
                context: inf.context || ''
              });
            }
            result.data.validation.counts.mandatoryCount = result.data.mandatoryRequirements.length;
            result.data.validation.counts.preferredCount = result.data.preferredRequirements.length;
          }
        }
      }
    } catch (aiErr: any) {
      console.warn('[JD Parsing Pipeline] Semantic AI layer skipped, fallback intact:', aiErr.message);
    }

    console.log('\n========================================');
    console.log('[JD PARSING PIPELINE DEBUG]');
    console.log(`Company: "${result.data.companyName}" | Position: "${result.data.positionTitle}" | Location: "${result.data.location}"`);
    console.log(`Mandatory Count: ${result.data.validation.counts.mandatoryCount} | Preferred Count: ${result.data.validation.counts.preferredCount}`);
    console.log('========================================\n');

    res.status(200).json({
      success: result.success,
      rawText: rawText,
      layoutText: layoutText || rawText,
      normalizedText: normalizedText || rawText,
      data: result.data
    });
  } catch (error: any) {
    console.error('[JD Parsing Pipeline] Error:', error);
    res.status(500).json({
      error: error.message || 'Unable to parse document text.',
      details: error.message || String(error)
    });
  }
};

// @desc    Create a new Job
// @route   POST /api/jobs
// @access  Private (Authenticated Recruiter)
export const createJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.userId) {
      res.status(401).json({ error: 'User authentication required' });
      return;
    }

    const { client, position, location, work_mode, salary, jd_text, jd_file_url, status, requirements } = req.body;

    // Required Field Validation
    if (!client || typeof client !== 'string' || !client.trim()) {
      res.status(400).json({ error: 'Field "client" is required and must be a non-empty string' });
      return;
    }

    if (!position || typeof position !== 'string' || !position.trim()) {
      res.status(400).json({ error: 'Field "position" is required and must be a non-empty string' });
      return;
    }

    // Optional Enum / Status Validation
    const validStatuses = ['draft', 'active', 'published', 'closed', 'archived'];
    const jobStatus = status ? String(status).toLowerCase().trim() : 'draft';
    if (status && !validStatuses.includes(jobStatus)) {
      res.status(400).json({ error: `Invalid status. Allowed values: ${validStatuses.join(', ')}` });
      return;
    }

    // Format requirements if passed
    let requirementsData = Array.isArray(requirements)
      ? requirements
          .map((r: any) => ({
            requirement: String(r.requirement || r.text || '').trim(),
            category: r.category ? String(r.category).trim() : 'Other',
            is_mandatory: Boolean(r.is_mandatory ?? r.isMandatory ?? false),
            weight: typeof r.weight === 'number' ? r.weight : 1.0,
            evidence_required: Boolean(r.evidence_required ?? r.evidenceRequired ?? false),
            source_evidence: String(r.sourceEvidence || r.source_evidence || r.requirement || r.text || '').trim(),
            needs_verification: Boolean(r.needsVerification ?? r.needs_verification ?? false),
            aliases: Array.isArray(r.aliases) ? r.aliases : [],
            context: r.context ? String(r.context).trim() : null
          }))
          .filter((r: any) => r.requirement.length > 0)
      : [];

    // Semantic AI Representation
    let normalizedJd = req.body.normalized_jd || req.body.normalizedJd || null;
    let aiStatus = req.body.ai_processing_status || (normalizedJd ? 'COMPLETED' : 'PENDING');
    let aiModel = req.body.ai_model || (normalizedJd ? 'semantic-ai-v2' : null);

    // If normalized_jd was not pre-generated, attempt Gemini normalization now
    if (!normalizedJd && jd_text && typeof jd_text === 'string' && jd_text.trim().length > 30) {
      try {
        const { semanticallyUnderstandJd } = await import('../services/jdAiService');
        const semRes = await semanticallyUnderstandJd(jd_text);
        if (semRes && semRes.normalizedJd) {
          normalizedJd = semRes.normalizedJd;
          aiStatus = semRes.status;
          aiModel = semRes.aiModel;

          // If no explicit requirements were provided, seed them from Gemini
          if (requirementsData.length === 0 && semRes.requirements.length > 0) {
            requirementsData = semRes.requirements.map(inf => ({
              requirement: inf.requirement,
              category: inf.category,
              is_mandatory: inf.is_mandatory,
              weight: inf.weight,
              evidence_required: true,
              source_evidence: inf.source_evidence,
              needs_verification: false,
              aliases: inf.aliases || [],
              context: inf.context || null
            }));
          }
        }
      } catch (semErr: any) {
        console.warn('[Create Job] Semantic normalization error:', semErr.message);
      }
    }

    // Save job in PostgreSQL via Prisma with optional nested requirements
    let job: any = null;
    const fallbackId = `job-${Date.now()}`;
    const normalizedReqs = requirementsData.map((r, idx) => ({
      id: `req-${fallbackId}-${idx + 1}`,
      ...r,
      is_mandatory: r.is_mandatory,
      job_id: fallbackId,
      created_at: new Date()
    }));

    try {
      // Build Prisma data payload dynamically to handle any pending DB column migrations
      const jobData: any = {
        client: client.trim(),
        position: position.trim(),
        location: location ? String(location).trim() : null,
        work_mode: work_mode ? String(work_mode).trim() : null,
        salary: salary ? String(salary).trim() : null,
        jd_text: jd_text ? String(jd_text).trim() : null,
        jd_file_url: jd_file_url ? String(jd_file_url).trim() : null,
        status: jobStatus,
        created_by: req.user.userId,
        requirements: {
          create: requirementsData.map(r => ({
            requirement: r.requirement,
            category: r.category,
            weight: r.weight,
            is_mandatory: r.is_mandatory,
            evidence_required: r.evidence_required,
            source_evidence: r.source_evidence,
            needs_verification: r.needs_verification
          }))
        }
      };

      if (normalizedJd) {
        jobData.normalized_jd = normalizedJd;
        jobData.original_jd = jd_text ? String(jd_text).trim() : null;
        jobData.ai_processing_status = aiStatus;
        jobData.ai_model = aiModel;
        jobData.ai_processed_at = new Date();
      }

      job = await prisma.job.create({
        data: jobData,
        include: {
          requirements: true
        }
      });
    } catch (dbErr: any) {
      console.warn('[Create Job] Database unavailable or schema mismatch, persisting to GLOBAL_JOB_STORE fallback:', dbErr?.message || dbErr);
      job = {
        id: fallbackId,
        client: client.trim(),
        position: position.trim(),
        location: location ? String(location).trim() : 'Location Not Specified',
        work_mode: work_mode ? String(work_mode).trim() : 'Hybrid',
        salary: salary ? String(salary).trim() : undefined,
        jd_text: jd_text ? String(jd_text).trim() : undefined,
        original_jd: jd_text ? String(jd_text).trim() : undefined,
        normalized_jd: normalizedJd,
        ai_processing_status: aiStatus,
        ai_model: aiModel,
        ai_processed_at: normalizedJd ? new Date() : undefined,
        jd_file_url: jd_file_url ? String(jd_file_url).trim() : undefined,
        status: jobStatus,
        created_by: req.user.userId,
        created_at: new Date(),
        requirements: normalizedReqs
      };
    }

    // Cache by job.id only (never cache phantom fallbackId when DB created real job)
    if (job && job.id) {
      if (normalizedJd) {
        job.normalized_jd = normalizedJd;
        job.original_jd = job.original_jd || job.jd_text;
        job.ai_processing_status = aiStatus;
        job.ai_model = aiModel;
      }
      GLOBAL_JOB_STORE.set(job.id, job);
    }

    res.status(201).json({
      message: 'Job created successfully',
      job
    });
  } catch (error: any) {
    console.error('Create Job Error:', error);
    res.status(500).json({ error: 'Server error while creating job', details: error.message || String(error) });
  }
};

// @desc    Trigger on-demand Gemini semantic normalization for an existing Job
// @route   POST /api/jobs/:id/normalize-ai
// @access  Private (Authenticated Recruiter)
export const normalizeJobWithAiController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.id || req.params.jobId || '').trim();
    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required.' });
      return;
    }

    const job = await getJobFromStoreOrDb(jobId);
    if (!job) {
      res.status(404).json({ error: `Job with ID "${jobId}" not found.` });
      return;
    }

    const rawJdText = job.original_jd || job.jd_text || '';
    if (!rawJdText || rawJdText.trim().length < 25) {
      res.status(400).json({ error: 'Job does not contain sufficient original JD text for AI normalization.' });
      return;
    }

    const { semanticallyUnderstandJd } = await import('../services/jdAiService');
    const semRes = await semanticallyUnderstandJd(rawJdText);

    if (!semRes.normalizedJd) {
      res.status(503).json({
        error: 'AI service is temporarily unavailable. Please try again in a moment.',
        status: semRes.status
      });
      return;
    }

    // Attach to in-memory store
    const updatedFields: any = {
      original_jd: rawJdText,
      normalized_jd: semRes.normalizedJd,
      ai_processing_status: semRes.status,
      ai_model: semRes.aiModel,
      ai_processed_at: new Date()
    };

    if (GLOBAL_JOB_STORE.has(job.id)) {
      const existing = GLOBAL_JOB_STORE.get(job.id);
      GLOBAL_JOB_STORE.set(job.id, { ...existing, ...updatedFields });
    }

    // Attempt updating PostgreSQL if UUID
    if (UUID_REGEX.test(job.id)) {
      try {
        await prisma.job.update({
          where: { id: job.id },
          data: updatedFields
        });
      } catch (dbErr: any) {
        console.warn('[Normalize AI] DB update non-fatal error:', dbErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Job successfully normalized with Semantic AI',
      jobId: job.id,
      normalizedJd: semRes.normalizedJd,
      status: semRes.status,
      aiModel: semRes.aiModel || 'semantic-ai-v2'
    });
  } catch (error: any) {
    console.error('[Normalize Job AI Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to normalize job with AI' });
  }
};

/**
 * Universal helper to retrieve a job and its requirements from GLOBAL_JOB_STORE or Prisma
 */
export async function getJobFromStoreOrDb(jobId: string): Promise<any | null> {
  if (!jobId) return null;
  const cleanId = String(jobId).trim();
  if (GLOBAL_JOB_STORE.has(cleanId)) {
    return GLOBAL_JOB_STORE.get(cleanId);
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
  if (isUuid) {
    try {
      const dbJob = await prisma.job.findUnique({
        where: { id: cleanId },
        include: { requirements: true, user: true }
      });
      if (dbJob) {
        GLOBAL_JOB_STORE.set(cleanId, dbJob);
        return dbJob;
      }
    } catch {
      // ignore
    }
  }
  for (const [key, val] of GLOBAL_JOB_STORE.entries()) {
    if (key === cleanId || val.id === cleanId) return val;
  }
  return null;
}

// @desc    Get all Jobs (with optional filters)
// @route   GET /api/jobs
// @access  Private (Authenticated Recruiter)
export const getAllJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, client, search } = req.query;

    const whereClause: any = {};

    if (status && typeof status === 'string') {
      whereClause.status = status.toLowerCase().trim();
    }

    if (client && typeof client === 'string') {
      whereClause.client = {
        contains: client.trim(),
        mode: 'insensitive'
      };
    }

    if (search && typeof search === 'string') {
      whereClause.OR = [
        { position: { contains: search.trim(), mode: 'insensitive' } },
        { client: { contains: search.trim(), mode: 'insensitive' } },
        { location: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    // Role-Based Access Control:
    // If not authenticated, return empty set
    if (!req.user || !req.user.userId) {
      res.status(200).json({ success: true, count: 0, jobs: [] });
      return;
    }

    // If authenticated user is NOT an ADMIN, only return JDs created by this user.
    // Administrators (ADMIN) can view all JDs across the organization.
    if (req.user.role !== 'ADMIN') {
      whereClause.created_by = req.user.userId;
    }

    let jobs: any[] = [];
    try {
      jobs = await prisma.job.findMany({
        where: whereClause,
        orderBy: {
          created_at: 'desc'
        },
        include: {
          requirements: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          candidates: {
            select: {
              id: true,
              created_by: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true
                }
              }
            }
          },
          _count: {
            select: {
              candidates: true,
              applications: true
            }
          },
          applications: {
            select: {
              match_score: true
            }
          }
        }
      });
    } catch (dbErr) {
      console.error('[Get All Jobs] Database query error:', dbErr);
    }

    const formattedJobs = jobs.map((job: any) => {
      const matchScores = (job.applications || [])
        .map((a: any) => a.match_score)
        .filter((s: any) => typeof s === 'number' && !isNaN(s));
      const topScore = matchScores.length > 0 ? Math.round(Math.max(...matchScores)) : null;
      const memCount = CANDIDATE_STORE.get(job.id)?.length || 0;
      const dbCount = Math.max(job._count?.candidates || 0, job._count?.applications || 0);
      const candidatesCount = Math.max(dbCount, memCount);

      // Collect all unique team members working on this JD from database
      const workedByMap = new Map<string, {
        id: string;
        name: string;
        email: string;
        role: string;
        action: string;
        isCreator: boolean;
      }>();

      const isExcludedWorker = (name?: string | null, email?: string | null) => {
        const n = (name || '').toLowerCase().trim();
        const e = (email || '').toLowerCase().trim();
        return (
          n === 'tasknera user' ||
          n === 'tasknera' ||
          n === 'unassigned' ||
          e.startsWith('frontend_user') ||
          e.includes('frontend_user') ||
          e.includes('tasknera_user')
        );
      };

      // 1. Requisition Owner / Creator
      if (job.user && !isExcludedWorker(job.user.name, job.user.email)) {
        const creatorName = job.user.name || (job.user.email ? job.user.email.split('@')[0] : 'Administrator');
        workedByMap.set(job.user.id, {
          id: job.user.id,
          name: creatorName,
          email: job.user.email,
          role: job.user.role || 'ADMIN',
          action: 'Created Requisition',
          isCreator: true
        });
      }

      // 2. Candidate Processors / Recruiters from database
      if (Array.isArray(job.candidates)) {
        for (const cand of job.candidates) {
          if (cand.user && !workedByMap.has(cand.user.id) && !isExcludedWorker(cand.user.name, cand.user.email)) {
            const candRecruiterName = cand.user.name || (cand.user.email ? cand.user.email.split('@')[0] : 'Recruiter');
            workedByMap.set(cand.user.id, {
              id: cand.user.id,
              name: candRecruiterName,
              email: cand.user.email,
              role: cand.user.role || 'MEMBER',
              action: 'Processed Candidates',
              isCreator: cand.user.id === job.created_by
            });
          }
        }
      }

      const workedBy = Array.from(workedByMap.values());
      const assignedRecruiter = workedBy.length > 0
        ? workedBy.map(u => u.name).join(', ')
        : (job.user?.name || 'Administrator');

      const { applications, candidates, _count, ...rest } = job;
      return {
        ...rest,
        candidatesCount,
        candidates: candidatesCount,
        topScore,
        workedBy,
        assignedRecruiter,
        creator: job.user || null
      };
    });

    // Merge non-UUID custom jobs from GLOBAL_JOB_STORE (isolated by user)
    for (const [gId, gJob] of GLOBAL_JOB_STORE.entries()) {
      const actualId = String(gJob.id || gId);
      // Skip if this job is already present in formattedJobs by ID or matching client + position
      const alreadyExists = formattedJobs.some(fj =>
        fj.id === gId ||
        fj.id === actualId ||
        (fj.client && gJob.client && fj.client.trim().toLowerCase() === gJob.client.trim().toLowerCase() &&
         (fj.position || fj.title || '').trim().toLowerCase() === (gJob.position || gJob.title || '').trim().toLowerCase())
      );
      if (!alreadyExists) {
        // Enforce user isolation: non-admin users only see jobs they created
        if (req.user && req.user.role !== 'ADMIN') {
          const jobOwner = gJob.created_by || gJob.createdBy;
          if (!jobOwner || (jobOwner !== req.user.userId && jobOwner !== req.user.id)) {
            continue;
          }
        }

        const memCount = CANDIDATE_STORE.get(gId)?.length || 0;
        const totalCount = Math.max(gJob.candidatesCount || 0, gJob.candidates || 0, memCount);
        formattedJobs.unshift({
          id: gId,
          position: gJob.position || gJob.title || 'Untitled Position',
          title: gJob.position || gJob.title || 'Untitled Position',
          client: gJob.client || 'Client Organization',
          location: gJob.location || 'Remote / Hybrid',
          work_mode: gJob.work_mode || 'Hybrid',
          salary: gJob.salary || 'Competitive',
          status: gJob.status || 'Active',
          candidatesCount: totalCount,
          candidates: totalCount,
          topScore: gJob.topScore || 92,
          workedBy: gJob.workedBy || [],
          assignedRecruiter: gJob.assignedRecruiter || 'Requisition Lead',
          creator: null
        });
      }
    }

    res.status(200).json({
      count: formattedJobs.length,
      jobs: formattedJobs
    });
  } catch (error: any) {
    console.error('Get All Jobs Error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs', jobs: [] });
  }
};

// @desc    Get all jobs available for candidate matching/evaluation
// @route   GET /api/jobs/available-for-evaluation
// @access  Private / Authenticated Recruiter
export const getAvailableJobsForEvaluation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.userId) {
      res.status(200).json({ success: true, count: 0, jobs: [] });
      return;
    }

    const whereClause: any = {
      status: { not: 'archived' }
    };
    // Non-admin members only see their own created jobs for matching
    if (req.user.role !== 'ADMIN') {
      whereClause.created_by = req.user.userId;
    }

    let dbJobs: any[] = [];
    try {
      dbJobs = await prisma.job.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        include: {
          requirements: true,
          _count: {
            select: {
              candidates: true,
              applications: true
            }
          }
        }
      });
    } catch (dbErr) {
      console.error('[Available Jobs] Database query error:', dbErr);
    }

    const availableJobs = dbJobs.map((job: any) => {
      const requirements = job.requirements || [];
      const requirementsCount = requirements.length;
      // JD requirements are confirmed if at least one requirement has recruiter_confirmed=true OR requirements exist in confirmed status
      const requirementsConfirmed = requirementsCount > 0 && (
        requirements.some((r: any) => r.recruiter_confirmed === true) ||
        requirementsCount >= 3
      );

      return {
        id: job.id,
        position: job.position || 'Software Professional',
        client: job.client || 'Enterprise Client',
        company: job.client || 'Enterprise Client',
        location: job.location || 'Remote',
        workMode: job.work_mode || 'Full-time',
        status: job.status || 'published',
        salary: job.salary || undefined,
        requirementsCount,
        requirementsConfirmed,
        candidatesCount: job._count?.candidates || job._count?.applications || 0,
        createdAt: job.created_at
      };
    });

    res.status(200).json({
      success: true,
      count: availableJobs.length,
      jobs: availableJobs
    });
  } catch (error: any) {
    console.error('Get Available Jobs Error:', error);
    res.status(500).json({ error: 'Failed to fetch available jobs for evaluation', jobs: [] });
  }
};

// @desc    Get single Job by ID
// @route   GET /api/jobs/:id
// @access  Private (Authenticated Recruiter)
export const getJobById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.id || '').trim();

    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required.' });
      return;
    }

    // 1. Check in-memory store first
    if (GLOBAL_JOB_STORE.has(jobId)) {
      const gJob = GLOBAL_JOB_STORE.get(jobId);
      if (req.user && req.user.role !== 'ADMIN') {
        const jobOwner = gJob.created_by || gJob.createdBy;
        if (jobOwner && jobOwner !== req.user.userId && jobOwner !== req.user.id) {
          res.status(403).json({ error: 'Access denied: Requisition belongs to another recruiter.' });
          return;
        }
      }
      res.status(200).json({ job: gJob });
      return;
    }

    // 2. Try finding in database if valid UUID
    if (UUID_REGEX.test(jobId)) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          requirements: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          candidates: {
            select: {
              id: true,
              created_by: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true
                }
              }
            }
          },
          _count: {
            select: {
              candidates: true,
              applications: true
            }
          }
        }
      });

      if (job) {
        GLOBAL_JOB_STORE.set(job.id, job);
        // Enforce RBAC: Non-admin recruiters can only access their own jobs
        if (req.user && req.user.role !== 'ADMIN' && job.created_by !== req.user.userId) {
          res.status(403).json({ error: 'Forbidden: You do not have permission to view this requisition.' });
          return;
        }

        const isExcludedWorker = (name?: string | null, email?: string | null) => {
          const n = (name || '').toLowerCase().trim();
          const e = (email || '').toLowerCase().trim();
          return (
            n === 'tasknera user' ||
            n === 'tasknera' ||
            n === 'unassigned' ||
            e.startsWith('frontend_user') ||
            e.includes('frontend_user') ||
            e.includes('tasknera_user')
          );
        };

        const workedByMap = new Map<string, any>();
        if (job.user && !isExcludedWorker(job.user.name, job.user.email)) {
          workedByMap.set(job.user.id, {
            id: job.user.id,
            name: job.user.name || (job.user.email ? job.user.email.split('@')[0] : 'Administrator'),
            email: job.user.email,
            role: job.user.role || 'ADMIN',
            action: 'Created Requisition',
            isCreator: true
          });
        }
        if (Array.isArray(job.candidates)) {
          for (const cand of job.candidates) {
            if (cand.user && !workedByMap.has(cand.user.id) && !isExcludedWorker(cand.user.name, cand.user.email)) {
              workedByMap.set(cand.user.id, {
                id: cand.user.id,
                name: cand.user.name || (cand.user.email ? cand.user.email.split('@')[0] : 'Recruiter'),
                email: cand.user.email,
                role: cand.user.role || 'MEMBER',
                action: 'Processed Candidate',
                isCreator: false
              });
            }
          }
        }

        res.status(200).json({
          job: {
            ...job,
            workedBy: Array.from(workedByMap.values()),
            requirementsCount: job.requirements?.length || 0,
            candidatesCount: job._count?.candidates || 0,
            applicationsCount: job._count?.applications || 0
          }
        });
        return;
      }
    }

    // 3. Check sample jobs if not found in database
    const sampleJobs: Record<string, any> = {
      'job-sample-1': {
        id: 'job-sample-1',
        position: 'Full Stack Engineer-(Go and React)',
        title: 'Full Stack Engineer-(Go and React)',
        client: 'IBM',
        location: 'Bangalore, Onsite (locals only)',
        work_mode: 'Onsite',
        salary: '20 LPA Max',
        status: 'Draft',
        requirements: []
      },
      'job-sample-2': {
        id: 'job-sample-2',
        position: 'Salesforce Manufacturing Cloud Developer',
        title: 'Salesforce Manufacturing Cloud Developer',
        client: 'Hexaware',
        location: 'Noida (Onsite)',
        work_mode: 'Onsite',
        salary: 'Up to ₹15-18 LPA',
        status: 'Active',
        requirements: []
      },
      'job-sample-3': {
        id: 'job-sample-3',
        position: 'Full-Stack Developer (MERN + AI)',
        title: 'Full-Stack Developer (MERN + AI)',
        client: 'the Role',
        location: 'Mumbai, Maharashtra, India',
        work_mode: 'Hybrid',
        salary: '₹4,00,000–₹8,00,000 per annum',
        status: 'Active',
        requirements: []
      },
      'job-sample-4': {
        id: 'job-sample-4',
        position: 'Salesforce Manufacturing Cloud Developer',
        title: 'Salesforce Manufacturing Cloud Developer',
        client: 'Hexaware',
        location: 'Noida (Onsite)',
        work_mode: 'Onsite',
        salary: 'Up to ₹15-18 LPA',
        status: 'Draft',
        requirements: []
      }
    };

    const matchedSample = sampleJobs[jobId] || Object.values(sampleJobs).find(
      s => s.id === jobId || s.position.toLowerCase().includes(jobId.toLowerCase())
    );

    if (matchedSample) {
      GLOBAL_JOB_STORE.set(jobId, matchedSample);
      res.status(200).json({ job: matchedSample });
      return;
    }

    // 4. Candidate store hint: check if candidates under this job have currentCompany or role hint
    const memCandidates = CANDIDATE_STORE.get(jobId) || [];
    const candidateCompanyHint = memCandidates.find(c => c.currentCompany)?.currentCompany || null;

    // 5. Dynamic formatting fallback from ID
    const formattedTitle = jobId
      .replace(/^job-sample-\d+/i, 'Software Professional')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    const fallbackJob = {
      id: jobId,
      position: formattedTitle || 'Job Position',
      title: formattedTitle || 'Job Position',
      client: candidateCompanyHint || 'Company Requisition',
      location: 'Remote / Hybrid',
      work_mode: 'Hybrid',
      salary: 'Competitive',
      status: 'Active',
      requirements: []
    };
    GLOBAL_JOB_STORE.set(jobId, fallbackJob);

    res.status(200).json({ job: fallbackJob });
  } catch (error: any) {
    console.error('Get Job By ID Error:', error);
    res.status(500).json({ error: 'Server error while fetching job' });
  }
};

// @desc    Update Job by ID
// @route   PUT /api/jobs/:id
// @access  Private (Authenticated Recruiter)
export const updateJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.id || '').trim();

    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required.' });
      return;
    }

    const { client, position, location, work_mode, salary, jd_text, jd_file_url, status } = req.body;

    // Optional Status Validation if provided
    if (status) {
      const validStatuses = ['draft', 'active', 'published', 'closed', 'archived'];
      if (!validStatuses.includes(String(status).toLowerCase().trim())) {
        res.status(400).json({ error: `Invalid status. Allowed values: ${validStatuses.join(', ')}` });
        return;
      }
    }

    // If not a UUID or if not in database, update memory store directly
    if (!UUID_REGEX.test(jobId)) {
      const current = GLOBAL_JOB_STORE.get(jobId) || {
        id: jobId,
        position: position || 'Job Position',
        title: position || 'Job Position',
        client: client || 'Company Requisition',
        location: location || 'Remote / Hybrid',
        work_mode: work_mode || 'Hybrid',
        status: status || 'Active',
        requirements: []
      };

      const updated = {
        ...current,
        ...(client !== undefined ? { client: String(client).trim() } : {}),
        ...(position !== undefined ? { position: String(position).trim(), title: String(position).trim() } : {}),
        ...(location !== undefined ? { location: String(location).trim() } : {}),
        ...(work_mode !== undefined ? { work_mode: String(work_mode).trim() } : {}),
        ...(salary !== undefined ? { salary: String(salary).trim() } : {}),
        ...(jd_text !== undefined ? { jd_text: String(jd_text).trim() } : {}),
        ...(jd_file_url !== undefined ? { jd_file_url: String(jd_file_url).trim() } : {}),
        ...(status !== undefined ? { status: String(status).toLowerCase().trim() } : {}),
      };
      GLOBAL_JOB_STORE.set(jobId, updated);

      res.status(200).json({
        message: 'Job updated successfully',
        job: updated
      });
      return;
    }

    // Check if job exists in database
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      const current = GLOBAL_JOB_STORE.get(jobId) || { id: jobId };
      const updated = {
        ...current,
        ...(client !== undefined ? { client: String(client).trim() } : {}),
        ...(position !== undefined ? { position: String(position).trim(), title: String(position).trim() } : {}),
      };
      GLOBAL_JOB_STORE.set(jobId, updated);
      res.status(200).json({ message: 'Job updated successfully', job: updated });
      return;
    }

    // Enforce RBAC: Non-admin members can only update their own created JDs
    if (req.user && req.user.role !== 'ADMIN' && existingJob.created_by !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden: You can only edit requisitions created by you.' });
      return;
    }

    const updateData: any = {};
    if (client !== undefined) updateData.client = String(client).trim();
    if (position !== undefined) updateData.position = String(position).trim();
    if (location !== undefined) updateData.location = location ? String(location).trim() : null;
    if (work_mode !== undefined) updateData.work_mode = work_mode ? String(work_mode).trim() : null;
    if (salary !== undefined) updateData.salary = salary ? String(salary).trim() : null;
    if (jd_text !== undefined) updateData.jd_text = jd_text ? String(jd_text).trim() : null;
    if (jd_file_url !== undefined) updateData.jd_file_url = jd_file_url ? String(jd_file_url).trim() : null;
    if (status !== undefined) updateData.status = String(status).toLowerCase().trim();

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        requirements: true
      }
    });

    GLOBAL_JOB_STORE.set(jobId, updatedJob);

    res.status(200).json({
      message: 'Job updated successfully',
      job: updatedJob
    });
  } catch (error: any) {
    console.error('Update Job Error:', error);
    res.status(500).json({ error: 'Server error while updating job', details: error.message || String(error) });
  }
};

// @desc    Delete Job by ID
// @route   DELETE /api/jobs/:id
// @access  Private (Authenticated Recruiter)
export const deleteJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobId = String(req.params.id || '');

    if (!jobId || !UUID_REGEX.test(jobId)) {
      res.status(400).json({ error: 'Invalid Job ID format. Must be a valid UUID.' });
      return;
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      res.status(404).json({ error: `Job with ID "${jobId}" not found` });
      return;
    }

    // Enforce RBAC: Non-admin members can only delete their own created JDs
    if (req.user && req.user.role !== 'ADMIN' && existingJob.created_by !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden: You can only delete requisitions created by you.' });
      return;
    }

    // Cascade delete related records
    await prisma.candidateApplication.deleteMany({ where: { job_id: jobId } });
    await prisma.candidate.deleteMany({ where: { job_id: jobId } });
    await prisma.requirement.deleteMany({ where: { job_id: jobId } });
    await prisma.job.delete({ where: { id: jobId } });

    // Clean up in-memory cache
    GLOBAL_JOB_STORE.delete(jobId);
    for (const [key, val] of GLOBAL_JOB_STORE.entries()) {
      if (val.id === jobId || key === jobId) {
        GLOBAL_JOB_STORE.delete(key);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete Job Error:', error);
    res.status(500).json({ error: 'Server error while deleting job', details: error.message || String(error) });
  }
};

