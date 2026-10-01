import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';
const API_BASE = 'http://127.0.0.1:5000/api';

interface AuthContext {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  };
}

function makeToken(user: { id: string; email: string; role: string; organizationId: string }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function api(path: string, options: { method?: string; token?: string; body?: any } = {}) {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('================================================================');
  console.log('       ATS MULTI-TENANT COMPANY DATA ISOLATION VERIFICATION     ');
  console.log('================================================================\n');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('TestPass123!', salt);

  const orgAId = `test-org-a-${Date.now()}`;
  const orgBId = `test-org-b-${Date.now()}`;

  let jobIdA = '';
  let candidateIdA = '';
  let evalIdA = '';

  try {
    // -------------------------------------------------------------
    // Step 1: Create Company A and Company B
    // -------------------------------------------------------------
    console.log('[Step 1] Creating Company A and Company B...');
    const orgA = await prisma.organization.create({
      data: {
        id: orgAId,
        name: 'Company Alpha',
        companyEmail: 'contact@alpha.com',
        maxUsers: 10,
        maxRecruiters: 5,
        maxActiveJobs: 10,
        maxResumesPerMonth: 500,
        status: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE',
      }
    });

    const orgB = await prisma.organization.create({
      data: {
        id: orgBId,
        name: 'Company Beta',
        companyEmail: 'contact@beta.com',
        maxUsers: 10,
        maxRecruiters: 5,
        maxActiveJobs: 10,
        maxResumesPerMonth: 500,
        status: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE',
      }
    });
    console.log(`✓ Created Organization A (${orgA.id}) and Organization B (${orgB.id})`);

    // -------------------------------------------------------------
    // Step 2: Create Users for Company A and Company B
    // -------------------------------------------------------------
    console.log('\n[Step 2] Creating Users under Company A and Company B...');
    // Company A: Admin A, User A1 (Recruiter), User A2 (Recruiter)
    const adminA = await prisma.user.create({
      data: {
        name: 'Admin Alpha',
        email: `admin.alpha.${Date.now()}@alpha.com`,
        password: passwordHash,
        role: 'CLIENT_ADMIN',
        organizationId: orgAId,
        isActive: true
      }
    });

    const userA1 = await prisma.user.create({
      data: {
        name: 'Recruiter A1',
        email: `recruiter.a1.${Date.now()}@alpha.com`,
        password: passwordHash,
        role: 'MEMBER',
        organizationId: orgAId,
        isActive: true
      }
    });

    const userA2 = await prisma.user.create({
      data: {
        name: 'Recruiter A2',
        email: `recruiter.a2.${Date.now()}@alpha.com`,
        password: passwordHash,
        role: 'MEMBER',
        organizationId: orgAId,
        isActive: true
      }
    });

    // Company B: Admin B, User B1 (Recruiter), User B2 (Recruiter)
    const adminB = await prisma.user.create({
      data: {
        name: 'Admin Beta',
        email: `admin.beta.${Date.now()}@beta.com`,
        password: passwordHash,
        role: 'CLIENT_ADMIN',
        organizationId: orgBId,
        isActive: true
      }
    });

    const userB1 = await prisma.user.create({
      data: {
        name: 'Recruiter B1',
        email: `recruiter.b1.${Date.now()}@beta.com`,
        password: passwordHash,
        role: 'MEMBER',
        organizationId: orgBId,
        isActive: true
      }
    });

    const userB2 = await prisma.user.create({
      data: {
        name: 'Recruiter B2',
        email: `recruiter.b2.${Date.now()}@beta.com`,
        password: passwordHash,
        role: 'MEMBER',
        organizationId: orgBId,
        isActive: true
      }
    });

    const tokenAdminA = makeToken({ id: adminA.id, email: adminA.email, role: adminA.role, organizationId: orgAId });
    const tokenA1 = makeToken({ id: userA1.id, email: userA1.email, role: userA1.role, organizationId: orgAId });
    const tokenA2 = makeToken({ id: userA2.id, email: userA2.email, role: userA2.role, organizationId: orgAId });

    const tokenAdminB = makeToken({ id: adminB.id, email: adminB.email, role: adminB.role, organizationId: orgBId });
    const tokenB1 = makeToken({ id: userB1.id, email: userB1.email, role: userB1.role, organizationId: orgBId });
    const tokenB2 = makeToken({ id: userB2.id, email: userB2.email, role: userB2.role, organizationId: orgBId });

    console.log('✓ Created 3 users for Company A and 3 users for Company B.');

    // -------------------------------------------------------------
    // Step 3: User A1 creates a Job in Company A
    // -------------------------------------------------------------
    console.log('\n[Step 3] User A1 creating a Job for Company A...');
    const createJobRes = await api('/jobs', {
      method: 'POST',
      token: tokenA1,
      body: {
        position: 'Senior Python Engineer',
        client: 'Alpha Financial Systems',
        location: 'San Francisco, CA',
        work_mode: 'Hybrid',
        jd_text: 'We are seeking a Senior Python Engineer with 5+ years experience in FastAPI, Postgres, and Docker.'
      }
    });

    if (!createJobRes.ok || !createJobRes.data?.job?.id) {
      throw new Error(`Failed to create Job A: ${JSON.stringify(createJobRes.data)}`);
    }
    jobIdA = createJobRes.data.job.id;
    console.log(`✓ Job A created: id=${jobIdA}, organizationId=${createJobRes.data.job.organizationId}`);

    // Verify DB association
    const dbJob = await prisma.job.findUnique({ where: { id: jobIdA } });
    if (dbJob?.organizationId !== orgAId) {
      throw new Error(`Job A DB organizationId mismatch: expected ${orgAId}, got ${dbJob?.organizationId}`);
    }
    console.log(`✓ Database verified: Job A belongs to ${orgAId}`);

    // -------------------------------------------------------------
    // Step 4: User A1 creates a Candidate in Company A
    // -------------------------------------------------------------
    console.log('\n[Step 4] User A1 creating a Candidate record in Company A pool...');
    const candidateA = await prisma.candidate.create({
      data: {
        name: 'Alice Candidate Alpha',
        email: `alice.alpha.${Date.now()}@example.com`,
        phone: '+1-555-0199',
        location: 'San Francisco, CA',
        current_title: 'Python Developer',
        current_company: 'Tech Alpha Inc',
        summary: 'Experienced Python developer with 4 years building backend APIs with FastAPI and PostgreSQL.',
        raw_text: 'Alice Candidate. 4 years experience Python, FastAPI, Postgres, Docker.',
        parsing_status: 'PARSED',
        created_by: userA1.id,
        organizationId: orgAId,
        skills: {
          create: [
            { skill: 'Python' },
            { skill: 'FastAPI' },
            { skill: 'PostgreSQL' }
          ]
        }
      }
    });
    candidateIdA = candidateA.id;
    console.log(`✓ Candidate A created: id=${candidateIdA}, organizationId=${candidateA.organizationId}`);

    // -------------------------------------------------------------
    // Step 5: User A1 evaluates Candidate A against Job A
    // -------------------------------------------------------------
    console.log('\n[Step 5] User A1 evaluating Candidate A against Job A...');
    const matchRes = await api(`/candidates/${candidateIdA}/match-with-job`, {
      method: 'POST',
      token: tokenA1,
      body: { jobId: jobIdA }
    });

    if (!matchRes.ok) {
      throw new Error(`Failed to match Candidate A: ${JSON.stringify(matchRes.data)}`);
    }
    evalIdA = matchRes.data.evaluationId;
    console.log(`✓ Evaluation A created: evalId=${evalIdA}, score=${matchRes.data.overallScore}`);

    // Verify DB Evaluation organizationId
    const dbEval = await prisma.evaluation.findUnique({ where: { id: evalIdA } });
    if (dbEval?.organizationId !== orgAId) {
      throw new Error(`Evaluation A DB organizationId mismatch: expected ${orgAId}, got ${dbEval?.organizationId}`);
    }
    console.log(`✓ Database verified: Evaluation belongs to ${orgAId}`);

    // -------------------------------------------------------------
    // Step 6: Verify User B1 (Company B) CANNOT see Company A's Job
    // -------------------------------------------------------------
    console.log('\n[Step 6] Testing isolation: Company B listing Jobs...');
    const listJobsB = await api('/jobs', { token: tokenB1 });
    const bJobIds = (listJobsB.data?.jobs || []).map((j: any) => j.id);
    if (bJobIds.includes(jobIdA)) {
      throw new Error('CRITICAL LEAK: User B1 can see Company A Job in jobs list!');
    }
    console.log(`✓ PASS: User B1 cannot see Job A in job list (Jobs returned: ${bJobIds.length}).`);

    console.log('Testing direct GET /jobs/:jobId as User B1...');
    const getJobB = await api(`/jobs/${jobIdA}`, { token: tokenB1 });
    if (getJobB.status !== 403 && getJobB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 got status ${getJobB.status} accessing Job A! Expected 403 or 404.`);
    }
    console.log(`✓ PASS: Direct access to Job A by User B1 correctly rejected with ${getJobB.status} Forbidden.`);

    console.log('Testing PUT /jobs/:jobId (update) as User B1...');
    const updateJobB = await api(`/jobs/${jobIdA}`, {
      method: 'PUT',
      token: tokenB1,
      body: { position: 'Hacked Job Position' }
    });
    if (updateJobB.status !== 403 && updateJobB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 update to Job A returned status ${updateJobB.status}!`);
    }
    console.log(`✓ PASS: Mutation on Job A by User B1 correctly rejected with ${updateJobB.status} Forbidden.`);

    console.log('Testing DELETE /jobs/:jobId as User B1...');
    const deleteJobB = await api(`/jobs/${jobIdA}`, {
      method: 'DELETE',
      token: tokenB1
    });
    if (deleteJobB.status !== 403 && deleteJobB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 delete to Job A returned status ${deleteJobB.status}!`);
    }
    console.log(`✓ PASS: Delete Job A by User B1 correctly rejected with ${deleteJobB.status} Forbidden.`);

    // -------------------------------------------------------------
    // Step 7: Verify User B1 (Company B) CANNOT see Company A's Candidate
    // -------------------------------------------------------------
    console.log('\n[Step 7] Testing isolation: Company B listing Candidates...');
    const listCandidatesB = await api('/candidates', { token: tokenB1 });
    const bCandIds = (listCandidatesB.data?.candidates || []).map((c: any) => c.id);
    if (bCandIds.includes(candidateIdA)) {
      throw new Error('CRITICAL LEAK: User B1 can see Candidate A in candidate list!');
    }
    console.log(`✓ PASS: User B1 cannot see Candidate A in pool (Candidates returned: ${bCandIds.length}).`);

    console.log('Testing direct GET /candidates/:candidateId as User B1...');
    const getCandB = await api(`/candidates/${candidateIdA}`, { token: tokenB1 });
    if (getCandB.status !== 403 && getCandB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 got status ${getCandB.status} accessing Candidate A! Expected 403 or 404.`);
    }
    console.log(`✓ PASS: Direct access to Candidate A by User B1 correctly rejected with ${getCandB.status}.`);

    console.log('Testing PATCH /candidates/:candidateId/decision as User B1...');
    const patchCandB = await api(`/candidates/${candidateIdA}/decision`, {
      method: 'PATCH',
      token: tokenB1,
      body: { decision: 'REJECT' }
    });
    if (patchCandB.status !== 403 && patchCandB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 decision update on Candidate A returned ${patchCandB.status}!`);
    }
    console.log(`✓ PASS: Decision update on Candidate A by User B1 correctly rejected with ${patchCandB.status}.`);

    console.log('Testing DELETE /candidates/:candidateId as User B1...');
    const deleteCandB = await api(`/candidates/${candidateIdA}`, {
      method: 'DELETE',
      token: tokenB1
    });
    if (deleteCandB.status !== 403 && deleteCandB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 delete Candidate A returned ${deleteCandB.status}!`);
    }
    console.log(`✓ PASS: Delete Candidate A by User B1 correctly rejected with ${deleteCandB.status}.`);

    // -------------------------------------------------------------
    // Step 8: Verify User B1 (Company B) CANNOT see Company A's Evaluation
    // -------------------------------------------------------------
    console.log('\n[Step 8] Testing isolation: Company B listing Evaluations...');
    const listEvalsB = await api('/evaluations?view=all', { token: tokenB1 });
    const bEvalIds = (listEvalsB.data?.evaluations || []).map((e: any) => e.evaluationId || e.id);
    if (bEvalIds.includes(evalIdA) || bEvalIds.includes(candidateIdA)) {
      throw new Error('CRITICAL LEAK: User B1 can see Evaluation A in evaluations list!');
    }
    console.log(`✓ PASS: User B1 cannot see Evaluation A in list (Evaluations returned: ${bEvalIds.length}).`);

    console.log('Testing direct GET /evaluations/:evalId as User B1...');
    const getEvalB = await api(`/evaluations/${evalIdA}`, { token: tokenB1 });
    if (getEvalB.status !== 403 && getEvalB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 got status ${getEvalB.status} accessing Evaluation A!`);
    }
    console.log(`✓ PASS: Direct access to Evaluation A by User B1 correctly rejected with ${getEvalB.status}.`);

    console.log('Testing PATCH /evaluations/:evalId/decision as User B1...');
    const patchEvalB = await api(`/evaluations/${evalIdA}/decision`, {
      method: 'PATCH',
      token: tokenB1,
      body: { decision: 'DO NOT SUBMIT' }
    });
    if (patchEvalB.status !== 403 && patchEvalB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 decision update on Evaluation A returned ${patchEvalB.status}!`);
    }
    console.log(`✓ PASS: Decision update on Evaluation A by User B1 correctly rejected with ${patchEvalB.status}.`);

    console.log('Testing DELETE /evaluations/:evalId as User B1...');
    const deleteEvalB = await api(`/evaluations/${evalIdA}`, {
      method: 'DELETE',
      token: tokenB1
    });
    if (deleteEvalB.status !== 403 && deleteEvalB.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 delete on Evaluation A returned ${deleteEvalB.status}!`);
    }
    console.log(`✓ PASS: Delete Evaluation A by User B1 correctly rejected with ${deleteEvalB.status}.`);

    // -------------------------------------------------------------
    // Step 9: Verify Company B Admin CANNOT see Company A's data
    // -------------------------------------------------------------
    console.log('\n[Step 9] Testing isolation: Company B Admin accessing Company A data...');
    const adminBJobs = await api('/jobs', { token: tokenAdminB });
    const adminBJobIds = (adminBJobs.data?.jobs || []).map((j: any) => j.id);
    if (adminBJobIds.includes(jobIdA)) {
      throw new Error('CRITICAL LEAK: Company B Admin can see Company A Job in jobs list!');
    }
    console.log('✓ PASS: Company B Admin cannot see Company A Job in list.');

    const adminBJobGet = await api(`/jobs/${jobIdA}`, { token: tokenAdminB });
    if (adminBJobGet.status !== 403 && adminBJobGet.status !== 404) {
      throw new Error(`CRITICAL LEAK: Company B Admin got status ${adminBJobGet.status} accessing Job A!`);
    }
    console.log(`✓ PASS: Company B Admin access to Job A correctly rejected with ${adminBJobGet.status}.`);

    const adminBEvals = await api('/evaluations?view=all', { token: tokenAdminB });
    const adminBEvalIds = (adminBEvals.data?.evaluations || []).map((e: any) => e.evaluationId || e.id);
    if (adminBEvalIds.includes(evalIdA) || adminBEvalIds.includes(candidateIdA)) {
      throw new Error('CRITICAL LEAK: Company B Admin can see Company A Evaluation in list!');
    }
    console.log('✓ PASS: Company B Admin cannot see Company A Evaluation in list.');

    const adminBEvalGet = await api(`/evaluations/${evalIdA}`, { token: tokenAdminB });
    if (adminBEvalGet.status !== 403 && adminBEvalGet.status !== 404) {
      throw new Error(`CRITICAL LEAK: Company B Admin got status ${adminBEvalGet.status} accessing Evaluation A!`);
    }
    console.log(`✓ PASS: Company B Admin access to Evaluation A correctly rejected with ${adminBEvalGet.status}.`);

    // -------------------------------------------------------------
    // Step 10: Verify Company A Admin CAN access Company A's data
    // -------------------------------------------------------------
    console.log('\n[Step 10] Testing authorized intra-company access: Company A Admin...');
    const adminAJobs = await api('/jobs', { token: tokenAdminA });
    const adminAJobIds = (adminAJobs.data?.jobs || []).map((j: any) => j.id);
    if (!adminAJobIds.includes(jobIdA)) {
      throw new Error('Company A Admin should be able to see Job A created by User A1!');
    }
    console.log('✓ PASS: Company A Admin successfully sees Job A created by recruiter A1.');

    const adminACands = await api('/candidates', { token: tokenAdminA });
    const adminACandIds = (adminACands.data?.candidates || []).map((c: any) => c.id);
    if (!adminACandIds.includes(candidateIdA)) {
      throw new Error('Company A Admin should be able to see Candidate A in candidate pool!');
    }
    console.log('✓ PASS: Company A Admin successfully sees Candidate A in pool.');

    const adminAEvals = await api('/evaluations?view=all', { token: tokenAdminA });
    const adminAEvalCandidates = (adminAEvals.data?.evaluations || []).map((e: any) => e.candidateId);
    if (!adminAEvalCandidates.includes(candidateIdA)) {
      throw new Error('Company A Admin should be able to see Evaluation of Candidate A!');
    }
    console.log('✓ PASS: Company A Admin successfully sees Evaluation of Candidate A.');

    // -------------------------------------------------------------
    // Step 11: Cross-Organization Matching Blocked
    // -------------------------------------------------------------
    console.log('\n[Step 11] Testing cross-org matching attempt...');
    // Create Job B under Company B
    const createJobB = await api('/jobs', {
      method: 'POST',
      token: tokenB1,
      body: {
        position: 'Data Analyst',
        client: 'Beta Analytics Corp',
        location: 'New York, NY',
        work_mode: 'Remote',
        jd_text: 'Looking for a Data Analyst with SQL and Python.'
      }
    });
    const jobIdB = createJobB.data?.job?.id;

    // User B1 tries to match Candidate A (Company A) with Job B (Company B)
    const crossMatch = await api(`/candidates/${candidateIdA}/match-with-job`, {
      method: 'POST',
      token: tokenB1,
      body: { jobId: jobIdB }
    });
    if (crossMatch.status !== 403 && crossMatch.status !== 404) {
      throw new Error(`CRITICAL LEAK: User B1 matching Candidate A with Job B returned ${crossMatch.status}! Expected 403 or 404.`);
    }
    console.log(`✓ PASS: Cross-tenant candidate matching correctly rejected with status ${crossMatch.status}.`);

    // User A1 tries to match Candidate A with Job B (Company B's job)
    const crossMatch2 = await api(`/candidates/${candidateIdA}/match-with-job`, {
      method: 'POST',
      token: tokenA1,
      body: { jobId: jobIdB }
    });
    if (crossMatch2.status !== 403 && crossMatch2.status !== 404) {
      throw new Error(`CRITICAL LEAK: User A1 matching Candidate A with Job B returned ${crossMatch2.status}! Expected 403 or 404.`);
    }
    console.log(`✓ PASS: Cross-tenant job matching correctly rejected with status ${crossMatch2.status}.`);

    console.log('\n================================================================');
    console.log('   ALL 11 MULTI-TENANT ISOLATION TESTS PASSED SUCCESSFULLY!    ');
    console.log('================================================================\n');

  } finally {
    console.log('Cleaning up test data...');
    try {
      if (evalIdA) {
        await prisma.evaluation.deleteMany({ where: { id: evalIdA } }).catch(() => null);
      }
      if (candidateIdA) {
        await prisma.candidateSkill.deleteMany({ where: { candidate_id: candidateIdA } }).catch(() => null);
        await prisma.candidateApplication.deleteMany({ where: { candidate_id: candidateIdA } }).catch(() => null);
        await prisma.candidate.deleteMany({ where: { id: candidateIdA } }).catch(() => null);
      }
      if (jobIdA) {
        await prisma.requirement.deleteMany({ where: { job_id: jobIdA } }).catch(() => null);
        await prisma.candidateApplication.deleteMany({ where: { job_id: jobIdA } }).catch(() => null);
        await prisma.job.deleteMany({ where: { id: jobIdA } }).catch(() => null);
      }
      await prisma.job.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } }).catch(() => null);
      await prisma.user.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } }).catch(() => null);
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => null);
      console.log('✓ Test data cleaned up successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  });
