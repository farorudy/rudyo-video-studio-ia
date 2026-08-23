-- Baseline idempotente. Elle permet un `migrate deploy` sur une base vide et
-- reste sans effet sur une base de production qui contient déjà ces objets.
DO $$ BEGIN CREATE TYPE "UserPlan" AS ENUM ('FREE', 'STARTER', 'CREATOR', 'STUDIO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'BONUS', 'RESERVATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REFUNDED', 'CANCELED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CreditAction" AS ENUM ('STORYBOARD_SIMPLE', 'STORYBOARD_COMPLETE', 'PROMPTS_VIDEO', 'SCRIPT_VOICEOVER', 'SUBTITLES', 'EXPORT_PDF', 'EXPORT_TXT', 'CLIP_PACK', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
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
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "action" "CreditAction" NOT NULL,
  "creditsAmount" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AiUsageLog" (
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

CREATE TABLE IF NOT EXISTS "Subscription" (
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

CREATE TABLE IF NOT EXISTS "ProductPlan" (
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

CREATE TABLE IF NOT EXISTS "CreditPack" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductPlan_slug_key" ON "ProductPlan"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductPlan_stripePriceId_key" ON "ProductPlan"("stripePriceId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditPack_slug_key" ON "CreditPack"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditPack_stripePriceId_key" ON "CreditPack"("stripePriceId");

DO $$ BEGIN ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
