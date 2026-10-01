import prisma from '../config/prisma';

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log('Organizations:', orgs.map(o => ({ id: o.id, name: o.name })));

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, organizationId: true }
  });
  console.log('Users count:', users.length);
  console.log('Users:', users);

  const jobs = await prisma.job.findMany({
    select: { id: true, position: true, client: true, created_by: true, organizationId: true }
  });
  console.log('Jobs count:', jobs.length);
  console.log('Jobs:', jobs.slice(0, 10));

  const candidates = await prisma.candidate.findMany({
    select: { id: true, name: true, email: true, job_id: true, created_by: true, organizationId: true }
  });
  console.log('Candidates count:', candidates.length);
  console.log('Candidates sample:', candidates.slice(0, 10));

  const evals = await prisma.evaluation.findMany({
    select: { id: true, candidateId: true, jobId: true, createdByUserId: true, organizationId: true, score: true }
  });
  console.log('Evaluations count:', evals.length);
  console.log('Evaluations sample:', evals.slice(0, 10));

  await prisma.$disconnect();
}

main().catch(console.error);
