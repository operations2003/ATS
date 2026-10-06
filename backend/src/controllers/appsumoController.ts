import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { APPSUMO_CONFIG, getAppSumoTierLimits } from '../config/appsumoConfig';
import {
  verifyAppSumoSignature,
  processAppSumoWebhook,
  activateAppSumoAccount,
  AppSumoWebhookPayload
} from '../services/appsumoService';
import { appSumoClient } from '../services/appsumoClient';

const db = prisma as any;

/**
 * Handle incoming AppSumo webhooks
 * Routes: POST /v2/webhooks, POST /api/v1/appsumo/webhooks
 */
export async function handleAppSumoWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = (req as any).rawBody !== undefined ? (req as any).rawBody : JSON.stringify(req.body);
  const signature = req.headers['x-appsumo-signature'] as string;
  const timestamp = req.headers['x-appsumo-timestamp'] as string;

  // 1. Webhook Signature Verification
  const verification = verifyAppSumoSignature(rawBody, signature, timestamp);
  if (!verification.isValid) {
    console.warn(`[AppSumo Webhook] Signature verification failed: ${verification.reason}`);
    res.status(401).json({
      error: 'Invalid signature',
      message: verification.reason
    });
    return;
  }

  // 2. Parse JSON Payload
  let payload: AppSumoWebhookPayload;
  try {
    payload = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch (err: any) {
    res.status(400).json({ error: 'Malformed JSON payload' });
    return;
  }

  // 3. Process Event Idempotently
  try {
    const result = await processAppSumoWebhook(payload);

    // Return AppSumo required HTTP 200 response echoing the received event
    res.status(200).json({
      event: result.event,
      success: true
    });
  } catch (err: any) {
    console.error('[AppSumo Webhook] Controller error processing webhook:', err);
    res.status(500).json({
      error: 'Failed to process AppSumo webhook event',
      message: err.message
    });
  }
}

/**
 * Handle OAuth redirect from AppSumo
 * Routes: GET /v2/redirect-url, GET /api/v1/appsumo/redirect
 */
export async function handleAppSumoOAuthRedirect(req: Request, res: Response): Promise<void> {
  try {
    const {
      license_key,
      tier,
      partner_plan_name,
      email,
      code,
      state
    } = req.query;

    const frontendBase = APPSUMO_CONFIG.frontendUrl.replace(/\/+$/, '');
    const searchParams = new URLSearchParams();

    if (license_key) searchParams.set('license_key', String(license_key));
    if (tier) searchParams.set('tier', String(tier));
    if (partner_plan_name) searchParams.set('partner_plan_name', String(partner_plan_name));
    if (email) searchParams.set('email', String(email));
    if (code) searchParams.set('code', String(code));
    if (state) searchParams.set('state', String(state));

    const destinationUrl = `${frontendBase}/appsumo/activate?${searchParams.toString()}`;

    // If API client explicitly requests JSON (e.g. testing)
    if (req.headers.accept?.includes('application/json') && !req.headers.accept?.includes('text/html')) {
      res.status(200).json({
        success: true,
        redirectUrl: destinationUrl,
        params: Object.fromEntries(searchParams.entries())
      });
      return;
    }

    // Redirect browser to TaskNera Frontend activation portal
    res.redirect(destinationUrl);
  } catch (err: any) {
    console.error('[AppSumo Redirect] Error in redirect handler:', err);
    res.status(500).send('An error occurred during AppSumo redirect.');
  }
}

/**
 * Inspect AppSumo license status for frontend verification
 * Route: GET /api/v1/appsumo/license/:licenseKey
 */
export async function getLicenseStatusController(req: Request, res: Response): Promise<void> {
  try {
    const licenseKey = String(req.params.licenseKey || '').trim();
    if (!licenseKey) {
      res.status(400).json({ error: 'License key is required' });
      return;
    }

    const license = await db.appSumoLicense.findUnique({
      where: { licenseKey },
      include: {
        organization: {
          select: { id: true, name: true, status: true, subscriptionPlan: true }
        }
      }
    });

    if (!license) {
      // License not in database yet: provide default tier 1 information
      res.status(200).json({
        exists: false,
        licenseKey,
        tier: 1,
        tierConfig: getAppSumoTierLimits(1),
        isLinked: false
      });
      return;
    }

    const tierConfig = getAppSumoTierLimits(license.tier);

    res.status(200).json({
      exists: true,
      licenseKey: license.licenseKey,
      tier: license.tier,
      status: license.status,
      partnerPlanName: license.partnerPlanName,
      unitQuantity: license.unitQuantity,
      isTest: license.isTest,
      tierConfig,
      isLinked: Boolean(license.organizationId),
      organization: license.organization ? {
        id: license.organization.id,
        name: license.organization.name,
        status: license.organization.status
      } : null,
      activatedAt: license.activatedAt
    });
  } catch (err: any) {
    console.error('[AppSumo Controller] Error querying license:', err);
    res.status(500).json({ error: err.message || 'Failed to query license status' });
  }
}

