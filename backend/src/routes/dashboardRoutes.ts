import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { getDashboardSummaryController } from '../controllers/dashboardController';

const router = Router();

// Fast aggregate summary endpoint for Executive Dashboard
router.get('/summary', protect, getDashboardSummaryController);
router.get('/stats', protect, getDashboardSummaryController);

export default router;

