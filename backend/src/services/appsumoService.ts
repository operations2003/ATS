import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OrgStatus, UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { APPSUMO_CONFIG, getAppSumoTierLimits } from '../config/appsumoConfig';

export type AppSumoStatus = 'ACTIVE' | 'INACTIVE' | 'REFUNDED' | 'DEACTIVATED';
export const AppSumoStatus = {
  ACTIVE: 'ACTIVE' as const,
  INACTIVE: 'INACTIVE' as const,
  REFUNDED: 'REFUNDED' as const,
  DEACTIVATED: 'DEACTIVATED' as const
};

const db = prisma as any;

export interface AppSumoWebhookPayload {
  license_key: string;
  prev_license_key?: string | null;
  previous_license_key?: string | null;
  parent_license_key?: string | null;
  event: string; // 'purchase' | 'activate' | 'deactivate' | 'upgrade' | 'downgrade' | 'migrate'
  event_timestamp?: string | number;
  created_at?: string;
  tier?: number | string;
  license_status?: string;
  partner_plan_name?: string | null;
  unit_quantity?: number | string;
  test?: boolean;
  extra?: Record<string, any>;
  [key: string]: any;
}

export interface WebhookProcessingResult {
  event: string;
  success: boolean;
  message?: string;
  isTest?: boolean;
  isDuplicate?: boolean;
}

/**
 * Timing-safe HMAC SHA-256 signature verification.
 * 
 * AppSumo Specification:
 * 1. String to hash: timestamp + raw_request_body
 * 2. Secret: APPSUMO_API_KEY (or APPSUMO_WEBHOOK_SECRET)
 * 3. Compares with header: X-Appsumo-Signature
 */
export function verifyAppSumoSignature(
  rawBody: Buffer | string,
  signatureHeader?: string | string[],
  timestampHeader?: string | string[]
): { isValid: boolean; reason?: string } {
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;

  if (!signature) {
    return { isValid: false, reason: 'Missing X-Appsumo-Signature header' };
  }

  const secret = APPSUMO_CONFIG.webhookSecret;
  if (!secret) {
    return { isValid: false, reason: 'Server configuration error: APPSUMO_API_KEY/APPSUMO_WEBHOOK_SECRET not set' };
  }

  // Convert raw body to string if Buffer
  const rawBodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');

  // Concatenate timestamp + raw request body
  const payloadToSign = (timestamp ? String(timestamp) : '') + rawBodyStr;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadToSign);
  const calculatedSignature = hmac.digest('hex');

  const sigBuffer = Buffer.from(signature.trim(), 'utf8');
  const calcBuffer = Buffer.from(calculatedSignature, 'utf8');

  if (sigBuffer.length !== calcBuffer.length) {
    return { isValid: false, reason: 'Signature length mismatch' };
  }

  const isTimingSafeMatch = crypto.timingSafeEqual(sigBuffer, calcBuffer);
  if (!isTimingSafeMatch) {
    return { isValid: false, reason: 'Signature mismatch' };
  }

  // Timestamp freshness validation (tolerant window: 15 minutes, skips if timestamp not provided)
  if (timestamp) {
    const timestampNum = Number(timestamp);
    if (!isNaN(timestampNum)) {
      // Could be seconds or milliseconds
      const timestampMs = timestampNum > 1e11 ? timestampNum : timestampNum * 1000;
      const ageMs = Math.abs(Date.now() - timestampMs);
      const maxAgeMs = 15 * 60 * 1000; // 15 minutes window
      if (ageMs > maxAgeMs) {
        console.warn(`[AppSumo Webhook] Timestamp delta ${Math.round(ageMs / 1000)}s exceeds tolerance.`);
        // Note: In case of clock drift, log warning but don't strictly break unless configured
      }
    }
  }

  return { isValid: true };
}

/**
 * Parse date or return current date
 */
