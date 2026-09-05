import { Router } from 'express';
import multer from 'multer';
import {
  getAllCandidates,
  getCandidateById,
  deleteCandidate,
  uploadCandidateCVs,
  updateCandidateDecision
} from '../controllers/candidateController';
import {
  matchCandidateWithJobController,
  getCandidateEvaluationHistoryController,
  getAvailableJobsForCandidateController,
  attachCandidateToJobController,
  evaluateCandidateJobController
} from '../controllers/evaluationController';

import { protect, optionalProtect } from '../middleware/authMiddleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit per file
});

const router = Router();

// Retrieve all candidates in central candidate pool (scoped to organization)
router.get('/', optionalProtect, getAllCandidates);

// Bulk upload CVs directly to candidate pool
router.post('/upload', optionalProtect, upload.any(), uploadCandidateCVs);

// Available jobs in organization for matching against a candidate (filtered by permissions)
router.get('/:candidateId/available-jobs', protect, getAvailableJobsForCandidateController);

// Attach candidate to a job (create/reuse CandidateJob)
router.post('/:candidateId/jobs', protect, attachCandidateToJobController);

// Evaluate candidate against a specific job
router.post('/:candidateId/jobs/:jobId/evaluate', protect, evaluateCandidateJobController);

// Match candidate from pool with a specific Job Description (Entry Point 2)
router.post('/:candidateId/match-with-job', protect, matchCandidateWithJobController);

// Candidate evaluation history across multiple jobs
router.get('/:candidateId/evaluations', protect, getCandidateEvaluationHistoryController);

// Single candidate lookup, decision update & delete
router.get('/:candidateId', getCandidateById);
router.patch('/:candidateId/decision', optionalProtect, updateCandidateDecision);
router.delete('/:candidateId', deleteCandidate);

export default router;
