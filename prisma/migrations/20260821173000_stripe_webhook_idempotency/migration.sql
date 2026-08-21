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

CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");
CREATE INDEX "StripeWebhookEvent_status_createdAt_idx" ON "StripeWebhookEvent"("status", "createdAt");
CREATE UNIQUE INDEX "SubscriptionCreditGrant_invoiceId_key" ON "SubscriptionCreditGrant"("invoiceId");
CREATE INDEX "SubscriptionCreditGrant_userId_createdAt_idx" ON "SubscriptionCreditGrant"("userId", "createdAt");
CREATE INDEX "SubscriptionCreditGrant_stripeSubscriptionId_createdAt_idx" ON "SubscriptionCreditGrant"("stripeSubscriptionId", "createdAt");
