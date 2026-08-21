ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

ALTER TABLE "CreditTransaction"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "providerTaskId" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

ALTER TABLE "CreditUsage" ADD COLUMN IF NOT EXISTS "reservationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CreditTransaction_idempotencyKey_key"
ON "CreditTransaction"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "CreditUsage_reservationId_key"
ON "CreditUsage"("reservationId");

ALTER TABLE "GenerationTask" ADD COLUMN IF NOT EXISTS "creditReservationId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "GenerationTask_creditReservationId_key"
ON "GenerationTask"("creditReservationId");