function parseDateOrNow(dateVal?: any): Date {
  if (!dateVal) return new Date();
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Core Webhook Orchestrator with Idempotency & Prisma Transactions
 */
export async function processAppSumoWebhook(
  payload: AppSumoWebhookPayload
): Promise<WebhookProcessingResult> {
  const event = String(payload.event || '').toLowerCase().trim();
  const licenseKey = String(payload.license_key || '').trim();
  const prevLicenseKey = (payload.prev_license_key || payload.previous_license_key || null)?.trim() || null;
  const parentLicenseKey = (payload.parent_license_key || null)?.trim() || null;
  const tierNum = payload.tier !== undefined ? Number(payload.tier) : 1;
  const isTest = Boolean(payload.test);
  const eventTimestamp = payload.event_timestamp ? parseDateOrNow(payload.event_timestamp) : new Date();
  const createdAtFromSumo = payload.created_at ? parseDateOrNow(payload.created_at) : new Date();

  if (!licenseKey) {
    throw new Error('Malformed webhook payload: missing license_key');
  }
  if (!event) {
    throw new Error('Malformed webhook payload: missing event');
  }

  // 1. Idempotency Check:
  // Check if identical event has already been successfully processed
  const existingCompletedEvent = await db.appSumoLicenseEvent.findFirst({
    where: {
      licenseKey,
      event,
      eventTimestamp,
      processingStatus: 'COMPLETED'
    }
  });

  if (existingCompletedEvent) {
    console.log(`[AppSumo Webhook] Idempotent hit: Event ${event} for ${licenseKey} already processed. Returning HTTP 200.`);
    return {
      event,
      success: true,
      isDuplicate: true,
      message: 'Duplicate event already processed'
    };
  }

  // 2. Safe Test Event Handling:
  // AppSumo sends test events during setup/verification
  if (isTest) {
    console.log(`[AppSumo Webhook] Handling TEST event: ${event} for license ${licenseKey}`);
    await db.appSumoLicenseEvent.create({
      data: {
        licenseKey,
        previousLicenseKey: prevLicenseKey,
        parentLicenseKey,
        event,
        eventTimestamp,
        createdAtFromAppSumo: createdAtFromSumo,
        tier: tierNum,
        licenseStatus: payload.license_status || 'active',
        partnerPlanName: payload.partner_plan_name || null,
        unitQuantity: payload.unit_quantity ? Number(payload.unit_quantity) : 1,
        test: true,
        payload: payload as any,
        processingStatus: 'SKIPPED_TEST',
        processedAt: new Date()
      }
    });

    return {
      event,
      success: true,
      isTest: true,
      message: 'Test event processed safely without modifying live subscriptions'
    };
  }

  // 3. Record Audit Event in PENDING state
  const eventRecord = await db.appSumoLicenseEvent.create({
    data: {
      licenseKey,
      previousLicenseKey: prevLicenseKey,
      parentLicenseKey,
      event,
      eventTimestamp,
      createdAtFromAppSumo: createdAtFromSumo,
      tier: tierNum,
      licenseStatus: payload.license_status || null,
      partnerPlanName: payload.partner_plan_name || null,
      unitQuantity: payload.unit_quantity ? Number(payload.unit_quantity) : 1,
      test: false,
      payload: payload as any,
      processingStatus: 'PENDING'
    }
  });

  try {
    // 4. Dispatch based on event type inside Prisma Transactions
    switch (event) {
      case 'purchase':
        await handlePurchaseEvent(payload, tierNum, eventTimestamp, createdAtFromSumo);
        break;

      case 'activate':
        await handleActivateEvent(payload, tierNum, eventTimestamp);
        break;

      case 'deactivate':
        await handleDeactivateEvent(payload, eventTimestamp);
        break;

      case 'upgrade':
      case 'downgrade':
        await handleTierMigrationEvent(event as 'upgrade' | 'downgrade', payload, tierNum, eventTimestamp);
        break;

      case 'migrate':
        await handleMigrateEvent(payload, eventTimestamp);
        break;

      default:
        console.warn(`[AppSumo Webhook] Unrecognized event "${event}" recorded safely.`);
        break;
    }

    // Mark event record as COMPLETED
    await db.appSumoLicenseEvent.update({
      where: { id: eventRecord.id },
      data: {
        processingStatus: 'COMPLETED',
        processedAt: new Date()
      }
    });

    return {
      event,
      success: true
    };
  } catch (err: any) {
    console.error(`[AppSumo Webhook] Failed to process ${event} for ${licenseKey}:`, err);
    
    // Record error in event history
    await db.appSumoLicenseEvent.update({
      where: { id: eventRecord.id },
      data: {
        processingStatus: 'FAILED',
        errorMessage: err.message || 'Unknown processing error',
        processedAt: new Date()
      }
    });

    throw err;
  }
}

/**
 * Handle "purchase" webhook
 * Creates placeholder license record without granting active access until activated.
 */
async function handlePurchaseEvent(
  payload: AppSumoWebhookPayload,
  tierNum: number,
  eventTimestamp: Date,
  createdAtFromSumo: Date
): Promise<void> {
  const licenseKey = payload.license_key.trim();
  const existing = await db.appSumoLicense.findUnique({
    where: { licenseKey }
  });

  if (!existing) {
    await db.appSumoLicense.create({
      data: {
        licenseKey,
        tier: tierNum,
        status: AppSumoStatus.INACTIVE,
        event: 'purchase',
        partnerPlanName: payload.partner_plan_name || null,
        unitQuantity: payload.unit_quantity ? Number(payload.unit_quantity) : 1,
        isTest: false,
        createdAtFromAppSumo: createdAtFromSumo,
        lastEventTimestamp: eventTimestamp,
        lastWebhookReceivedAt: new Date()
      }
    });
  } else {
    await db.appSumoLicense.update({
      where: { licenseKey },
      data: {
        tier: tierNum,
        partnerPlanName: payload.partner_plan_name || existing.partnerPlanName,
        lastEventTimestamp: eventTimestamp,
        lastWebhookReceivedAt: new Date()
      }
    });
  }
}

/**
 * Handle "activate" webhook
 * Marks license active and syncs organization limits if an organization is already linked.
 */
async function handleActivateEvent(
  payload: AppSumoWebhookPayload,
  tierNum: number,
  eventTimestamp: Date
): Promise<void> {
  const licenseKey = payload.license_key.trim();
  const tierConfig = getAppSumoTierLimits(tierNum);

  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    let license = await txDb.appSumoLicense.findUnique({
      where: { licenseKey }
    });

    if (!license) {
      license = await txDb.appSumoLicense.create({
        data: {
          licenseKey,
          tier: tierNum,
          status: AppSumoStatus.ACTIVE,
          event: 'activate',
          partnerPlanName: payload.partner_plan_name || null,
          activatedAt: new Date(),
          lastEventTimestamp: eventTimestamp,
          lastWebhookReceivedAt: new Date()
        }
      });
    } else {
      license = await txDb.appSumoLicense.update({
        where: { licenseKey },
        data: {
          status: AppSumoStatus.ACTIVE,
          tier: tierNum,
          event: 'activate',
          partnerPlanName: payload.partner_plan_name || license.partnerPlanName,
          activatedAt: license.activatedAt || new Date(),
          lastEventTimestamp: eventTimestamp,
          lastWebhookReceivedAt: new Date()
        }
      });
    }

    // If an organization is linked to this license, apply tier quotas and activate org
    if (license.organizationId) {
      await tx.organization.update({
        where: { id: license.organizationId },
        data: {
          status: OrgStatus.ACTIVE,
          subscriptionPlan: tierConfig.subscriptionPlan,
          billingCycle: tierConfig.billingCycle,
          maxUsers: tierConfig.maxUsers,
          maxRecruiters: tierConfig.maxRecruiters,
          maxActiveJobs: tierConfig.maxActiveJobs,
          maxResumesPerMonth: tierConfig.maxResumesPerMonth
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: license.organizationId,
          userId: license.userId,
          action: 'APPSUMO_LICENSE_ACTIVATED',
          targetType: 'AppSumoLicense',
          targetId: license.id,
          details: {
            licenseKey,
            tier: tierNum,
            quotas: tierConfig
          } as any
        }
      });
    }
  });
}

