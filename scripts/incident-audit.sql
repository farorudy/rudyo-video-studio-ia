-- AUDIT INCIDENT — LECTURE SEULE STRICTE.
BEGIN;
SET TRANSACTION READ ONLY;

\echo '=== 1. COMPTE CONCERNE ==='
SELECT id, email, "creditsRemaining", "creditsTotal", "creditsUsed"
FROM "User" WHERE email = 'rudyfaro@farorudy.com';

\echo '=== 2. WORKERS AYANT SERVI LA PRODUCTION ==='
SELECT id, version, status, "ffmpegAvailable" AS ffmpeg, "databaseAvailable" AS db,
       "storageAvailable" AS storage, coalesce("errorCode",'-') AS err, "startedAt", "lastSeenAt"
FROM "WorkerHeartbeat" ORDER BY "lastSeenAt" DESC LIMIT 10;

\echo '=== 3. TACHES DE CLIP RECENTES ==='
SELECT j.id AS job_id, j."projectId", j.status, j.progress, j."attemptCount" AS tries,
       coalesce(j."errorCode",'-') AS err,
       (j."inputManifest"->>'durationSeconds') AS manifest_seconds,
       (j."inputManifest"->>'plan') AS plan,
       (j."inputManifest"->>'creditReservationId') AS reservation,
       j."createdAt", j."completedAt"
FROM "ClipWorkerJob" j ORDER BY j."createdAt" DESC LIMIT 10;

\echo '=== 4. PROJETS RECENTS ==='
SELECT p.id, p.title, p.status, p."clipPlan", p."durationSeconds", p."billedDurationSeconds",
       p."creditReservationId", p."createdAt"
FROM "VideoProject" p
JOIN "User" u ON u.id = p."userId"
WHERE u.email = 'rudyfaro@farorudy.com'
ORDER BY p."createdAt" DESC LIMIT 10;

\echo '=== 5. ECRITURES DE CREDITS ==='
SELECT t.id, t.type, t.status, t.action, t."creditsAmount", left(t.description, 45) AS description,
       left(t."idempotencyKey", 55) AS idem, t."createdAt"
FROM "CreditTransaction" t
JOIN "User" u ON u.id = t."userId"
WHERE u.email = 'rudyfaro@farorudy.com'
ORDER BY t."createdAt" DESC LIMIT 20;

\echo '=== 6. EXPORTS FINAUX ==='
SELECT f.id, f."projectId", f.status, f.format, f.resolution,
       coalesce(left(f.url, 60),'-') AS url, f."storageKey" IS NOT NULL AS has_key, f."createdAt"
FROM "FinalExport" f
JOIN "VideoProject" p ON p.id = f."projectId"
JOIN "User" u ON u.id = p."userId"
WHERE u.email = 'rudyfaro@farorudy.com'
ORDER BY f."createdAt" DESC LIMIT 10;

\echo '=== 7. SCENARIO / SCENES PAR PROJET ==='
SELECT p.id AS project_id, count(s.id) AS scenes,
       coalesce(sum(s."durationSeconds"), 0) AS total_scene_seconds,
       p."billedDurationSeconds" AS billed_seconds
FROM "VideoProject" p
JOIN "User" u ON u.id = p."userId"
LEFT JOIN "StoryboardScene" s ON s."projectId" = p.id
WHERE u.email = 'rudyfaro@farorudy.com'
GROUP BY p.id, p."billedDurationSeconds", p."createdAt"
ORDER BY p."createdAt" DESC LIMIT 10;

\echo '=== 8. APPELS FOURNISSEUR (GenerationTask) ==='
SELECT g.id, g.provider, g.status, g."providerTaskId" IS NOT NULL AS has_provider_task,
       g."permanentVideoUrl" IS NOT NULL AS has_video, g."createdAt"
FROM "GenerationTask" g
JOIN "VideoProject" p ON p.id = g."projectId"
JOIN "User" u ON u.id = p."userId"
WHERE u.email = 'rudyfaro@farorudy.com'
ORDER BY g."createdAt" DESC LIMIT 10;

\echo '=== 9. REMBOURSEMENTS DEJA PRESENTS ==='
SELECT count(*) AS refunds_existants
FROM "CreditTransaction" t
JOIN "User" u ON u.id = t."userId"
WHERE u.email = 'rudyfaro@farorudy.com' AND (t.type::text = 'REFUND' OR t.status::text = 'REFUNDED');

ROLLBACK;
