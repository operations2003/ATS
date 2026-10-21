import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('[Migration] Checking and applying allow_jd_upload column...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "allow_jd_upload" BOOLEAN NOT NULL DEFAULT true;`);
    console.log('[Migration] Ensured organizations.allow_jd_upload column exists.');
  } catch (err: any) {
    console.error('[Migration] organizations table error:', err.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "allow_jd_upload" BOOLEAN NOT NULL DEFAULT true;`);
    console.log('[Migration] Ensured users.allow_jd_upload column exists.');
  } catch (err: any) {
    console.error('[Migration] users table error:', err.message);
  }

  await prisma.$disconnect();
  console.log('[Migration] Migration complete.');
}

run().catch((e) => {
  console.error('[Migration] Failed:', e);
  process.exit(1);
});

