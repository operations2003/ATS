import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

async function main() {
  console.log('=== STARTING DATA CLEANUP ===');

  // 1. Verify and display existing user accounts to guarantee their safety
  const usersBefore = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      organizationId: true
    }
  });

  console.log(`Preserving all ${usersBefore.length} recruiter and admin user accounts:`);
  for (const u of usersBefore) {
    console.log(` - [${u.role}] ${u.email} (${u.name || 'Unnamed'}) | Org: ${u.organizationId}`);
  }

  // 2. Fetch counts before deletion
  const countsBefore = {
    jobs: await prisma.job.count(),
    requirements: await prisma.requirement.count(),
    candidates: await prisma.candidate.count(),
    candidateApplications: await prisma.candidateApplication.count(),
    candidateExperiences: await prisma.candidateExperience.count(),
    candidateEducations: await prisma.candidateEducation.count(),
    candidateSkills: await prisma.candidateSkill.count(),
    candidateCertifications: await prisma.candidateCertification.count(),
    candidateLanguages: await prisma.candidateLanguage.count(),
    candidateProjects: await prisma.candidateProject.count(),
    evaluations: await prisma.evaluation.count(),
    auditLogs: await prisma.auditLog.count()
  };

  console.log('\n--- DATA COUNTS BEFORE DELETION ---');
  console.log(JSON.stringify(countsBefore, null, 2));

  // 3. Execute deletion in correct dependency order
  console.log('\nExecuting deletion...');

  const deletedProjects = await prisma.candidateProject.deleteMany({});
  console.log(`Deleted CandidateProjects: ${deletedProjects.count}`);

  const deletedLanguages = await prisma.candidateLanguage.deleteMany({});
  console.log(`Deleted CandidateLanguages: ${deletedLanguages.count}`);

  const deletedCerts = await prisma.candidateCertification.deleteMany({});
  console.log(`Deleted CandidateCertifications: ${deletedCerts.count}`);

  const deletedSkills = await prisma.candidateSkill.deleteMany({});
  console.log(`Deleted CandidateSkills: ${deletedSkills.count}`);

  const deletedEducations = await prisma.candidateEducation.deleteMany({});
  console.log(`Deleted CandidateEducations: ${deletedEducations.count}`);

  const deletedExperiences = await prisma.candidateExperience.deleteMany({});
  console.log(`Deleted CandidateExperiences: ${deletedExperiences.count}`);

  const deletedEvaluations = await prisma.evaluation.deleteMany({});
  console.log(`Deleted Evaluations: ${deletedEvaluations.count}`);

  const deletedApplications = await prisma.candidateApplication.deleteMany({});
  console.log(`Deleted CandidateApplications: ${deletedApplications.count}`);

  const deletedCandidates = await prisma.candidate.deleteMany({});
  console.log(`Deleted Candidates: ${deletedCandidates.count}`);

  const deletedRequirements = await prisma.requirement.deleteMany({});
  console.log(`Deleted Requirements: ${deletedRequirements.count}`);

  const deletedJobs = await prisma.job.deleteMany({});
  console.log(`Deleted Jobs: ${deletedJobs.count}`);

  const deletedAuditLogs = await prisma.auditLog.deleteMany({});
  console.log(`Deleted AuditLogs: ${deletedAuditLogs.count}`);

  // 4. Reset local candidate pool file cache
  const poolFilePath = path.resolve(process.cwd(), 'data', 'candidates_pool.json');
  if (fs.existsSync(poolFilePath)) {
    fs.writeFileSync(poolFilePath, JSON.stringify([], null, 2), 'utf-8');
    console.log(`Reset candidates_pool.json to empty array.`);
  }

  // 5. Verification checks
  const usersAfter = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      organizationId: true
    }
  });

  const countsAfter = {
    users: usersAfter.length,
    jobs: await prisma.job.count(),
    requirements: await prisma.requirement.count(),
    candidates: await prisma.candidate.count(),
    candidateApplications: await prisma.candidateApplication.count(),
    candidateExperiences: await prisma.candidateExperience.count(),
    candidateEducations: await prisma.candidateEducation.count(),
    candidateSkills: await prisma.candidateSkill.count(),
    candidateCertifications: await prisma.candidateCertification.count(),
    candidateLanguages: await prisma.candidateLanguage.count(),
    candidateProjects: await prisma.candidateProject.count(),
    evaluations: await prisma.evaluation.count(),
    auditLogs: await prisma.auditLog.count(),
    organizations: await prisma.organization.count()
  };

  console.log('\n--- VERIFICATION: DATA COUNTS AFTER DELETION ---');
  console.log(JSON.stringify(countsAfter, null, 2));

  if (usersAfter.length === usersBefore.length) {
    console.log(`\nSUCCESS: All ${usersAfter.length} user credentials are completely intact!`);
  } else {
    console.error(`\nWARNING: User count mismatch! Before: ${usersBefore.length}, After: ${usersAfter.length}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error during data cleanup:', e);
  await prisma.$disconnect();
  process.exit(1);
});

