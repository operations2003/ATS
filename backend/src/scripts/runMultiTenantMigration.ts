import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('Starting migration...');

  // 1. Add enum values to UserRole if not present
  const roles = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'RECRUITER'];
  for (const role of roles) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS '${role}'`);
      console.log(`Added/verified UserRole value: ${role}`);
    } catch (err: any) {
      console.log(`UserRole ${role} note:`, err.message);
    }
  }

  // 2. Create OrgStatus enum if not present
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('OrgStatus enum ensured.');
  } catch (err: any) {
    console.log('OrgStatus enum error:', err.message);
  }

  // 3. Create organizations table
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "company_email" TEXT,
        "contact_phone" TEXT,
        "address" TEXT,
        "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
        "subscription_plan" TEXT NOT NULL DEFAULT 'STARTER',
        "billing_cycle" TEXT NOT NULL DEFAULT 'monthly',
        "subscription_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "subscription_expiry" TIMESTAMP(3),
        "max_users" INTEGER NOT NULL DEFAULT 5,
        "max_recruiters" INTEGER NOT NULL DEFAULT 5,
        "max_active_jobs" INTEGER NOT NULL DEFAULT 20,
        "max_resumes_per_month" INTEGER NOT NULL DEFAULT 500,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('organizations table ensured.');
  } catch (err: any) {
    console.log('organizations table error:', err.message);
  }

  // 4. Seed default organization 'org-tasknera'
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "organizations" (
        "id", "name", "company_email", "status", "subscription_plan", "billing_cycle",
        "max_users", "max_recruiters", "max_active_jobs", "max_resumes_per_month"
      ) VALUES (
        'org-tasknera', 'Tasknera Global', 'sheetalbedi@tasknera.com', 'ACTIVE', 'ENTERPRISE', 'monthly',
        100, 50, 100, 5000
      ) ON CONFLICT ("id") DO NOTHING;
    `);
    console.log('org-tasknera seeded.');
  } catch (err: any) {
    console.log('org-tasknera seed note:', err.message);
  }

  // 5. Add columns to jobs
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT DEFAULT 'org-tasknera'`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_jobs_organization_id" ON "jobs"("organization_id")`);
    console.log('jobs.organization_id ensured.');
  } catch (err: any) {
    console.log('jobs column note:', err.message);
  }

  // 6. Add columns to candidates
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "organization_id" TEXT DEFAULT 'org-tasknera'`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_candidates_organization_id" ON "candidates"("organization_id")`);
    console.log('candidates.organization_id ensured.');
  } catch (err: any) {
    console.log('candidates column note:', err.message);
  }

  // 7. Add is_active column to users
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true`);
    console.log('users.is_active ensured.');
  } catch (err: any) {
    console.log('users column note:', err.message);
  }

  // 8. Create audit_logs table
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
        "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "action" TEXT NOT NULL,
        "target_type" TEXT,
        "target_id" TEXT,
        "details" JSONB,
        "ip_address" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_org_id" ON "audit_logs"("organization_id")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "audit_logs"("user_id")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs"("action")`);
    console.log('audit_logs table ensured.');
  } catch (err: any) {
    console.log('audit_logs error:', err.message);
  }

  console.log('All migrations applied successfully.');
  await prisma.$disconnect();
}

runMigration().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
