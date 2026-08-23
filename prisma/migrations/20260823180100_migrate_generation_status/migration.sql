ALTER TABLE "GenerationTask" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "GenerationTask" SET "status" = 'PENDING' WHERE "status" = 'CREATED';
UPDATE "GenerationTask" SET "status" = 'SUBMITTED' WHERE "status" IN ('SUBMITTING', 'SUBMISSION_UNKNOWN');
UPDATE "GenerationTask" SET "status" = 'PROCESSING' WHERE "status" IN ('QUEUED', 'RUNNING');
UPDATE "GenerationTask" SET "status" = 'FAILED' WHERE "status" IN ('REJECTED', 'EXPIRED');
UPDATE "GenerationTask" SET "status" = 'CANCELLED' WHERE "status" = 'CANCELED';
ALTER TABLE "GenerationTask" ALTER COLUMN "status" SET DEFAULT 'PENDING';
