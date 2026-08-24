import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".vercel/.env.production.local", quiet: true });
process.env.DATABASE_URL = process.env.RUDYO_DB_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const prisma = new PrismaClient();
try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      current_database() AS database,
      current_schema() AS schema,
      to_regclass('public."MontageJob"') IS NOT NULL AS "montageJobExists",
      to_regclass('public."WorkerHeartbeat"') IS NOT NULL AS "workerHeartbeatExists",
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='VideoProject' AND column_name='source') AS "projectSourceExists",
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='VideoProject' AND column_name='creditReservationId') AS "tiktokBillingExists",
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='VideoProject' AND column_name='clipPlan') AS "clipPlansExist",
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='VideoProject' AND column_name='paymentCompletedAt') AS "clipPaymentTrackingExists"
  `);
  console.log(JSON.stringify(rows));
} catch (error) {
  console.error(`CODE=${error?.code || "unknown"}`);
  console.error(String(error?.message || error).replace(/postgres(?:ql)?:\/\/[^@\s]+@/g, "postgresql://***@"));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