/**
 * Account Activation / Onboarding endpoint
 * Route: POST /api/v1/appsumo/activate-account
 */
export async function activateAccountController(req: Request, res: Response): Promise<void> {
  try {
    const {
      licenseKey,
      isExistingUser,
      email,
      password,
      userId,
      name,
      companyName
    } = req.body;

    if (!licenseKey) {
      res.status(400).json({ error: 'licenseKey is required' });
      return;
    }

    const result = await activateAppSumoAccount({
      licenseKey,
      isExistingUser: Boolean(isExistingUser),
      email,
      password,
      userId,
      name,
      companyName
    });

    res.status(200).json({
      success: true,
      message: 'AppSumo license activated successfully',
      token: result.token,
      user: result.user,
      organization: result.organization,
      license: {
        licenseKey: result.license.licenseKey,
        tier: result.license.tier,
        status: result.license.status
      }
    });
  } catch (err: any) {
    console.error('[AppSumo Controller] Error activating account:', err);
    res.status(400).json({ error: err.message || 'Failed to activate account with AppSumo license' });
  }
}

/**
 * Super Admin: Search and list AppSumo licenses
 * Route: GET /api/super-admin/appsumo/licenses
 */
export async function getSuperAdminAppSumoLicenses(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { query, status, tier, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const pageSize = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * pageSize;

    const where: any = {};
    if (status) {
      where.status = String(status).toUpperCase();
    }
    if (tier) {
      where.tier = Number(tier);
    }
    if (query) {
      const q = String(query).trim();
      where.OR = [
        { licenseKey: { contains: q, mode: 'insensitive' } },
        { previousLicenseKey: { contains: q, mode: 'insensitive' } },
        { partnerPlanName: { contains: q, mode: 'insensitive' } },
        { organization: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const [licenses, total] = await Promise.all([
      db.appSumoLicense.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true, status: true, subscriptionPlan: true } },
          user: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      }),
      db.appSumoLicense.count({ where })
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pageSize,
      licenses
    });
  } catch (err: any) {
    console.error('[SuperAdmin AppSumo] Error listing licenses:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch AppSumo licenses' });
  }
}

/**
 * Super Admin: Get single AppSumo license details with complete event history
 * Route: GET /api/super-admin/appsumo/licenses/:licenseKey
 */
export async function getSuperAdminLicenseDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const licenseKey = String(req.params.licenseKey || '').trim();

    const license = await db.appSumoLicense.findUnique({
      where: { licenseKey },
      include: {
        organization: true,
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true } }
      }
    });

    if (!license) {
      res.status(404).json({ error: `AppSumo license "${licenseKey}" not found` });
      return;
    }

    const events = await db.appSumoLicenseEvent.findMany({
      where: { licenseKey },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const tierLimits = getAppSumoTierLimits(license.tier);

    res.status(200).json({
      success: true,
      license: {
        ...license,
        events
      },
      tierLimits
    });
  } catch (err: any) {
    console.error('[SuperAdmin AppSumo] Error getting license details:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch license details' });
  }
}

/**
 * Super Admin: Trigger synchronization with AppSumo API
 * Route: POST /api/super-admin/appsumo/licenses/:licenseKey/sync
 */
export async function syncLicenseFromAppSumoController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const licenseKey = String(req.params.licenseKey || '').trim();

    const remoteData = await appSumoClient.getLicense(licenseKey);

    // Sync remote data into DB
    const updated = await db.appSumoLicense.upsert({
      where: { licenseKey },
      update: {
        tier: remoteData.tier || 1,
        partnerPlanName: remoteData.partner_plan_name || null,
        unitQuantity: remoteData.unit_quantity || 1,
        isTest: Boolean(remoteData.test),
        lastWebhookReceivedAt: new Date()
      },
      create: {
        licenseKey: remoteData.license_key,
        previousLicenseKey: remoteData.previous_license_key || null,
        parentLicenseKey: remoteData.parent_license_key || null,
        tier: remoteData.tier || 1,
        partnerPlanName: remoteData.partner_plan_name || null,
        unitQuantity: remoteData.unit_quantity || 1,
        isTest: Boolean(remoteData.test),
        status: remoteData.license_status === 'active' ? 'ACTIVE' : 'INACTIVE',
        lastWebhookReceivedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'License synchronized with AppSumo successfully',
      license: updated,
      remoteData
    });
  } catch (err: any) {
    console.error('[SuperAdmin AppSumo] Error syncing with AppSumo:', err);
    res.status(500).json({ error: err.message || 'Failed to sync license with AppSumo API' });
  }
}
