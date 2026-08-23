-- Exécuter avant de repromouvoir un déploiement qui utilise les anciens statuts.
ALTER TABLE "GenerationTask" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "GenerationTask" SET "status" = 'CREATED' WHERE "status" = 'PENDING';
UPDATE "GenerationTask" SET "status" = 'SUBMITTING' WHERE "status" = 'SUBMITTED';
UPDATE "GenerationTask" SET "status" = 'RUNNING' WHERE "status" = 'PROCESSING';
UPDATE "GenerationTask" SET "status" = 'CANCELED' WHERE "status" = 'CANCELLED';
UPDATE "GenerationTask" SET "status" = 'FAILED' WHERE "status" = 'REFUNDED';
ALTER TABLE "GenerationTask" ALTER COLUMN "status" SET DEFAULT 'CREATED';
