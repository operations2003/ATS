import { Router } from 'express';
import multer from 'multer';
import {
  getPublicJobByToken,
  applyPublicCandidate,
} from '../controllers/publicCandidateController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit per file
});

const router = Router();

// Public: View Job information by public token
router.get('/jobs/:token', getPublicJobByToken);

// Public: Apply to Job using public token with resume upload
router.post('/jobs/:token/apply', upload.any(), applyPublicCandidate);

export default router;
