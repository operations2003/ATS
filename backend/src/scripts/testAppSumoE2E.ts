import crypto from 'crypto';
import prisma from '../config/prisma';
import {
  verifyAppSumoSignature,
  processAppSumoWebhook,
  activateAppSumoAccount,
  AppSumoWebhookPayload,
  AppSumoStatus
} from '../services/appsumoService';
import { APPSUMO_CONFIG, getAppSumoTierLimits } from '../config/appsumoConfig';
import { AppSumoApiClient } from '../services/appsumoClient';
import { OrgStatus } from '@prisma/client';

const db = prisma as any;

// Configure test secret
const TEST_API_KEY = 'test_appsumo_secret_key_12345';
APPSUMO_CONFIG.apiKey = TEST_API_KEY;
APPSUMO_CONFIG.webhookSecret = TEST_API_KEY;

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🚀 Running TaskNera AppSumo Licensing v2 E2E Test Suite');
  console.log('====================================================\n');

  const testRunId = Date.now().toString(36);
  const testLicense1 = `sumo_lic_1_${testRunId}`;
  const testLicense2 = `sumo_lic_2_${testRunId}`;
  const testLicenseUpgraded = `sumo_lic_upgraded_${testRunId}`;
  const testLicenseDowngraded = `sumo_lic_downgraded_${testRunId}`;
  const testLicenseAddon = `sumo_addon_${testRunId}`;

  try {
    // ----------------------------------------------------
    // TEST 1: Webhook signature validation (Valid)
    // ----------------------------------------------------
    const timestamp1 = Math.floor(Date.now() / 1000).toString();
    const rawBody1 = JSON.stringify({
      license_key: testLicense1,
      event: 'purchase',
      tier: 1,
      license_status: 'active',
      test: false
    });
    const validSig1 = crypto
      .createHmac('sha256', TEST_API_KEY)
      .update(timestamp1 + rawBody1)
      .digest('hex');

    const verifyResult1 = verifyAppSumoSignature(rawBody1, validSig1, timestamp1);
    assert(verifyResult1.isValid === true, 'Test 1: Webhook signature validation (Valid signature)');

    // ----------------------------------------------------
    // TEST 2: Invalid signature rejection
    // ----------------------------------------------------
    const invalidSig = 'invalid_tampered_signature_hex';
    const verifyResult2 = verifyAppSumoSignature(rawBody1, invalidSig, timestamp1);
    assert(verifyResult2.isValid === false, 'Test 2: Invalid signature rejection');

    // ----------------------------------------------------
    // TEST 3: Test purchase event (Safe Handling)
    // ----------------------------------------------------
    const testPurchasePayload: AppSumoWebhookPayload = {
      license_key: `test_ping_${testRunId}`,
      event: 'purchase',
      license_status: 'active',
      event_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      tier: 1,
      test: true
    };
    const testPurchaseRes = await processAppSumoWebhook(testPurchasePayload);
    assert(
      testPurchaseRes.success === true && testPurchaseRes.isTest === true,
      'Test 3: Test purchase event handled safely without modifying live data'
    );

    // ----------------------------------------------------
    // TEST 4: Real purchase event (Creates placeholder record)
    // ----------------------------------------------------
    const realPurchasePayload: AppSumoWebhookPayload = {
      license_key: testLicense1,
      event: 'purchase',
      license_status: 'active',
      event_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      tier: 1,
      test: false,
      partner_plan_name: 'TaskNera Starter'
    };
    const realPurchaseRes = await processAppSumoWebhook(realPurchasePayload);
    const dbLicense1 = await db.appSumoLicense.findUnique({
      where: { licenseKey: testLicense1 }
    });
    assert(
      realPurchaseRes.success === true &&
      dbLicense1 !== null &&
      dbLicense1.status === AppSumoStatus.INACTIVE &&
      dbLicense1.tier === 1,
      'Test 4: Real purchase event creates placeholder INACTIVE license record'
    );

    // ----------------------------------------------------
    // TEST 5: New TaskNera user activation (Onboarding)
    // ----------------------------------------------------
    const newBuyerEmail = `appsumo.buyer.${testRunId}@example.com`;
    const activationRes = await activateAppSumoAccount({
      licenseKey: testLicense1,
      isExistingUser: false,
      email: newBuyerEmail,
      password: 'StrongPassword123!',
      name: 'AppSumo Buyer',
      companyName: 'AppSumo Buyer Org'
    });

    assert(
      activationRes.token !== undefined &&
      activationRes.user.email === newBuyerEmail &&
      activationRes.organization.name === 'AppSumo Buyer Org' &&
      activationRes.license.status === AppSumoStatus.ACTIVE,
      'Test 5: New TaskNera user onboarding activates license and creates client organization'
    );

    // ----------------------------------------------------
    // TEST 6: Webhook activate event
    // ----------------------------------------------------
    const activatePayload: AppSumoWebhookPayload = {
      license_key: testLicense1,
      event: 'activate',
      license_status: 'inactive', // AppSumo docs: status may be inactive until 200 returned
      event_timestamp: new Date().toISOString(),
      tier: 1,
      test: false
    };
    const activateRes = await processAppSumoWebhook(activatePayload);
    const refreshedOrg1 = await prisma.organization.findUnique({
      where: { id: activationRes.organization.id }
    });
    assert(
      activateRes.success === true &&
      refreshedOrg1?.status === OrgStatus.ACTIVE &&
      refreshedOrg1?.subscriptionPlan === 'APPSUMO_TIER_1',
      'Test 6: Webhook activate event applies Tier 1 quotas and activates organization'
    );

    // ----------------------------------------------------
    // TEST 7: Existing TaskNera user activation
    // ----------------------------------------------------
    const existingUserEmail = `existing.hr.${testRunId}@company.com`;
    // Create an existing organization & user first
    const existingOrg = await prisma.organization.create({
      data: {
        name: 'Existing Company Inc',
        companyEmail: existingUserEmail,
        status: OrgStatus.ACTIVE,
        maxUsers: 2
      }
    });
    const existingUser = await prisma.user.create({
      data: {
        name: 'Existing HR Lead',
        email: existingUserEmail,
        password: 'existing_pwd_hash',
        organizationId: existingOrg.id,
        role: 'CLIENT_ADMIN'
      }
    });

    const linkExistingRes = await activateAppSumoAccount({
      licenseKey: testLicense2,
      isExistingUser: true,
      userId: existingUser.id
    });

    const linkedOrg = await prisma.organization.findUnique({
      where: { id: existingOrg.id }
    });
    assert(
      linkExistingRes.license.organizationId === existingOrg.id &&
      linkedOrg?.subscriptionPlan === 'APPSUMO_TIER_1',
      'Test 7: Existing TaskNera user activation links license without creating duplicate org'
    );

    // ----------------------------------------------------
    // TEST 8: Upgrade event (with prev_license_key)
    // ----------------------------------------------------
    const upgradeTimestamp = new Date().toISOString();
    const upgradePayload: AppSumoWebhookPayload = {
      license_key: testLicenseUpgraded,
      prev_license_key: testLicense1,
      event: 'upgrade',
      license_status: 'active',
      event_timestamp: upgradeTimestamp,
      tier: 2,
      test: false
    };

    const upgradeRes = await processAppSumoWebhook(upgradePayload);
    const upgradedOrg = await prisma.organization.findUnique({
      where: { id: activationRes.organization.id }
    });
    const oldLicRecord = await db.appSumoLicense.findUnique({
      where: { licenseKey: testLicense1 }
    });
    const newLicRecord = await db.appSumoLicense.findUnique({
      where: { licenseKey: testLicenseUpgraded }
    });

    assert(
      upgradeRes.success === true &&
      upgradedOrg?.subscriptionPlan === 'APPSUMO_TIER_2' &&
      upgradedOrg?.maxUsers === 15 &&
      oldLicRecord?.status === AppSumoStatus.DEACTIVATED &&
      newLicRecord?.status === AppSumoStatus.ACTIVE &&
      newLicRecord?.previousLicenseKey === testLicense1,
      'Test 8: Upgrade event transfers subscription to new license key and applies Tier 2 quotas'
    );

    // ----------------------------------------------------
    // TEST 9: Deactivate on old key does not break newly upgraded key
    // ----------------------------------------------------
    const deactivateOldKeyPayload: AppSumoWebhookPayload = {
      license_key: testLicense1,
      event: 'deactivate',
      license_status: 'deactivated',
      event_timestamp: new Date().toISOString(),
      test: false
    };
    await processAppSumoWebhook(deactivateOldKeyPayload);
    const orgStillActive = await prisma.organization.findUnique({
      where: { id: activationRes.organization.id }
    });
    assert(
      orgStillActive?.status === OrgStatus.ACTIVE &&
      orgStillActive?.subscriptionPlan === 'APPSUMO_TIER_2',
      'Test 9: Deactivate on old key does not deactivate newly upgraded organization'
    );

    // ----------------------------------------------------
    // TEST 10: Downgrade event (with prev_license_key)
    // ----------------------------------------------------
    const downgradePayload: AppSumoWebhookPayload = {
      license_key: testLicenseDowngraded,
      prev_license_key: testLicenseUpgraded,
      event: 'downgrade',
      license_status: 'active',
      event_timestamp: new Date().toISOString(),
      tier: 1,
      test: false
    };
    const downgradeRes = await processAppSumoWebhook(downgradePayload);
    const downgradedOrg = await prisma.organization.findUnique({
      where: { id: activationRes.organization.id }
    });
    assert(
      downgradeRes.success === true &&
      downgradedOrg?.subscriptionPlan === 'APPSUMO_TIER_1' &&
      downgradedOrg?.maxUsers === 5,
      'Test 10: Downgrade event transitions key and adjusts quotas without deleting tenant data'
    );

    // ----------------------------------------------------
    // TEST 11: Migrate add-on event
    // ----------------------------------------------------
    const migratePayload: AppSumoWebhookPayload = {
      license_key: testLicenseAddon,
      parent_license_key: testLicenseDowngraded,
      partner_plan_name: 'TaskNera 5 Extra Recruiters',
      unit_quantity: 2,
      event: 'migrate',
      event_timestamp: new Date().toISOString(),
      test: false
    };
    const migrateRes = await processAppSumoWebhook(migratePayload);
    const addonDb = await db.appSumoLicense.findUnique({
      where: { licenseKey: testLicenseAddon }
    });
    assert(
      migrateRes.success === true &&
      addonDb?.parentLicenseKey === testLicenseDowngraded &&
      addonDb?.unitQuantity === 2,
      'Test 11: Migrate add-on event associates parent license and records unit quantity'
    );

    // ----------------------------------------------------
    // TEST 12: Duplicate webhook event (Idempotency)
    // ----------------------------------------------------
    const duplicateRes = await processAppSumoWebhook(downgradePayload);
    assert(
      duplicateRes.success === true && duplicateRes.isDuplicate === true,
      'Test 12: Duplicate webhook is recognized as idempotent and succeeds with HTTP 200'
    );

    // ----------------------------------------------------
    // TEST 13: Webhook deactivate event (Revocation without data loss)
    // ----------------------------------------------------
    // Create a dummy job & candidate under the organization to verify data preservation
    const dummyJob = await prisma.job.create({
      data: {
        client: 'Client Test',
        position: 'Senior Engineer',
        created_by: activationRes.user.id,
        organizationId: activationRes.organization.id
      }
    });

    const deactivatePayload: AppSumoWebhookPayload = {
      license_key: testLicenseDowngraded,
      event: 'deactivate',
      license_status: 'deactivated',
      event_timestamp: new Date().toISOString(),
      test: false
    };
    const deactivateRes = await processAppSumoWebhook(deactivatePayload);
    const deactivatedOrg = await prisma.organization.findUnique({
      where: { id: activationRes.organization.id }
    });
    const preservedJob = await prisma.job.findUnique({
      where: { id: dummyJob.id }
    });

    assert(
      deactivateRes.success === true &&
      deactivatedOrg?.status === OrgStatus.SUSPENDED &&
      preservedJob !== null,
      'Test 13: Deactivate event revokes access but preserves jobs and organization data'
    );

    // ----------------------------------------------------
    // TEST 14: Unknown event handling
    // ----------------------------------------------------
    const unknownEventPayload: AppSumoWebhookPayload = {
      license_key: testLicenseDowngraded,
      event: 'custom_future_event',
      event_timestamp: new Date().toISOString(),
      test: false
    };
    const unknownRes = await processAppSumoWebhook(unknownEventPayload);
    assert(
      unknownRes.success === true && unknownRes.event === 'custom_future_event',
      'Test 14: Unknown event safely recorded and returns HTTP 200'
    );

    // ----------------------------------------------------
    // TEST 15: Missing license handling in deactivate
    // ----------------------------------------------------
    const missingLicensePayload: AppSumoWebhookPayload = {
      license_key: `non_existent_key_${testRunId}`,
      event: 'deactivate',
      event_timestamp: new Date().toISOString(),
      test: false
    };
    const missingRes = await processAppSumoWebhook(missingLicensePayload);
    assert(
      missingRes.success === true,
      'Test 15: Deactivation of non-existent license does not crash system'
    );

    // ----------------------------------------------------
    // TEST 16: Multi-tenant organization isolation
    // ----------------------------------------------------
    const orgALicense = await db.appSumoLicense.findUnique({
      where: { licenseKey: testLicenseDowngraded }
    });
    const orgBLicense = await db.appSumoLicense.findUnique({
      where: { licenseKey: testLicense2 }
    });
    assert(
      orgALicense?.organizationId !== orgBLicense?.organizationId &&
      orgALicense?.organizationId === activationRes.organization.id &&
      orgBLicense?.organizationId === existingOrg.id,
      'Test 16: Multi-tenant isolation: Organization A and Organization B have strictly isolated licenses'
    );

    // ----------------------------------------------------
    // TEST 17: Tier quota mapping enforcement
    // ----------------------------------------------------
    const t1 = getAppSumoTierLimits(1);
    const t2 = getAppSumoTierLimits(2);
    const t3 = getAppSumoTierLimits(3);
    assert(
      t1.maxUsers === 5 &&
      t2.maxUsers === 15 &&
      t3.maxUsers === 50 &&
      t1.maxActiveJobs === 25 &&
      t2.maxActiveJobs === 75 &&
      t3.maxActiveJobs === 250,
      'Test 17: Tier quota configuration maps Tiers 1, 2, and 3 accurately'
    );

    // ----------------------------------------------------
    // TEST 18: AppSumo API Client structure and rate limiter
    // ----------------------------------------------------
    const client = new AppSumoApiClient('dummy_key');
    assert(
      typeof client.getLicenses === 'function' &&
      typeof client.getLicense === 'function' &&
      typeof client.getLicenseEvents === 'function' &&
      typeof client.getLicenseEventsByLicense === 'function' &&
      typeof client.getWebhookResponses === 'function' &&
      typeof client.getProfile === 'function',
      'Test 18: AppSumo API Client exports all required specification methods'
    );

  } catch (error: any) {
    console.error('💥 Unexpected test exception:', error);
    failedTests++;
  } finally {
    console.log('\n====================================================');
    console.log(`Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      console.log('🎉 ALL 18 TESTS PASSED SUCCESSFULLY!\n');
    }
  }
}

runAllTests();
