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

CREATE UNIQUE INDEX "ApiIdempotency_scope_ownerKey_keyHash_key" ON "ApiIdempotency"("scope", "ownerKey", "keyHash");
CREATE INDEX "ApiIdempotency_expiresAt_idx" ON "ApiIdempotency"("expiresAt");
CREATE INDEX "ContactRequest_createdAt_idx" ON "ContactRequest"("createdAt");
CREATE INDEX "ContactRequest_ipHash_createdAt_idx" ON "ContactRequest"("ipHash", "createdAt");
