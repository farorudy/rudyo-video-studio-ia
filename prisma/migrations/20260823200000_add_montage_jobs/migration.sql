CREATE TYPE "MontageJobStatus" AS ENUM (
  'QUEUED',
  'CLAIMED',
  'DOWNLOADING',
  'PREPARING',
  'RENDERING',
  'UPLOADING',
  'SUCCEEDED',
  'RETRYING',
  'FAILED',
  'REFUNDED'
);

CREATE TABLE "MontageJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "finalExportId" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "status" "MontageJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "inputManifest" JSONB NOT NULL,
  "outputPath" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "idempotencyKey" TEXT NOT NULL,
  "lockedBy" TEXT,
  "lockedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MontageJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MontageJob_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100),
  CONSTRAINT "MontageJob_attempts_check" CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0)
);

CREATE UNIQUE INDEX "MontageJob_finalExportId_key" ON "MontageJob"("finalExportId");
CREATE UNIQUE INDEX "MontageJob_idempotencyKey_key" ON "MontageJob"("idempotencyKey");
CREATE INDEX "MontageJob_status_availableAt_createdAt_idx" ON "MontageJob"("status", "availableAt", "createdAt");
CREATE INDEX "MontageJob_projectId_status_idx" ON "MontageJob"("projectId", "status");
CREATE INDEX "MontageJob_leaseExpiresAt_idx" ON "MontageJob"("leaseExpiresAt");

ALTER TABLE "MontageJob"
  ADD CONSTRAINT "MontageJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MontageJob"
  ADD CONSTRAINT "MontageJob_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MontageJob"
  ADD CONSTRAINT "MontageJob_finalExportId_fkey"
  FOREIGN KEY ("finalExportId") REFERENCES "FinalExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
