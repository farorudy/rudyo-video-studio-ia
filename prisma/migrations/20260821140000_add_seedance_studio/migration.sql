CREATE TYPE "VideoProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RENDERING', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "MediaAssetType" AS ENUM ('AUDIO', 'ARTIST_PORTRAIT', 'ARTIST_PROFILE_LEFT', 'ARTIST_PROFILE_RIGHT', 'ARTIST_FULL_BODY', 'REFERENCE_IMAGE', 'REFERENCE_VIDEO', 'DECOR', 'OUTFIT', 'FIRST_FRAME', 'LAST_FRAME', 'CONSENT_DOCUMENT', 'GENERATED_VIDEO', 'THUMBNAIL', 'FINAL_EXPORT');
CREATE TYPE "StoryboardSceneStatus" AS ENUM ('DRAFT', 'READY', 'SUBMITTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELED');
CREATE TYPE "GenerationTaskStatus" AS ENUM ('CREATED', 'SUBMITTING', 'SUBMISSION_UNKNOWN', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'CANCELED', 'EXPIRED');
CREATE TYPE "FinalExportStatus" AS ENUM ('DRAFT', 'QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELED');

CREATE TABLE "VideoProject" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "artistName" TEXT NOT NULL, "musicGenre" TEXT, "bpm" INTEGER,
  "durationSeconds" INTEGER, "finalFormat" TEXT NOT NULL DEFAULT '16:9',
  "summary" TEXT, "mood" TEXT, "visualStyle" TEXT, "locations" JSONB,
  "colors" JSONB, "cameraMovements" JSONB,
  "status" "VideoProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "demoMode" BOOLEAN NOT NULL DEFAULT false, "maxBudgetUsd" DOUBLE PRECISION,
  "maxBudgetCredits" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtistIdentity" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "physicalDescription" TEXT,
  "hairstyle" TEXT, "mainOutfit" TEXT, "accessories" JSONB, "colorPalette" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArtistIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "type" "MediaAssetType" NOT NULL, "fileName" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
  "url" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryboardScene" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "order" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "startTimeSeconds" DOUBLE PRECISION NOT NULL,
  "endTimeSeconds" DOUBLE PRECISION NOT NULL, "durationSeconds" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL, "negativePrompt" TEXT, "mood" TEXT, "location" TEXT,
  "cameraMovement" TEXT, "modelId" TEXT, "resolution" TEXT NOT NULL DEFAULT '720p',
  "ratio" TEXT NOT NULL DEFAULT '16:9', "variantsRequested" INTEGER NOT NULL DEFAULT 1,
  "seed" INTEGER, "cameraFixed" BOOLEAN NOT NULL DEFAULT false,
  "generateAudio" BOOLEAN NOT NULL DEFAULT false, "watermark" BOOLEAN NOT NULL DEFAULT false,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "status" "StoryboardSceneStatus" NOT NULL DEFAULT 'DRAFT', "selectedVariantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryboardScene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationTask" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "sceneId" TEXT NOT NULL,
  "bytePlusTaskId" TEXT, "idempotencyKey" TEXT NOT NULL, "provider" TEXT NOT NULL DEFAULT 'byteplus',
  "modelId" TEXT NOT NULL, "status" "GenerationTaskStatus" NOT NULL DEFAULT 'CREATED',
  "requestPayload" JSONB NOT NULL, "responsePayload" JSONB, "errorCode" TEXT,
  "errorMessage" TEXT, "estimatedCredits" INTEGER NOT NULL DEFAULT 0, "estimatedTokens" INTEGER,
  "actualCompletionTokens" INTEGER, "estimatedCostUsd" DOUBLE PRECISION,
  "actualCostUsd" DOUBLE PRECISION, "sourceVideoUrl" TEXT, "permanentVideoUrl" TEXT,
  "thumbnailUrl" TEXT, "lastPolledAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenerationTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationVariant" (
  "id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "sceneId" TEXT NOT NULL,
  "variantNumber" INTEGER NOT NULL, "videoUrl" TEXT NOT NULL, "thumbnailUrl" TEXT,
  "durationSeconds" INTEGER, "selected" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GenerationVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenUsage" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "sceneId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL, "modelId" TEXT NOT NULL, "completionTokens" INTEGER NOT NULL,
  "costUsd" DOUBLE PRECISION, "costEur" DOUBLE PRECISION, "creditsCharged" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BudgetLimit" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "perGenerationCredits" INTEGER,
  "projectCredits" INTEGER, "dailyCredits" INTEGER, "monthlyCredits" INTEGER,
  "projectUsd" DOUBLE PRECISION, "alertThresholds" JSONB NOT NULL DEFAULT '[50,75,90]',
  "blockAtPercent" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BudgetLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinalExport" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "status" "FinalExportStatus" NOT NULL DEFAULT 'DRAFT', "format" TEXT NOT NULL,
  "resolution" TEXT NOT NULL, "storageKey" TEXT, "url" TEXT, "errorMessage" TEXT,
  "settings" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FinalExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentRecord" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "personName" TEXT NOT NULL, "authorizationType" TEXT NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL, "documentAssetId" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtistIdentity_projectId_key" ON "ArtistIdentity"("projectId");
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE UNIQUE INDEX "StoryboardScene_projectId_order_key" ON "StoryboardScene"("projectId", "order");
CREATE UNIQUE INDEX "GenerationTask_bytePlusTaskId_key" ON "GenerationTask"("bytePlusTaskId");
CREATE UNIQUE INDEX "GenerationTask_idempotencyKey_key" ON "GenerationTask"("idempotencyKey");
CREATE UNIQUE INDEX "GenerationVariant_taskId_variantNumber_key" ON "GenerationVariant"("taskId", "variantNumber");
CREATE UNIQUE INDEX "TokenUsage_taskId_key" ON "TokenUsage"("taskId");
CREATE UNIQUE INDEX "BudgetLimit_projectId_key" ON "BudgetLimit"("projectId");
CREATE INDEX "VideoProject_userId_updatedAt_idx" ON "VideoProject"("userId", "updatedAt");
CREATE INDEX "MediaAsset_projectId_type_idx" ON "MediaAsset"("projectId", "type");
CREATE INDEX "MediaAsset_userId_createdAt_idx" ON "MediaAsset"("userId", "createdAt");
CREATE INDEX "StoryboardScene_projectId_status_idx" ON "StoryboardScene"("projectId", "status");
CREATE INDEX "GenerationTask_userId_createdAt_idx" ON "GenerationTask"("userId", "createdAt");
CREATE INDEX "GenerationTask_projectId_status_idx" ON "GenerationTask"("projectId", "status");
CREATE INDEX "GenerationTask_sceneId_createdAt_idx" ON "GenerationTask"("sceneId", "createdAt");
CREATE INDEX "GenerationVariant_sceneId_selected_idx" ON "GenerationVariant"("sceneId", "selected");
CREATE INDEX "TokenUsage_projectId_createdAt_idx" ON "TokenUsage"("projectId", "createdAt");
CREATE INDEX "TokenUsage_userId_createdAt_idx" ON "TokenUsage"("userId", "createdAt");
CREATE INDEX "FinalExport_projectId_createdAt_idx" ON "FinalExport"("projectId", "createdAt");
CREATE INDEX "ConsentRecord_projectId_consentedAt_idx" ON "ConsentRecord"("projectId", "consentedAt");
CREATE INDEX "ConsentRecord_userId_createdAt_idx" ON "ConsentRecord"("userId", "createdAt");

ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArtistIdentity" ADD CONSTRAINT "ArtistIdentity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryboardScene" ADD CONSTRAINT "StoryboardScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryboardScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationVariant" ADD CONSTRAINT "GenerationVariant_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "GenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationVariant" ADD CONSTRAINT "GenerationVariant_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryboardScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryboardScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "GenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLimit" ADD CONSTRAINT "BudgetLimit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinalExport" ADD CONSTRAINT "FinalExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
