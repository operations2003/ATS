import { Router } from 'express';
import {
  handleAppSumoWebhook,
  handleAppSumoOAuthRedirect,
  getLicenseStatusController,
  activateAccountController
} from '../controllers/appsumoController';

const router = Router();

// AppSumo Webhook Handler (Accepts raw JSON payload with HMAC validation)
router.post('/webhooks', handleAppSumoWebhook);
router.get('/webhooks', (req, res) => {
  res.status(200).json({ status: 'active', message: 'TaskNera AppSumo Webhook Receiver is ready' });
});

// AppSumo OAuth / Partner Portal Onboarding Redirect Handler
router.get('/redirect', handleAppSumoOAuthRedirect);

// License validation & status inquiry for activation page
router.get('/license/:licenseKey', getLicenseStatusController);

// Account activation and license linking (onboarding)
router.post('/activate-account', activateAccountController);

export default router;