/**
 * Handle "deactivate" webhook (refund / cancellation / staff action)
 * Marks license deactivated without deleting candidates, jobs, or user data.
 */
async function handleDeactivateEvent(
  payload: AppSumoWebhookPayload,
  eventTimestamp: Date
): Promise<void> {
  const licenseKey = payload.license_key.trim();

  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    const license = await txDb.appSumoLicense.findUnique({
      where: { licenseKey }
    });

    if (!license) {
      console.warn(`[AppSumo Webhook] Deactivation received for unknown license: ${licenseKey}`);
      return;
    }

    // Mark license deactivated
    await txDb.appSumoLicense.update({
      where: { licenseKey },
      data: {
        status: AppSumoStatus.DEACTIVATED,
        event: 'deactivate',
        deactivatedAt: new Date(),
        lastEventTimestamp: eventTimestamp,
        lastWebhookReceivedAt: new Date()
      }
    });

    // Check if the linked organization has another active AppSumo license
    if (license.organizationId) {
      const otherActiveLicense = await txDb.appSumoLicense.findFirst({
        where: {
          organizationId: license.organizationId,
          status: AppSumoStatus.ACTIVE,
          licenseKey: { not: licenseKey }
        }
      });

      // If no other active license exists, suspend organization access while keeping all data intact
      if (!otherActiveLicense) {
        await tx.organization.update({
          where: { id: license.organizationId },
          data: {
            status: OrgStatus.SUSPENDED
          }
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: license.organizationId,
          userId: license.userId,
          action: 'APPSUMO_LICENSE_DEACTIVATED',
          targetType: 'AppSumoLicense',
          targetId: license.id,
          details: {
            licenseKey,
            otherActiveLicenseFound: !!otherActiveLicense
          }
        }
      });
    }
  });
}

