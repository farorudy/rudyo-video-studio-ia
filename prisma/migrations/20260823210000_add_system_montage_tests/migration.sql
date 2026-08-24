CREATE TYPE "WorkerHealthStatus" AS ENUM ('ONLINE', 'DEGRADED', 'STOPPING');
CREATE TYPE "SystemTestStatus" AS ENUM ('PREPARING', 'QUEUED', 'RUNNING', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'CLEANED');
CREATE TYPE "SystemTestScenario" AS ENUM ('SUCCESS', 'INVALID_VIDEO', 'MISSING_AUDIO', 'INTERRUPTED_WORKER', 'EXPIRED_LEASE', 'STORAGE_FAILURE', 'DOUBLE_CLAIM', 'IDEMPOTENCY_REPLAY');

ALTER TABLE "VideoProject"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN "billingMode" TEXT NOT NULL DEFAULT 'BILLABLE';

ALTER TABLE "GenerationTask"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN "billingMode" TEXT NOT NULL DEFAULT 'BILLABLE';

CREATE TABLE "MontageJobEvent" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "status" "MontageJobStatus" NOT NULL,
  "progress" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MontageJobEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MontageJobEvent_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100)
);

CREATE INDEX "MontageJobEvent_jobId_createdAt_idx" ON "MontageJobEvent"("jobId", "createdAt");
ALTER TABLE "MontageJobEvent" ADD CONSTRAINT "MontageJobEvent_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "MontageJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkerHeartbeat" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "WorkerHealthStatus" NOT NULL DEFAULT 'ONLINE',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentJobId" TEXT,
  "ffmpegAvailable" BOOLEAN NOT NULL DEFAULT false,
  "databaseAvailable" BOOLEAN NOT NULL DEFAULT false,
  "storageAvailable" BOOLEAN NOT NULL DEFAULT false,
  "tempAvailableBytes" BIGINT,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkerHeartbeat_lastSeenAt_idx" ON "WorkerHeartbeat"("lastSeenAt");
CREATE INDEX "WorkerHeartbeat_status_lastSeenAt_idx" ON "WorkerHeartbeat"("status", "lastSeenAt");

CREATE TABLE "SystemTestRun" (
  "id" TEXT NOT NULL,
  "adminSubject" TEXT NOT NULL,
  "userId" TEXT,
  "projectId" TEXT,
  "montageJobId" TEXT,
  "finalExportId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'SYSTEM_TEST',
  "billingMode" TEXT NOT NULL DEFAULT 'NON_BILLABLE',
  "provider" TEXT NOT NULL DEFAULT 'TEST_FIXTURE',
  "scenario" "SystemTestScenario" NOT NULL DEFAULT 'SUCCESS',
  "status" "SystemTestStatus" NOT NULL DEFAULT 'PREPARING',
  "steps" JSONB NOT NULL DEFAULT '[]',
  "diagnostics" JSONB,
  "balanceBefore" INTEGER NOT NULL,
  "balanceAfter" INTEGER,
  "billingVerified" BOOLEAN NOT NULL DEFAULT false,
  "bytePlusCallVerified" BOOLEAN NOT NULL DEFAULT false,
  "outputPath" TEXT,
  "downloadTokenHash" TEXT,
  "downloadExpiresAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "cleanedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemTestRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemTestRun_projectId_key" ON "SystemTestRun"("projectId");
CREATE UNIQUE INDEX "SystemTestRun_montageJobId_key" ON "SystemTestRun"("montageJobId");
CREATE UNIQUE INDEX "SystemTestRun_finalExportId_key" ON "SystemTestRun"("finalExportId");
CREATE INDEX "SystemTestRun_status_createdAt_idx" ON "SystemTestRun"("status", "createdAt");
CREATE INDEX "SystemTestRun_expiresAt_cleanedAt_idx" ON "SystemTestRun"("expiresAt", "cleanedAt");
CREATE INDEX "SystemTestRun_adminSubject_createdAt_idx" ON "SystemTestRun"("adminSubject", "createdAt");

ALTER TABLE "SystemTestRun" ADD CONSTRAINT "SystemTestRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SystemTestRun" ADD CONSTRAINT "SystemTestRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
