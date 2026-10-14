import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  generateOrGetCandidateSummary,
  streamCandidateSummaryPdf,
  streamCandidateSummaryDocx
} from '../services/candidateSummaryService';

/**
 * GET /api/candidates/:candidateId/summary
 * Fetch cached candidate summary or return not generated state
 */
export const getCandidateSummaryController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const candidateId = String(req.params.candidateId || '').trim();
    const jobId = req.query.jobId ? String(req.query.jobId).trim() : undefined;

    if (!candidateId) {
      res.status(400).json({ error: 'Candidate ID is required' });
      return;
    }

    const orgId = user.organizationId || 'org-tasknera';
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    // Call without forcing regenerate (retrieves cached if available, or generates initial)
    const summary = await generateOrGetCandidateSummary(
      candidateId,
      jobId,
      orgId,
      user.userId,
      isSuperAdmin,
      false
    );

    if (!summary) {
      res.status(404).json({
        error: 'Candidate not found or access is unauthorized for this organization.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      summary
    });
  } catch (error: any) {
    console.error('[Candidate Summary Fetch Error]:', error);
    res.status(500).json({
      error: 'An internal error occurred while fetching the candidate summary.',
      details: error?.message || 'Unknown error'
    });
  }
};

/**
 * POST /api/candidates/:candidateId/summary
 * Generate or force-regenerate candidate summary
 */
export const generateCandidateSummaryController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const candidateId = String(req.params.candidateId || '').trim();
    const jobId = (req.body?.jobId || req.query.jobId) ? String(req.body?.jobId || req.query.jobId).trim() : undefined;
    const forceRegenerate = req.body?.regenerate === true || req.query.regenerate === 'true';

    if (!candidateId) {
      res.status(400).json({ error: 'Candidate ID is required' });
      return;
    }

    const orgId = user.organizationId || 'org-tasknera';
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    const summary = await generateOrGetCandidateSummary(
      candidateId,
      jobId,
      orgId,
      user.userId,
      isSuperAdmin,
      forceRegenerate
    );

    if (!summary) {
      res.status(404).json({
        error: 'Candidate not found or access is unauthorized for this organization.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      summary
    });
  } catch (error: any) {
    console.error('[Candidate Summary Generation Error]:', error);
    res.status(500).json({
      error: 'An internal error occurred while generating the candidate summary.',
      details: error?.message || 'Unknown error'
    });
  }
};

/**
 * GET /api/candidates/:candidateId/summary/pdf
 * Stream generated summary as downloadable PDF
 */
export const downloadCandidateSummaryPdfController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const candidateId = String(req.params.candidateId || '').trim();
    const jobId = req.query.jobId ? String(req.query.jobId).trim() : undefined;

    if (!candidateId) {
      res.status(400).json({ error: 'Candidate ID is required' });
      return;
    }

    const orgId = user.organizationId || 'org-tasknera';
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    let summary = req.body?.summary;
    if (!summary || !summary.overview) {
      summary = await generateOrGetCandidateSummary(
        candidateId,
        jobId,
        orgId,
        user.userId,
        isSuperAdmin,
        false
      );
    }

    if (!summary) {
      res.status(404).json({
        error: 'Candidate summary not found or access is unauthorized.'
      });
      return;
    }

    streamCandidateSummaryPdf(summary, res);
  } catch (error: any) {
    console.error('[Candidate Summary PDF Download Error]:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'An error occurred while generating the PDF document.',
        details: error?.message || 'Unknown error'
      });
    }
  }
};

/**
 * GET /api/candidates/:candidateId/summary/docx
 * Stream generated summary as downloadable DOCX Word document
 */
export const downloadCandidateSummaryDocxController = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const candidateId = String(req.params.candidateId || '').trim();
    const jobId = req.query.jobId ? String(req.query.jobId).trim() : undefined;

    if (!candidateId) {
      res.status(400).json({ error: 'Candidate ID is required' });
      return;
    }

    const orgId = user.organizationId || 'org-tasknera';
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    const summary = await generateOrGetCandidateSummary(
      candidateId,
      jobId,
      orgId,
      user.userId,
      isSuperAdmin,
      false
    );

    if (!summary) {
      res.status(404).json({
        error: 'Candidate summary not found or access is unauthorized.'
      });
      return;
    }

    await streamCandidateSummaryDocx(summary, res);
  } catch (error: any) {
    console.error('[Candidate Summary DOCX Download Error]:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'An error occurred while generating the DOCX document.',
        details: error?.message || 'Unknown error'
      });
    }
  }
};

