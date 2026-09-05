import { Router } from 'express';
import multer from 'multer';
import {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  parseJobDescriptionController,
  getAvailableJobsForEvaluation
} from '../controllers/jobController';
import { protect, optionalProtect, authorize } from '../middleware/authMiddleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit per file
});

const router = Router();

// Document parsing route (stateless document text extraction & analysis)
router.post('/parse', upload.single('file'), parseJobDescriptionController);

import {
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  confirmRequirements
} from '../controllers/requirementController';

import {
  uploadCandidateCVs,
  getCandidatesForJob,
  getCandidateById,
  retryCandidateParsing,
  deleteCandidate,
  updateCandidateDecision
} from '../controllers/candidateController';

// Available Jobs for Candidate Evaluation & Matching (Entry Point 2)
router.get('/available-for-evaluation', optionalProtect, getAvailableJobsForEvaluation);

// Database routes
router.post('/', protect, createJob);
router.get('/', optionalProtect, getAllJobs);
router.get('/:id', optionalProtect, getJobById);
router.put('/:id', optionalProtect, updateJob);
router.delete('/:id', protect, deleteJob);

// Requirement CRUD & Confirmation API Routes
router.get('/:jobId/requirements', optionalProtect, getRequirements);
router.post('/:jobId/requirements', protect, createRequirement);
router.put('/:jobId/requirements/:requirementId', protect, updateRequirement);
router.delete('/:jobId/requirements/:requirementId', protect, deleteRequirement);
router.post('/:jobId/requirements/confirm', protect, confirmRequirements);

import { getCandidateEvaluation, evaluateCandidateController } from '../controllers/evaluationController';

// Candidate CV Upload, Extraction & Status Routes
router.post('/:jobId/candidates/upload', optionalProtect, upload.any(), uploadCandidateCVs);
router.get('/:jobId/candidates', optionalProtect, getCandidatesForJob);
router.get('/:jobId/candidates/:candidateId', optionalProtect, getCandidateById);
router.patch('/:jobId/candidates/:candidateId/decision', optionalProtect, updateCandidateDecision);
router.get('/:jobId/candidates/:candidateId/evaluation', optionalProtect, getCandidateEvaluation);
router.post('/:jobId/candidates/:candidateId/evaluate', protect, evaluateCandidateController);
router.post('/:jobId/candidates/:candidateId/retry', retryCandidateParsing);
router.delete('/:jobId/candidates/:candidateId', deleteCandidate);

export default router;
