ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "credits" = "creditsRemaining"
WHERE "credits" = 0 AND "creditsRemaining" <> 0;

CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stripeSessionId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "tokens" INTEGER NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_stripeSessionId_key"
ON "Transaction"("stripeSessionId");

CREATE INDEX IF NOT EXISTS "Transaction_userId_createdAt_idx"
ON "Transaction"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_userId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CreditUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditUsage_userId_createdAt_idx"
ON "CreditUsage"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CreditUsage_userId_fkey'
  ) THEN
    ALTER TABLE "CreditUsage"
    ADD CONSTRAINT "CreditUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
