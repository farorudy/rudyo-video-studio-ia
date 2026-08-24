CREATE TYPE "ClipPlan" AS ENUM ('TIKTOK', 'LONG', 'PREMIUM', 'CUSTOM');

ALTER TABLE "VideoProject"
  ADD COLUMN "clipPlan" "ClipPlan",
  ADD COLUMN "paymentCompletedAt" TIMESTAMP(3);

CREATE INDEX "VideoProject_clipPlan_status_idx"
  ON "VideoProject"("clipPlan", "status");
