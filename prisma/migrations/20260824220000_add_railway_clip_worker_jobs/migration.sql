CREATE TYPE "ClipWorkerJobStatus" AS ENUM (
  'QUEUED', 'CLAIMED', 'PREPARING', 'RENDERING', 'UPLOADING',
  'SUCCEEDED', 'RETRYING', 'FAILED', 'REFUNDED'
);

CREATE TABLE "ClipWorkerJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "finalExportId" TEXT NOT NULL,
  "status" "ClipWorkerJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "inputManifest" JSONB NOT NULL,
  "outputPath" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "idempotencyKey" TEXT NOT NULL,
  "lockedBy" TEXT,
  "lockedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClipWorkerJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClipWorkerJob_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100),
  CONSTRAINT "ClipWorkerJob_attempts_check" CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0)
);

CREATE TABLE "ClipWorkerJobEvent" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "status" "ClipWorkerJobStatus" NOT NULL,
  "progress" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClipWorkerJobEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClipWorkerJobEvent_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100)
);

CREATE UNIQUE INDEX "ClipWorkerJob_finalExportId_key" ON "ClipWorkerJob"("finalExportId");
CREATE UNIQUE INDEX "ClipWorkerJob_idempotencyKey_key" ON "ClipWorkerJob"("idempotencyKey");
CREATE INDEX "ClipWorkerJob_status_availableAt_createdAt_idx" ON "ClipWorkerJob"("status", "availableAt", "createdAt");
CREATE INDEX "ClipWorkerJob_projectId_status_idx" ON "ClipWorkerJob"("projectId", "status");
CREATE INDEX "ClipWorkerJob_leaseExpiresAt_idx" ON "ClipWorkerJob"("leaseExpiresAt");
CREATE INDEX "ClipWorkerJobEvent_jobId_createdAt_idx" ON "ClipWorkerJobEvent"("jobId", "createdAt");

ALTER TABLE "ClipWorkerJob" ADD CONSTRAINT "ClipWorkerJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClipWorkerJob" ADD CONSTRAINT "ClipWorkerJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClipWorkerJob" ADD CONSTRAINT "ClipWorkerJob_finalExportId_fkey" FOREIGN KEY ("finalExportId") REFERENCES "FinalExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClipWorkerJobEvent" ADD CONSTRAINT "ClipWorkerJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClipWorkerJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