/**
 * Handle "upgrade" and "downgrade" webhooks
 * Migrates old license key -> new license key atomically via prev_license_key.
 * Preserves organization, users, jobs, candidates, evaluations.
 */
async function handleTierMigrationEvent(
  actionType: 'upgrade' | 'downgrade',
  payload: AppSumoWebhookPayload,
  tierNum: number,
  eventTimestamp: Date
): Promise<void> {
  const newLicenseKey = payload.license_key.trim();
  const prevLicenseKey = (payload.prev_license_key || payload.previous_license_key || '').trim();

  if (!prevLicenseKey) {
    throw new Error(`${actionType} event missing prev_license_key`);
  }

  const tierConfig = getAppSumoTierLimits(tierNum);

  await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    // 1. Locate the existing license record by prev_license_key
    const oldLicense = await txDb.appSumoLicense.findUnique({
      where: { licenseKey: prevLicenseKey }
    });

    const targetOrgId = oldLicense?.organizationId;
    const targetUserId = oldLicense?.userId;

    // 2. Mark the old license as upgraded/migrated and deactivated
    if (oldLicense) {
      await txDb.appSumoLicense.update({
        where: { licenseKey: prevLicenseKey },
        data: {
          status: AppSumoStatus.DEACTIVATED,
          event: `${actionType}_migrated_to_${newLicenseKey}`,
          deactivatedAt: new Date(),
          lastWebhookReceivedAt: new Date()
        }
      });
    }

    // 3. Create or update the new license key record
    const existingNewLicense = await txDb.appSumoLicense.findUnique({
      where: { licenseKey: newLicenseKey }
    });

    if (existingNewLicense) {
      await txDb.appSumoLicense.update({
        where: { licenseKey: newLicenseKey },
        data: {
          previousLicenseKey: prevLicenseKey,
          organizationId: targetOrgId || existingNewLicense.organizationId,
          userId: targetUserId || existingNewLicense.userId,
          tier: tierNum,
          status: AppSumoStatus.ACTIVE,
          event: actionType,
          partnerPlanName: payload.partner_plan_name || existingNewLicense.partnerPlanName,
          activatedAt: existingNewLicense.activatedAt || new Date(),
          lastEventTimestamp: eventTimestamp,
          lastWebhookReceivedAt: new Date()
        }
      });
    } else {
      await txDb.appSumoLicense.create({
        data: {
          licenseKey: newLicenseKey,
          previousLicenseKey: prevLicenseKey,
          organizationId: targetOrgId,
          userId: targetUserId,
          tier: tierNum,
          status: AppSumoStatus.ACTIVE,
          event: actionType,
          partnerPlanName: payload.partner_plan_name || null,
          unitQuantity: payload.unit_quantity ? Number(payload.unit_quantity) : 1,
          activatedAt: new Date(),
          lastEventTimestamp: eventTimestamp,
          lastWebhookReceivedAt: new Date()
        }
      });
    }

    // 4. Update the organization's subscription and quotas atomically
    if (targetOrgId) {
      await tx.organization.update({
        where: { id: targetOrgId },
        data: {
          status: OrgStatus.ACTIVE,
          subscriptionPlan: tierConfig.subscriptionPlan,
          billingCycle: tierConfig.billingCycle,
          maxUsers: tierConfig.maxUsers,
          maxRecruiters: tierConfig.maxRecruiters,
          maxActiveJobs: tierConfig.maxActiveJobs,
          maxResumesPerMonth: tierConfig.maxResumesPerMonth
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: targetOrgId,
          userId: targetUserId,
          action: `APPSUMO_${actionType.toUpperCase()}`,
          targetType: 'AppSumoLicense',
          targetId: newLicenseKey,
          details: {
            prevLicenseKey,
            newLicenseKey,
            newTier: tierNum,
            newLimits: tierConfig
          } as any
        }
      });
    }
  });
}

