-- Amorce un job de clip mock sur le worker Railway déployé.
-- Identifiants fixes pour pouvoir suivre le résultat ensuite.

DELETE FROM "ClipWorkerJob"  WHERE "userId" = 'railway-e2e-user';
DELETE FROM "FinalExport"    WHERE "projectId" = '22222222-2222-4222-8222-222222222222';
DELETE FROM "VideoProject"   WHERE "userId" = 'railway-e2e-user';
DELETE FROM "User"           WHERE id = 'railway-e2e-user';

INSERT INTO "User" (id, email, name, "creditsRemaining", "creditsTotal", "updatedAt")
VALUES ('railway-e2e-user', 'railway-e2e@rudyo.test', 'Validation Railway', 10000, 10000, now());

INSERT INTO "VideoProject" (id, "userId", title, "artistName", "durationSeconds", "billedDurationSeconds", status, "clipPlan", "updatedAt")
VALUES ('22222222-2222-4222-8222-222222222222', 'railway-e2e-user', 'Validation Railway mock', 'Artiste synthetique', 15, 15, 'GENERATING', 'TIKTOK', now());

INSERT INTO "FinalExport" (id, "projectId", format, resolution, status, "updatedAt")
VALUES ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', '9:16', '1080p', 'QUEUED', now());

INSERT INTO "ClipWorkerJob" (
  id, "userId", "projectId", "finalExportId", status, progress,
  "inputManifest", "outputPath", "idempotencyKey", "availableAt", "updatedAt"
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'railway-e2e-user',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  'QUEUED', 0,
  jsonb_build_object(
    'version', 1,
    'jobId', '11111111-1111-4111-8111-111111111111',
    'userId', 'railway-e2e-user',
    'projectId', '22222222-2222-4222-8222-222222222222',
    'finalExportId', '33333333-3333-4333-8333-333333333333',
    'photoStorageKey', 'railway-fixtures/portrait.png',
    'audioStorageKey', 'railway-fixtures/music.wav',
    'audioStartSeconds', 0,
    'durationSeconds', 15,
    'outputStorageKey', 'users/railway-e2e-user/projects/22222222-2222-4222-8222-222222222222/final/clip.mp4',
    'plan', 'TIKTOK',
    'creditReservationId', '44444444-4444-4444-8444-444444444444'
  ),
  'users/railway-e2e-user/projects/22222222-2222-4222-8222-222222222222/final/clip.mp4',
  'clip-worker:22222222-2222-4222-8222-222222222222',
  now(), now()
);

SELECT id, status, progress FROM "ClipWorkerJob" WHERE "userId" = 'railway-e2e-user';
