-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'STARTER', 'CREATOR', 'STUDIO');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'BONUS', 'RESERVATION');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'RESERVED', 'CONFIRMED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CreditAction" AS ENUM ('STORYBOARD_SIMPLE', 'STORYBOARD_COMPLETE', 'PROMPTS_VIDEO', 'SCRIPT_VOICEOVER', 'SUBTITLES', 'EXPORT_PDF', 'EXPORT_TXT', 'CLIP_PACK', 'OTHER');

-- CreateEnum
CREATE TYPE "VideoProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'GENERATING', 'RENDERING', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClipPlan" AS ENUM ('TIKTOK', 'LONG', 'PREMIUM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('AUDIO', 'ARTIST_PORTRAIT', 'ARTIST_PROFILE_LEFT', 'ARTIST_PROFILE_RIGHT', 'ARTIST_FULL_BODY', 'REFERENCE_IMAGE', 'REFERENCE_VIDEO', 'DECOR', 'OUTFIT', 'FIRST_FRAME', 'LAST_FRAME', 'CONSENT_DOCUMENT', 'GENERATED_VIDEO', 'THUMBNAIL', 'FINAL_EXPORT');

-- CreateEnum
CREATE TYPE "StoryboardSceneStatus" AS ENUM ('DRAFT', 'READY', 'SUBMITTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "GenerationTaskStatus" AS ENUM ('PENDING', 'SUBMITTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FinalExportStatus" AS ENUM ('DRAFT', 'QUEUED', 'RENDERING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MontageJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'DOWNLOADING', 'PREPARING', 'RENDERING', 'UPLOADING', 'SUCCEEDED', 'RETRYING', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ClipWorkerJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'PREPARING', 'RENDERING', 'UPLOADING', 'SUCCEEDED', 'RETRYING', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WorkerHealthStatus" AS ENUM ('ONLINE', 'DEGRADED', 'STOPPING');

-- CreateEnum
CREATE TYPE "SystemTestStatus" AS ENUM ('PREPARING', 'QUEUED', 'RUNNING', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'CLEANED');

-- CreateEnum
CREATE TYPE "SystemTestScenario" AS ENUM ('SUCCESS', 'INVALID_VIDEO', 'MISSING_AUDIO', 'INTERRUPTED_WORKER', 'EXPIRED_LEASE', 'STORAGE_FAILURE', 'DOUBLE_CLAIM', 'IDEMPOTENCY_REPLAY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
    "creditsTotal" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
    "monthlyLimit" INTEGER NOT NULL DEFAULT 0,
    "monthlyUsed" INTEGER NOT NULL DEFAULT 0,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "preferredAiProvider" TEXT,
    "allowPremiumAi" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requestedName" TEXT,
    "tokenHash" TEXT NOT NULL,
    "requestedIpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthThrottle" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiIdempotency" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "response" JSONB,
    "responseCode" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "videoType" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "deadline" TEXT,
    "budget" TEXT,
    "filesNote" TEXT,
    "message" TEXT,
    "ipHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
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

-- CreateTable
CREATE TABLE "CreditUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "action" "CreditAction" NOT NULL,
    "creditsAmount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "providerTaskId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "action" "CreditAction" NOT NULL,
    "quality" TEXT,
    "estimatedInputTokens" INTEGER,
    "estimatedOutputTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "creditsCharged" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "plan" "UserPlan" NOT NULL,
    "status" "BillingStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCreditGrant" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCreditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "includedGenerations" INTEGER NOT NULL,
    "includedCredits" INTEGER NOT NULL,
    "allowPremiumAi" BOOLEAN NOT NULL DEFAULT false,
    "maxProjects" INTEGER NOT NULL DEFAULT 1,
    "stripePriceId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPack" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "stripePriceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminSubject" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "musicGenre" TEXT,
    "bpm" INTEGER,
    "durationSeconds" INTEGER,
    "finalFormat" TEXT NOT NULL DEFAULT '16:9',
    "summary" TEXT,
    "mood" TEXT,
    "visualStyle" TEXT,
    "locations" JSONB,
    "colors" JSONB,
    "cameraMovements" JSONB,
    "status" "VideoProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "clipPlan" "ClipPlan",
    "paymentCompletedAt" TIMESTAMP(3),
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'USER',
    "billingMode" TEXT NOT NULL DEFAULT 'BILLABLE',
    "maxBudgetUsd" DOUBLE PRECISION,
    "maxBudgetCredits" INTEGER,
    "creditReservationId" TEXT,
    "audioStartSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billedDurationSeconds" DOUBLE PRECISION,
    "clientRevenueEur" DOUBLE PRECISION,
    "estimatedProviderCostEur" DOUBLE PRECISION,
    "actualProviderCostEur" DOUBLE PRECISION,
    "estimatedMarginEur" DOUBLE PRECISION,
    "actualMarginEur" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistIdentity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "physicalDescription" TEXT,
    "hairstyle" TEXT,
    "mainOutfit" TEXT,
    "accessories" JSONB,
    "colorPalette" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryboardScene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startTimeSeconds" DOUBLE PRECISION NOT NULL,
    "endTimeSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "mood" TEXT,
    "location" TEXT,
    "cameraMovement" TEXT,
    "modelId" TEXT,
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "ratio" TEXT NOT NULL DEFAULT '16:9',
    "variantsRequested" INTEGER NOT NULL DEFAULT 1,
    "seed" INTEGER,
    "cameraFixed" BOOLEAN NOT NULL DEFAULT false,
    "generateAudio" BOOLEAN NOT NULL DEFAULT false,
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "status" "StoryboardSceneStatus" NOT NULL DEFAULT 'DRAFT',
    "selectedVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryboardScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "bytePlusTaskId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'byteplus',
    "source" TEXT NOT NULL DEFAULT 'USER',
    "billingMode" TEXT NOT NULL DEFAULT 'BILLABLE',
    "modelId" TEXT NOT NULL,
    "status" "GenerationTaskStatus" NOT NULL DEFAULT 'PENDING',
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "estimatedCredits" INTEGER NOT NULL DEFAULT 0,
    "estimatedTokens" INTEGER,
    "actualCompletionTokens" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,
    "actualCostUsd" DOUBLE PRECISION,
    "sourceVideoUrl" TEXT,
    "permanentVideoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "creditReservationId" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationVariant" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "variantNumber" INTEGER NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION,
    "costEur" DOUBLE PRECISION,
    "creditsCharged" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLimit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "perGenerationCredits" INTEGER,
    "projectCredits" INTEGER,
    "dailyCredits" INTEGER,
    "monthlyCredits" INTEGER,
    "projectUsd" DOUBLE PRECISION,
    "alertThresholds" JSONB NOT NULL DEFAULT '[50,75,90]',
    "blockAtPercent" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalExport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "FinalExportStatus" NOT NULL DEFAULT 'DRAFT',
    "format" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "storageKey" TEXT,
    "url" TEXT,
    "errorMessage" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "MontageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MontageJobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "MontageJobStatus" NOT NULL,
    "progress" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MontageJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

    CONSTRAINT "ClipWorkerJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipWorkerJobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "ClipWorkerJobStatus" NOT NULL,
    "progress" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipWorkerJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "authorizationType" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "documentAssetId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_createdAt_idx" ON "EmailVerificationToken"("email", "createdAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_requestedIpHash_createdAt_idx" ON "EmailVerificationToken"("requestedIpHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthThrottle_blockedUntil_idx" ON "AuthThrottle"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AuthThrottle_keyHash_action_key" ON "AuthThrottle"("keyHash", "action");

-- CreateIndex
CREATE INDEX "ApiIdempotency_expiresAt_idx" ON "ApiIdempotency"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiIdempotency_scope_ownerKey_keyHash_key" ON "ApiIdempotency"("scope", "ownerKey", "keyHash");

-- CreateIndex
CREATE INDEX "ContactRequest_createdAt_idx" ON "ContactRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_ipHash_createdAt_idx" ON "ContactRequest"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripeSessionId_key" ON "Transaction"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditUsage_reservationId_key" ON "CreditUsage"("reservationId");

-- CreateIndex
CREATE INDEX "CreditUsage_userId_createdAt_idx" ON "CreditUsage"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "CreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_status_createdAt_idx" ON "StripeWebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCreditGrant_invoiceId_key" ON "SubscriptionCreditGrant"("invoiceId");

-- CreateIndex
CREATE INDEX "SubscriptionCreditGrant_userId_createdAt_idx" ON "SubscriptionCreditGrant"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionCreditGrant_stripeSubscriptionId_createdAt_idx" ON "SubscriptionCreditGrant"("stripeSubscriptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPlan_slug_key" ON "ProductPlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPlan_stripePriceId_key" ON "ProductPlan"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_slug_key" ON "CreditPack"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_stripePriceId_key" ON "CreditPack"("stripePriceId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoProject_creditReservationId_key" ON "VideoProject"("creditReservationId");

-- CreateIndex
CREATE INDEX "VideoProject_userId_updatedAt_idx" ON "VideoProject"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "VideoProject_clipPlan_status_idx" ON "VideoProject"("clipPlan", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistIdentity_projectId_key" ON "ArtistIdentity"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_projectId_type_idx" ON "MediaAsset"("projectId", "type");

-- CreateIndex
CREATE INDEX "MediaAsset_userId_createdAt_idx" ON "MediaAsset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StoryboardScene_projectId_status_idx" ON "StoryboardScene"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardScene_projectId_order_key" ON "StoryboardScene"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationTask_bytePlusTaskId_key" ON "GenerationTask"("bytePlusTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationTask_idempotencyKey_key" ON "GenerationTask"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationTask_creditReservationId_key" ON "GenerationTask"("creditReservationId");

-- CreateIndex
CREATE INDEX "GenerationTask_userId_createdAt_idx" ON "GenerationTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationTask_projectId_status_idx" ON "GenerationTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "GenerationTask_sceneId_createdAt_idx" ON "GenerationTask"("sceneId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationVariant_sceneId_selected_idx" ON "GenerationVariant"("sceneId", "selected");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationVariant_taskId_variantNumber_key" ON "GenerationVariant"("taskId", "variantNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TokenUsage_taskId_key" ON "TokenUsage"("taskId");

-- CreateIndex
CREATE INDEX "TokenUsage_projectId_createdAt_idx" ON "TokenUsage"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenUsage_userId_createdAt_idx" ON "TokenUsage"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLimit_projectId_key" ON "BudgetLimit"("projectId");

-- CreateIndex
CREATE INDEX "FinalExport_projectId_createdAt_idx" ON "FinalExport"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MontageJob_finalExportId_key" ON "MontageJob"("finalExportId");

-- CreateIndex
CREATE UNIQUE INDEX "MontageJob_idempotencyKey_key" ON "MontageJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MontageJob_status_availableAt_createdAt_idx" ON "MontageJob"("status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "MontageJob_projectId_status_idx" ON "MontageJob"("projectId", "status");

-- CreateIndex
CREATE INDEX "MontageJob_leaseExpiresAt_idx" ON "MontageJob"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "MontageJobEvent_jobId_createdAt_idx" ON "MontageJobEvent"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClipWorkerJob_finalExportId_key" ON "ClipWorkerJob"("finalExportId");

-- CreateIndex
CREATE UNIQUE INDEX "ClipWorkerJob_idempotencyKey_key" ON "ClipWorkerJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ClipWorkerJob_status_availableAt_createdAt_idx" ON "ClipWorkerJob"("status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "ClipWorkerJob_projectId_status_idx" ON "ClipWorkerJob"("projectId", "status");

-- CreateIndex
CREATE INDEX "ClipWorkerJob_leaseExpiresAt_idx" ON "ClipWorkerJob"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "ClipWorkerJobEvent_jobId_createdAt_idx" ON "ClipWorkerJobEvent"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_lastSeenAt_idx" ON "WorkerHeartbeat"("lastSeenAt");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_status_lastSeenAt_idx" ON "WorkerHeartbeat"("status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemTestRun_projectId_key" ON "SystemTestRun"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemTestRun_montageJobId_key" ON "SystemTestRun"("montageJobId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemTestRun_finalExportId_key" ON "SystemTestRun"("finalExportId");

-- CreateIndex
CREATE INDEX "SystemTestRun_status_createdAt_idx" ON "SystemTestRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SystemTestRun_expiresAt_cleanedAt_idx" ON "SystemTestRun"("expiresAt", "cleanedAt");

-- CreateIndex
CREATE INDEX "SystemTestRun_adminSubject_createdAt_idx" ON "SystemTestRun"("adminSubject", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_projectId_consentedAt_idx" ON "ConsentRecord"("projectId", "consentedAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_createdAt_idx" ON "ConsentRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditUsage" ADD CONSTRAINT "CreditUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistIdentity" ADD CONSTRAINT "ArtistIdentity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryboardScene" ADD CONSTRAINT "StoryboardScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryboardScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationVariant" ADD CONSTRAINT "GenerationVariant_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "GenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationVariant" ADD CONSTRAINT "GenerationVariant_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryboardScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryboardScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "GenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLimit" ADD CONSTRAINT "BudgetLimit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExport" ADD CONSTRAINT "FinalExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MontageJob" ADD CONSTRAINT "MontageJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MontageJob" ADD CONSTRAINT "MontageJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MontageJob" ADD CONSTRAINT "MontageJob_finalExportId_fkey" FOREIGN KEY ("finalExportId") REFERENCES "FinalExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MontageJobEvent" ADD CONSTRAINT "MontageJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MontageJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipWorkerJob" ADD CONSTRAINT "ClipWorkerJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipWorkerJob" ADD CONSTRAINT "ClipWorkerJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipWorkerJob" ADD CONSTRAINT "ClipWorkerJob_finalExportId_fkey" FOREIGN KEY ("finalExportId") REFERENCES "FinalExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipWorkerJobEvent" ADD CONSTRAINT "ClipWorkerJobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClipWorkerJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemTestRun" ADD CONSTRAINT "SystemTestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemTestRun" ADD CONSTRAINT "SystemTestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