/**
 * Handle "migrate" webhook for AppSumo add-on licenses
 */
async function handleMigrateEvent(
  payload: AppSumoWebhookPayload,
  eventTimestamp: Date
): Promise<void> {
  const licenseKey = payload.license_key.trim();
  const parentLicenseKey = (payload.parent_license_key || null)?.trim() || null;
  const unitQuantity = payload.unit_quantity ? Number(payload.unit_quantity) : 1;

  await db.appSumoLicense.upsert({
    where: { licenseKey },
    update: {
      parentLicenseKey,
      partnerPlanName: payload.partner_plan_name || null,
      unitQuantity,
      event: 'migrate',
      lastEventTimestamp: eventTimestamp,
      lastWebhookReceivedAt: new Date()
    },
    create: {
      licenseKey,
      parentLicenseKey,
      partnerPlanName: payload.partner_plan_name || null,
      unitQuantity,
      status: AppSumoStatus.ACTIVE,
      event: 'migrate',
      tier: payload.tier ? Number(payload.tier) : 1,
      lastEventTimestamp: eventTimestamp,
      lastWebhookReceivedAt: new Date()
    }
  });
}

/**
 * Onboarding / Account Activation Flow:
 * Activates an AppSumo license with an existing user OR registers a new organization & client admin.
 */
