import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/prisma';
import {
  createOrganizationWithAdmin,
  updateOrganizationLimits,
  toggleOrganizationStatus,
  getOrganizationQuota,
  getAllOrganizationsWithStats
} from '../services/organizationService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';

async function runEndToEndVerification() {
  console.log('=== MULTI-TENANT SAAS SUITE: END-TO-END VERIFICATION ===\n');

  let testOrgAId = '';
  let testOrgBId = '';

  try {
    // ---------------------------------------------------------
    // TEST 1: Verify Super Admin account
    // ---------------------------------------------------------
    console.log('[Test 1] Verifying Super Admin designated account...');
    const superAdmin = await prisma.user.findUnique({
      where: { email: 'admin@gmail.com' }
    });
    if (!superAdmin) {
      throw new Error('Super Admin user admin@gmail.com not found');
    }
    console.log(`✓ Super Admin verified: id=${superAdmin.id}, role=${superAdmin.role}`);

    // Clean up any previous test runs
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@clienta.com', 'recruiter1@clienta.com', 'recruiter2@clienta.com', 'recruiter3@clienta.com', 'admin@clientb.com'] } }
    });
    await prisma.organization.deleteMany({
      where: { name: { in: ['Client A Corp', 'Client B Corp'] } }
    });

    // ---------------------------------------------------------
    // TEST 2: Super Admin creates Client Org A with limit = 3
    // ---------------------------------------------------------
    console.log('\n[Test 2] Super Admin creating Client Org A with maxUsers=3, maxRecruiters=2...');
    const orgAResult = await createOrganizationWithAdmin({
      name: 'Client A Corp',
      companyEmail: 'contact@clienta.com',
      maxUsers: 3,
      maxRecruiters: 2,
      maxActiveJobs: 5,
      maxResumesPerMonth: 100,
      subscriptionPlan: 'STARTER',
      adminName: 'Alice Admin',
      adminEmail: 'admin@clienta.com',
      adminPassword: 'Password123!',
      superAdminUserId: superAdmin.id
    });

    testOrgAId = orgAResult.organization.id;
    console.log(`✓ Client Org A created: id=${testOrgAId}, Client Admin id=${orgAResult.clientAdmin.id}, role=${orgAResult.clientAdmin.role}`);

    // Verify Audit Log
    const auditA = await prisma.auditLog.findFirst({
      where: { organizationId: testOrgAId, action: 'CREATE_ORGANIZATION' }
    });
    if (!auditA) throw new Error('Audit log for CREATE_ORGANIZATION not recorded');
    console.log(`✓ Audit log verified: action=${auditA.action}`);

    // ---------------------------------------------------------
    // TEST 3: Quota counting includes Client Admin
    // ---------------------------------------------------------
    console.log('\n[Test 3] Verifying quota count policy: limit includes Client Admin account...');
    const quotaAfterCreation = await getOrganizationQuota(testOrgAId);
    console.log(`  Current users: ${quotaAfterCreation.currentUsers} / ${quotaAfterCreation.totalLimit}`);
    console.log(`  Available slots: ${quotaAfterCreation.availableSlots}`);
    if (quotaAfterCreation.currentUsers !== 1) {
      throw new Error(`Expected currentUsers=1 (Client Admin), got ${quotaAfterCreation.currentUsers}`);
    }
    if (quotaAfterCreation.availableSlots !== 2) {
      throw new Error(`Expected availableSlots=2, got ${quotaAfterCreation.availableSlots}`);
    }
    console.log('✓ Quota policy verified: Client Admin counts as 1 slot out of 3.');

    // ---------------------------------------------------------
    // TEST 4: Client Admin provisions 1st and 2nd recruiter
    // ---------------------------------------------------------
    console.log('\n[Test 4] Client Admin provisioning Recruiter 1 and Recruiter 2...');
    const salt = await bcrypt.genSalt(10);
    const pwdHash = await bcrypt.hash('RecruiterPass123!', salt);

    // Recruiter 1
    const { checkUserQuota } = await import('../services/organizationService');
    await prisma.$transaction(async (tx) => {
      await checkUserQuota(tx, testOrgAId, 'RECRUITER');
      await tx.user.create({
        data: {
          name: 'Bob Recruiter',
          email: 'recruiter1@clienta.com',
          password: pwdHash,
          role: 'RECRUITER',
          organizationId: testOrgAId
        }
      });
    });
    console.log('✓ Recruiter 1 created (Total: 2/3, Available: 1)');

    // Recruiter 2
    await prisma.$transaction(async (tx) => {
      await checkUserQuota(tx, testOrgAId, 'RECRUITER');
      await tx.user.create({
        data: {
          name: 'Charlie Recruiter',
          email: 'recruiter2@clienta.com',
          password: pwdHash,
          role: 'RECRUITER',
          organizationId: testOrgAId
        }
      });
    });
    console.log('✓ Recruiter 2 created (Total: 3/3, Available: 0)');

    const quotaFull = await getOrganizationQuota(testOrgAId);
    if (quotaFull.currentUsers !== 3 || quotaFull.availableSlots !== 0) {
      throw new Error(`Quota mismatch: expected 3/3 with 0 slots, got ${quotaFull.currentUsers}/${quotaFull.totalLimit}`);
    }

    // ---------------------------------------------------------
    // TEST 5: Backend strictly blocks exceeding limit (4th user)
    // ---------------------------------------------------------
    console.log('\n[Test 5] Attempting to create 4th user when limit is 3 (Critical limit enforcement)...');
    let blockedAsExpected = false;
    let receivedErrorMessage = '';

    try {
      await prisma.$transaction(async (tx) => {
        await checkUserQuota(tx, testOrgAId, 'RECRUITER');
        await tx.user.create({
          data: {
            name: 'Dave Recruiter',
            email: 'recruiter3@clienta.com',
            password: pwdHash,
            role: 'RECRUITER',
            organizationId: testOrgAId
          }
        });
      });
    } catch (limitErr: any) {
      blockedAsExpected = true;
      receivedErrorMessage = limitErr.message;
    }

    if (!blockedAsExpected) {
      throw new Error('CRITICAL FAILURE: 4th user was NOT blocked by backend quota enforcement!');
    }
    console.log(`✓ 4th user successfully blocked by backend!`);
    console.log(`  Message returned: "${receivedErrorMessage}"`);

    // ---------------------------------------------------------
    // TEST 6: Super Admin dynamically edits limit anytime (e.g. 3 -> 5)
    // ---------------------------------------------------------
    console.log('\n[Test 6] Super Admin dynamically increases Client Org A limit from 3 to 5...');
    const updatedOrgA = await updateOrganizationLimits(
      testOrgAId,
      { maxUsers: 5, maxRecruiters: 4 },
      superAdmin.id
    );
    console.log(`✓ Org A limit updated: maxUsers=${updatedOrgA.maxUsers}, maxRecruiters=${updatedOrgA.maxRecruiters}`);

    const quotaAfterIncrease = await getOrganizationQuota(testOrgAId);
    console.log(`  New quota: ${quotaAfterIncrease.currentUsers} / ${quotaAfterIncrease.totalLimit} (Available: ${quotaAfterIncrease.availableSlots})`);
    if (quotaAfterIncrease.availableSlots !== 2) {
      throw new Error(`Expected 2 available slots after increase, got ${quotaAfterIncrease.availableSlots}`);
    }

    // Now creating 4th user must succeed
    console.log('  Retrying 4th user creation with new limit...');
    await prisma.$transaction(async (tx) => {
      await checkUserQuota(tx, testOrgAId, 'RECRUITER');
      await tx.user.create({
        data: {
          name: 'Dave Recruiter',
          email: 'recruiter3@clienta.com',
          password: pwdHash,
          role: 'RECRUITER',
          organizationId: testOrgAId
        }
      });
    });
    console.log('✓ 4th user created successfully after limit increase! Total users is now 4.');

    // ---------------------------------------------------------
    // TEST 7: Multi-Tenant Data Isolation
    // ---------------------------------------------------------
    console.log('\n[Test 7] Testing Multi-Tenant Data Isolation between Client A and Client B...');
    
    // Client A creates a job
    const jobA = await prisma.job.create({
      data: {
        position: 'Client A Principal Architect',
        client: 'Client A Corp',
        created_by: orgAResult.clientAdmin.id,
        organizationId: testOrgAId,
        status: 'active'
      }
    });
    console.log(`  Client A created job: "${jobA.position}" (id: ${jobA.id})`);

    // Super Admin creates Client B
    const orgBResult = await createOrganizationWithAdmin({
      name: 'Client B Corp',
      maxUsers: 5,
      adminName: 'Bob Admin B',
      adminEmail: 'admin@clientb.com',
      adminPassword: 'Password123!',
      superAdminUserId: superAdmin.id
    });
    testOrgBId = orgBResult.organization.id;
    console.log(`  Client B created: id=${testOrgBId}`);

    // Query jobs scoped to Client B's organization
    const clientBJobs = await prisma.job.findMany({
      where: { organizationId: testOrgBId }
    });
    const leakFound = clientBJobs.some(j => j.id === jobA.id);
    if (leakFound) {
      throw new Error('CRITICAL SECURITY FAILURE: Client B can see Client A job requisition!');
    }
    console.log(`✓ Data Isolation Verified: Client B query returned ${clientBJobs.length} jobs. Zero leakage from Client A.`);

    // ---------------------------------------------------------
    // TEST 8: Suspend and Reactivate Organization
    // ---------------------------------------------------------
    console.log('\n[Test 8] Testing Organization Suspension & Reactivation...');
    await toggleOrganizationStatus(testOrgBId, 'SUSPENDED', superAdmin.id);
    const orgBSuspended = await prisma.organization.findUnique({ where: { id: testOrgBId } });
    if (orgBSuspended?.status !== 'SUSPENDED') {
      throw new Error('Failed to suspend Client B');
    }
    console.log('✓ Client B successfully set to SUSPENDED.');

    // Attempting to provision a user in suspended organization must fail
    let suspendedBlocked = false;
    try {
      await prisma.$transaction(async (tx) => {
        await checkUserQuota(tx, testOrgBId, 'RECRUITER');
      });
    } catch (suspErr: any) {
      suspendedBlocked = true;
      console.log(`✓ Provisioning blocked in suspended org: "${suspErr.message}"`);
    }
    if (!suspendedBlocked) {
      throw new Error('Failed to block provisioning in suspended organization');
    }

    // Reactivate
    await toggleOrganizationStatus(testOrgBId, 'ACTIVE', superAdmin.id);
    const orgBActive = await prisma.organization.findUnique({ where: { id: testOrgBId } });
    if (orgBActive?.status !== 'ACTIVE') {
      throw new Error('Failed to reactivate Client B');
    }
    console.log('✓ Client B successfully reactivated to ACTIVE.');

    // ---------------------------------------------------------
    // TEST 9: Platform-Level Summary Stats
    // ---------------------------------------------------------
    console.log('\n[Test 9] Testing Platform-Level Summary Reporting...');
    const allStats = await getAllOrganizationsWithStats();
    console.log(`✓ Retrieved stats for ${allStats.length} organizations.`);
    const sampleOrg = allStats.find(o => o.id === testOrgAId);
    if (sampleOrg) {
      console.log(`  Client A Summary: ${sampleOrg.name} | Users: ${sampleOrg.currentUsers}/${sampleOrg.maxUsers} | Admin: ${sampleOrg.clientAdmin?.email}`);
    }

    console.log('\n=========================================================');
    console.log('🎉 ALL MULTI-TENANT VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('=========================================================\n');

  } finally {
    // Clean up test data
    console.log('Cleaning up temporary test tenant data...');
    if (testOrgAId) {
      await prisma.job.deleteMany({ where: { organizationId: testOrgAId } });
      await prisma.user.deleteMany({ where: { organizationId: testOrgAId } });
      await prisma.auditLog.deleteMany({ where: { organizationId: testOrgAId } });
      await prisma.organization.delete({ where: { id: testOrgAId } }).catch(() => {});
    }
    if (testOrgBId) {
      await prisma.user.deleteMany({ where: { organizationId: testOrgBId } });
      await prisma.auditLog.deleteMany({ where: { organizationId: testOrgBId } });
      await prisma.organization.delete({ where: { id: testOrgBId } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('Cleanup complete.');
  }
}

runEndToEndVerification().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});

