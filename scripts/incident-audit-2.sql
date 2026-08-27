-- AUDIT INCIDENT (suite) — LECTURE SEULE STRICTE.
BEGIN;
SET TRANSACTION READ ONLY;

\echo '=== 7. SCENARIO / SCENES ==='
SELECT p.id AS project_id, p."billedDurationSeconds" AS billed, count(s.id) AS scenes,
       coalesce(sum(s."durationSeconds"), 0) AS scene_seconds
FROM "VideoProject" p
LEFT JOIN "StoryboardScene" s ON s."projectId" = p.id
WHERE p.id IN ('cmtaxj2bo0006q926jkfrr355','cmtax3x8s0006xg2j9awdiksd')
GROUP BY p.id, p."billedDurationSeconds";

\echo '=== 8. APPELS FOURNISSEUR SEEDANCE ==='
SELECT count(*) AS generation_tasks
FROM "GenerationTask" g
WHERE g."projectId" IN ('cmtaxj2bo0006q926jkfrr355','cmtax3x8s0006xg2j9awdiksd');

SELECT g.id, g.provider, g.status, g."providerTaskId" IS NOT NULL AS has_provider_task
FROM "GenerationTask" g
WHERE g."projectId" IN ('cmtaxj2bo0006q926jkfrr355','cmtax3x8s0006xg2j9awdiksd')
LIMIT 5;

\echo '=== 9. REMBOURSEMENTS DEJA PRESENTS POUR CES DEUX RESERVATIONS ==='
SELECT id, type, status, "creditsAmount", left("idempotencyKey", 60) AS idem
FROM "CreditTransaction"
WHERE id IN ('cmtaxj31j000cq926wdhsx856','cmtax9vvk0003ev6ovfgbbfjd')
   OR "idempotencyKey" LIKE 'refund:%';

\echo '=== 10. EVENEMENTS DES DEUX TACHES ==='
SELECT e."jobId", e.status, e.progress, left(e.message, 50) AS message, e."createdAt"
FROM "ClipWorkerJobEvent" e
WHERE e."jobId" IN ('c3fe7a5c-4937-4c54-9a82-dffc51c00718','5e74b2ff-7f9b-4005-8d59-282b265cbbda')
ORDER BY e."jobId", e."createdAt";

\echo '=== 11. MANIFESTE ET CHEMIN DE SORTIE ==='
SELECT id, "outputPath", (("inputManifest")->>'photoStorageKey') IS NOT NULL AS has_photo,
       (("inputManifest")->>'audioStorageKey') IS NOT NULL AS has_audio
FROM "ClipWorkerJob"
WHERE id IN ('c3fe7a5c-4937-4c54-9a82-dffc51c00718','5e74b2ff-7f9b-4005-8d59-282b265cbbda');

ROLLBACK;
