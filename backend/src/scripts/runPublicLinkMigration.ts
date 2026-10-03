import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('Starting Public Application Link database migration...');

  // 1. Add public_token and is_public_link_active to jobs table
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "public_token" TEXT UNIQUE`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_public_link_active" BOOLEAN DEFAULT true`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_jobs_public_token" ON "jobs"("public_token")`);
    console.log('Successfully ensured jobs.public_token and jobs.is_public_link_active.');
  } catch (err: any) {
    console.warn('Jobs table migration note:', err.message);
  }

  // 2. Add source column to candidates table
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual_upload'`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_candidates_source" ON "candidates"("source")`);
    console.log('Successfully ensured candidates.source.');
  } catch (err: any) {
    console.warn('Candidates table migration note:', err.message);
  }

  console.log('Public Application Link migration completed successfully.');
  await prisma.$disconnect();
}

runMigration().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