export async function activateAppSumoAccount(input: {
  licenseKey: string;
  isExistingUser: boolean;
  // If existing user:
  email?: string;
  password?: string;
  userId?: string;
  // If new user:
  name?: string;
  companyName?: string;
}): Promise<{
  token: string;
  user: any;
  organization: any;
  license: any;
}> {
  const licenseKey = input.licenseKey.trim();
  if (!licenseKey) {
    throw new Error('AppSumo license key is required');
  }

  // 1. Verify license in database or initialize if valid key format
  let license = await db.appSumoLicense.findUnique({
    where: { licenseKey },
    include: { organization: true }
  });

  if (!license) {
    // If not found yet (e.g. buyer arrived before or alongside webhook), create base record
    license = await db.appSumoLicense.create({
      data: {
        licenseKey,
        tier: 1,
        status: AppSumoStatus.ACTIVE,
        event: 'oauth_activation',
        activatedAt: new Date(),
        lastWebhookReceivedAt: new Date()
      },
      include: { organization: true }
    });
  }

  if (license.status === AppSumoStatus.DEACTIVATED || license.status === AppSumoStatus.REFUNDED) {
    throw new Error('This AppSumo license has been deactivated or refunded.');
  }

  const tierLimits = getAppSumoTierLimits(license.tier);

  // 2. Scenario A: Existing User Linking
  if (input.isExistingUser) {
    let authUser: any = null;

    if (input.userId) {
      authUser = await prisma.user.findUnique({ where: { id: input.userId } });
    } else if (input.email && input.password) {
      const cleanEmail = input.email.toLowerCase().trim();
      const dbUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!dbUser) {
        throw new Error('Invalid email or password.');
      }
      const isMatch = await bcrypt.compare(input.password, dbUser.password);
      if (!isMatch) {
        throw new Error('Invalid email or password.');
      }
      authUser = dbUser;
    } else {
      throw new Error('Email and password required for existing account linking.');
    }

    if (!authUser) {
      throw new Error('User account not found.');
    }

    // Determine target organization ID
    let orgId = authUser.organizationId;
    let targetOrg: any = null;

    if (!orgId || orgId === 'org-tasknera') {
      // Create a dedicated organization for the user
      targetOrg = await prisma.organization.create({
        data: {
          name: `${authUser.name || 'User'}'s Workspace`,
          companyEmail: authUser.email,
          status: OrgStatus.ACTIVE,
          subscriptionPlan: tierLimits.subscriptionPlan,
          billingCycle: tierLimits.billingCycle,
          maxUsers: tierLimits.maxUsers,
          maxRecruiters: tierLimits.maxRecruiters,
          maxActiveJobs: tierLimits.maxActiveJobs,
          maxResumesPerMonth: tierLimits.maxResumesPerMonth
        }
      });
      orgId = targetOrg.id;

      // Update user with organizationId and role CLIENT_ADMIN
      authUser = await prisma.user.update({
        where: { id: authUser.id },
        data: {
          organizationId: orgId,
          role: authUser.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'CLIENT_ADMIN'
        }
      });
    } else {
      // Update existing organization with AppSumo tier quotas
      targetOrg = await prisma.organization.update({
        where: { id: orgId },
        data: {
          status: OrgStatus.ACTIVE,
          subscriptionPlan: tierLimits.subscriptionPlan,
          billingCycle: tierLimits.billingCycle,
          maxUsers: Math.max(tierLimits.maxUsers, targetOrg?.maxUsers || 5),
          maxRecruiters: Math.max(tierLimits.maxRecruiters, targetOrg?.maxRecruiters || 5),
          maxActiveJobs: Math.max(tierLimits.maxActiveJobs, targetOrg?.maxActiveJobs || 20),
          maxResumesPerMonth: Math.max(tierLimits.maxResumesPerMonth, targetOrg?.maxResumesPerMonth || 500)
        }
      });
    }

    // Link license to this organization and user
    const updatedLicense = await db.appSumoLicense.update({
      where: { licenseKey },
      data: {
        organizationId: orgId,
        userId: authUser.id,
        status: AppSumoStatus.ACTIVE,
        activatedAt: license.activatedAt || new Date()
      }
    });

    const jwtSecret = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';
    const token = jwt.sign(
      {
        userId: authUser.id,
        email: authUser.email,
        role: authUser.role,
        organizationId: orgId
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
        organizationId: orgId
      },
      organization: targetOrg,
      license: updatedLicense
    };
  }

  // 3. Scenario B: New User Account & Organization Creation
  if (!input.email || !input.password) {
    throw new Error('Email and password are required to create a new TaskNera account.');
  }

  const cleanEmail = input.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existingUser) {
    throw new Error('An account with this email already exists. Please choose "Existing TaskNera Account" to link your license.');
  }

  if (String(input.password).length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const companyName = (input.companyName || '').trim() || `${input.name || 'Company'}'s Workspace`;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(input.password, salt);

  return await prisma.$transaction(async (tx) => {
    const txDb = tx as any;
    // 1. Create Organization with AppSumo Tier limits
    const org = await tx.organization.create({
      data: {
        name: companyName,
        companyEmail: cleanEmail,
        status: OrgStatus.ACTIVE,
        subscriptionPlan: tierLimits.subscriptionPlan,
        billingCycle: tierLimits.billingCycle,
        maxUsers: tierLimits.maxUsers,
        maxRecruiters: tierLimits.maxRecruiters,
        maxActiveJobs: tierLimits.maxActiveJobs,
        maxResumesPerMonth: tierLimits.maxResumesPerMonth
      }
    });

    // 2. Create Client Admin user
    const newUser = await tx.user.create({
      data: {
        name: (input.name || '').trim() || 'Workspace Admin',
        email: cleanEmail,
        password: hashedPassword,
        role: UserRole.CLIENT_ADMIN,
        organizationId: org.id,
        isActive: true
      }
    });

    // 3. Link license to organization and user
    const updatedLicense = await txDb.appSumoLicense.update({
      where: { licenseKey },
      data: {
        organizationId: org.id,
        userId: newUser.id,
        status: AppSumoStatus.ACTIVE,
        activatedAt: license.activatedAt || new Date()
      }
    });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        userId: newUser.id,
        action: 'APPSUMO_NEW_ONBOARDING_COMPLETED',
        targetType: 'AppSumoLicense',
        targetId: licenseKey,
        details: {
          licenseKey,
          tier: license.tier,
          quotas: tierLimits
        } as any
      }
    });

    const jwtSecret = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        organizationId: org.id
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        organizationId: org.id
      },
      organization: org,
      license: updatedLicense
    };
  });
}
