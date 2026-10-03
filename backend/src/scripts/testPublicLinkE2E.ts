import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from '../server';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'tasknera_super_secret_jwt_key_2026';
const TEST_PORT = 5099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runE2ETests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PUBLIC CANDIDATE APPLICATION LINK E2E TESTS');
  console.log('======================================================\n');

  let server: http.Server | null = null;

  try {
    // Start test server
    server = app.listen(TEST_PORT);
    console.log(`✓ Test server running on ${BASE_URL}`);

    // 1. Setup Test Organizations & Users
    const orgAId = 'org-test-company-alpha';
    const orgBId = 'org-test-company-beta';

    await prisma.organization.upsert({
      where: { id: orgAId },
      update: { status: 'ACTIVE', maxUsers: 10, maxActiveJobs: 20 },
      create: { id: orgAId, name: 'Company Alpha Tech', companyEmail: 'hr@alpha.com', status: 'ACTIVE', maxUsers: 10, maxActiveJobs: 20 }
    });

    await prisma.organization.upsert({
      where: { id: orgBId },
      update: { status: 'ACTIVE', maxUsers: 10, maxActiveJobs: 20 },
      create: { id: orgBId, name: 'Company Beta Labs', companyEmail: 'hr@beta.com', status: 'ACTIVE', maxUsers: 10, maxActiveJobs: 20 }
    });

    // Clean any prior test users
    await prisma.user.deleteMany({
      where: { email: { in: ['recruiter.alpha@test.com', 'recruiter.beta@test.com'] } }
    });

    const userAlpha = await prisma.user.create({
      data: {
        email: 'recruiter.alpha@test.com',
        password: 'hashed_password_test',
        name: 'Alpha Recruiter',
        role: 'CLIENT_ADMIN',
        organizationId: orgAId,
      }
    });

    const userBeta = await prisma.user.create({
      data: {
        email: 'recruiter.beta@test.com',
        password: 'hashed_password_test',
        name: 'Beta Recruiter',
        role: 'CLIENT_ADMIN',
        organizationId: orgBId,
      }
    });

    const tokenAlpha = jwt.sign({ userId: userAlpha.id, id: userAlpha.id, email: userAlpha.email, role: userAlpha.role, organizationId: orgAId }, JWT_SECRET);
    const tokenBeta = jwt.sign({ userId: userBeta.id, id: userBeta.id, email: userBeta.email, role: userBeta.role, organizationId: orgBId }, JWT_SECRET);

    // 2. Create a Job for Company Alpha
    const jobAlpha = await prisma.job.create({
      data: {
        position: 'Senior Full Stack Engineer',
        client: 'Alpha Tech Solutions',
        location: 'Bangalore / Hybrid',
        work_mode: 'Hybrid',
        salary: '₹28,00,000 – ₹35,00,000',
        status: 'active',
        created_by: userAlpha.id,
        organizationId: orgAId,
        jd_text: 'We are seeking an experienced Senior Full Stack Engineer proficient in React, Node.js, TypeScript, PostgreSQL, and AWS Cloud Architecture.',
        requirements: {
          create: [
            { requirement: '5+ years experience in React and Node.js', category: 'Technical Skill', is_mandatory: true, weight: 2.0 },
            { requirement: 'Proficiency in TypeScript and PostgreSQL', category: 'Technical Skill', is_mandatory: true, weight: 1.5 },
            { requirement: 'Experience with AWS or Docker', category: 'DevOps', is_mandatory: false, weight: 1.0 },
          ]
        }
      },
      include: { requirements: true }
    });

    console.log(`✓ [Step 1] Created test requisition for Alpha: "${jobAlpha.position}" (ID: ${jobAlpha.id})`);

    // 3. Test: Recruiter generates public link
    const genRes1 = await fetch(`${BASE_URL}/api/jobs/${jobAlpha.id}/public-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify({ isPublicLinkActive: true })
    });
    const genData1 = await genRes1.json();

    if (!genRes1.ok || !genData1.publicToken) {
      throw new Error(`Failed to generate public link: ${JSON.stringify(genData1)}`);
    }

    const publicToken = genData1.publicToken;
    console.log(`✓ [Step 2] Recruiter generated public token: ${publicToken}`);
    console.log(`          Public URL: ${genData1.publicUrl}`);

    // 4. Test: Re-calling endpoint returns the SAME token without regenerating unnecessarily
    const genRes2 = await fetch(`${BASE_URL}/api/jobs/${jobAlpha.id}/public-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify({})
    });
    const genData2 = await genRes2.json();

    if (genData2.publicToken !== publicToken) {
      throw new Error(`Expected identical token ${publicToken}, got ${genData2.publicToken}`);
    }
    console.log(`✓ [Step 3] Re-calling endpoint returned existing link without redundant generation`);

    // 5. Test: GET /api/jobs/:id/public-link
    const getLinkRes = await fetch(`${BASE_URL}/api/jobs/${jobAlpha.id}/public-link`, {
      headers: { Authorization: `Bearer ${tokenAlpha}` }
    });
    const getLinkData = await getLinkRes.json();

    if (getLinkData.publicToken !== publicToken || getLinkData.hasLink !== true) {
      throw new Error(`GET /public-link failed: ${JSON.stringify(getLinkData)}`);
    }
    console.log(`✓ [Step 4] GET /api/jobs/:id/public-link verified`);

    // 6. Test: Candidate opens public link (NO AUTHENTICATION)
    const pubJobRes = await fetch(`${BASE_URL}/api/public/jobs/${publicToken}`);
    const pubJobData = await pubJobRes.json();

    if (!pubJobRes.ok || !pubJobData.job) {
      throw new Error(`Public job retrieval failed: ${JSON.stringify(pubJobData)}`);
    }
    if (pubJobData.job.position !== 'Senior Full Stack Engineer') {
      throw new Error(`Mismatched public position title: ${pubJobData.job.position}`);
    }
    if (!Array.isArray(pubJobData.job.requirements) || pubJobData.job.requirements.length !== 3) {
      throw new Error(`Mismatched public requirements count`);
    }
    console.log(`✓ [Step 5] Public job info successfully retrieved by unauthenticated candidate`);
    console.log(`          Found: "${pubJobData.job.position}" with ${pubJobData.job.requirements.length} requirements`);

    // 7. Test: Candidate submits application with resume text/file (NO AUTHENTICATION)
    const resumeText = `
Rahul Sharma
Senior Software Engineer
Email: rahul.sharma.test@gmail.com
Phone: +91 9876543210
Location: Bangalore, India

PROFESSIONAL SUMMARY
Dynamic Senior Full Stack Developer with 6 years of solid hands-on experience designing and implementing scalable web applications using React, Node.js, TypeScript, PostgreSQL, and AWS Cloud infrastructure.

TECHNICAL SKILLS
- Frontend: React, Redux, Next.js, HTML5, CSS3, Tailwind CSS
- Backend: Node.js, Express, TypeScript, RESTful APIs, GraphQL
- Databases: PostgreSQL, MongoDB, Redis, Prisma ORM
- Cloud & DevOps: AWS (EC2, S3), Docker, Git, CI/CD pipelines

WORK EXPERIENCE
Senior Full Stack Developer | Tech Innovations Pvt Ltd | 2021 – Present
- Architected and built multi-tenant SaaS dashboards using React, TypeScript, and Node.js.
- Designed relational database schemas in PostgreSQL and optimized complex SQL queries.
- Deployed microservices using Docker on AWS EC2 instances.

Software Engineer | Alpha Systems | 2018 – 2021
- Developed responsive web interfaces using React.
- Built backend APIs with Node.js and Express.

EDUCATION
Bachelor of Technology in Computer Science | National Institute of Technology | 2014 – 2018
    `.trim();

    const formData = new FormData();
    formData.append('name', 'Rahul Sharma');
    formData.append('email', 'rahul.sharma.test@gmail.com');
    formData.append('phone', '+91 9876543210');
    const blob = new Blob([resumeText], { type: 'text/plain' });
    formData.append('file', blob, 'Rahul_Sharma_Resume.txt');

    const applyRes = await fetch(`${BASE_URL}/api/public/jobs/${publicToken}/apply`, {
      method: 'POST',
      body: formData,
    });
    const applyData = await applyRes.json();

    if (applyRes.status !== 201) {
      throw new Error(`Public application failed with HTTP ${applyRes.status}: ${JSON.stringify(applyData)}`);
    }

    if (!applyData.success) {
      throw new Error(`Application response was not successful: ${JSON.stringify(applyData)}`);
    }

    // Verify ATS score is NOT exposed to candidate!
    if (applyData.atsScore !== undefined || applyData.score !== undefined) {
      throw new Error(`SECURITY VIOLATION: ATS score was leaked to the candidate in public response!`);
    }
    console.log(`✓ [Step 6] Public candidate application submitted successfully without auth`);
    console.log(`          ATS score properly withheld from candidate response: ${JSON.stringify(applyData)}`);

    // 8. Test: Candidate automatically appears inside the Recruiter's JD evaluation page
    const candListRes = await fetch(`${BASE_URL}/api/jobs/${jobAlpha.id}/candidates`, {
      headers: { Authorization: `Bearer ${tokenAlpha}` }
    });
    const candListData = await candListRes.json();

    if (!candListRes.ok || !Array.isArray(candListData.candidates)) {
      throw new Error(`Recruiter failed to fetch job candidates: ${JSON.stringify(candListData)}`);
    }

    const appliedCandidate = candListData.candidates.find(
      (c: any) => c.email?.toLowerCase() === 'rahul.sharma.test@gmail.com'
    );

    if (!appliedCandidate) {
      throw new Error(`Applied candidate did not appear under Job ${jobAlpha.id} in recruiter list!`);
    }

    console.log(`✓ [Step 7] Candidate automatically appeared in recruiter JD evaluation table!`);
    console.log(`          Name: ${appliedCandidate.name}`);
    console.log(`          ATS Score: ${appliedCandidate.atsScore || appliedCandidate.matchScore}%`);
    console.log(`          Decision: ${appliedCandidate.decision}`);
    console.log(`          Source: ${appliedCandidate.source}`);

    if (appliedCandidate.source !== 'public_application') {
      throw new Error(`Expected source "public_application", got "${appliedCandidate.source}"`);
    }
    if (typeof (appliedCandidate.atsScore || appliedCandidate.matchScore) !== 'number' || (appliedCandidate.atsScore || appliedCandidate.matchScore) <= 0) {
      throw new Error(`Candidate ATS score was not calculated: ${appliedCandidate.atsScore}`);
    }

    // 9. Test: Multi-Tenant Data Isolation
    // Company Beta recruiter tries to view Company Alpha's job or candidates
    const betaAccessAttempt = await fetch(`${BASE_URL}/api/jobs/${jobAlpha.id}/candidates`, {
      headers: { Authorization: `Bearer ${tokenBeta}` }
    });

    if (betaAccessAttempt.status !== 403) {
      throw new Error(`SECURITY BREACH: Company Beta was able to access Company Alpha's candidates! HTTP: ${betaAccessAttempt.status}`);
    }
    console.log(`✓ [Step 8] Multi-tenant isolation verified: Company Beta received 403 Forbidden attempting to access Alpha's candidates`);

    // 10. Test: Enable / Disable (Pause / Resume) Applications
    const pauseRes = await fetch(`${BASE_URL}/api/jobs/${jobAlpha.id}/public-link`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify({ isPublicLinkActive: false })
    });
    const pauseData = await pauseRes.json();

    if (!pauseRes.ok || pauseData.isPublicLinkActive !== false) {
      throw new Error(`Failed to pause public applications: ${JSON.stringify(pauseData)}`);
    }

    // Candidate visits paused link
    const pausedGetRes = await fetch(`${BASE_URL}/api/public/jobs/${publicToken}`);
    const pausedGetData = await pausedGetRes.json();

    if (pausedGetData.isAcceptingApplications !== false) {
      throw new Error(`Expected isAcceptingApplications to be false when paused: ${JSON.stringify(pausedGetData)}`);
    }

    // Candidate tries to apply to paused job
    const pausedFormData = new FormData();
    pausedFormData.append('name', 'Another Candidate');
    pausedFormData.append('email', 'another@candidate.com');
    pausedFormData.append('file', blob, 'Resume.txt');

    const pausedApplyRes = await fetch(`${BASE_URL}/api/public/jobs/${publicToken}/apply`, {
      method: 'POST',
      body: pausedFormData,
    });

    if (pausedApplyRes.status !== 400) {
      throw new Error(`Expected HTTP 400 when submitting to paused job, got: ${pausedApplyRes.status}`);
    }
    console.log(`✓ [Step 9] Job-level toggle verified: Paused job blocks public applications cleanly`);

    // Re-enable
    await fetch(`${BASE_URL}/api/jobs/${jobAlpha.id}/public-link`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlpha}`
      },
      body: JSON.stringify({ isPublicLinkActive: true })
    });
    console.log(`✓ [Step 10] Re-activated public applications successfully`);

    // Cleanup test data
    console.log('\nCleaning up test artifacts...');
    await prisma.evaluation.deleteMany({ where: { jobId: jobAlpha.id } });
    await prisma.candidateApplication.deleteMany({ where: { job_id: jobAlpha.id } });
    await prisma.candidate.deleteMany({ where: { job_id: jobAlpha.id } });
    await prisma.requirement.deleteMany({ where: { job_id: jobAlpha.id } });
    await prisma.job.delete({ where: { id: jobAlpha.id } });
    await prisma.user.deleteMany({ where: { id: { in: [userAlpha.id, userBeta.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });

    console.log('\n======================================================');
    console.log('🎉 ALL PUBLIC CANDIDATE LINK E2E TESTS PASSED (10/10)');
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('\n❌ E2E Test Failure:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    process.exit(0);
  }
}

runE2ETests();
