import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware';
import {
  getOrganizations,
  createOrganization,
  updateLimits,
  updateSubscription,
  toggleStatus,
  resetAdminPassword,
  getPlatformStats,
  getAuditLogs
} from '../controllers/superAdminController';

import {
  getSuperAdminAppSumoLicenses,
  getSuperAdminLicenseDetails,
  syncLicenseFromAppSumoController
} from '../controllers/appsumoController';

const router = Router();

// All super-admin routes are strictly protected and restricted to SUPER_ADMIN (or platform admin)
router.use(protect);
router.use(authorize('SUPER_ADMIN'));

router.get('/organizations', getOrganizations);
router.post('/organizations', createOrganization);
router.patch('/organizations/:id/limits', updateLimits);
router.patch('/organizations/:id/subscription', updateSubscription);
router.post('/organizations/:id/toggle-status', toggleStatus);
router.post('/organizations/:id/reset-admin-password', resetAdminPassword);
router.get('/stats', getPlatformStats);
router.get('/audit-logs', getAuditLogs);

// Super Admin: AppSumo Licensing Management & Support
router.get('/appsumo/licenses', getSuperAdminAppSumoLicenses);
router.get('/appsumo/licenses/:licenseKey', getSuperAdminLicenseDetails);
router.post('/appsumo/licenses/:licenseKey/sync', syncLicenseFromAppSumoController);

export default router;

