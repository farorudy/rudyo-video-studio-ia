-- AUDIT INCIDENT (fin) — LECTURE SEULE STRICTE.
BEGIN;
SET TRANSACTION READ ONLY;

\echo '=== A. HEARTBEAT DU WORKER FAUTIF (doit cesser de progresser) ==='
SELECT id, status, "lastSeenAt", now() - "lastSeenAt" AS silence
FROM "WorkerHeartbeat" ORDER BY "lastSeenAt" DESC LIMIT 3;

\echo '=== B. REMBOURSEMENTS EXISTANTS POUR CE COMPTE ==='
SELECT count(*) FILTER (WHERE t.type::text = 'REFUND')       AS ecritures_refund,
       count(*) FILTER (WHERE t.status::text = 'REFUNDED')   AS reservations_remboursees
FROM "CreditTransaction" t
JOIN "User" u ON u.id = t."userId"
WHERE u.email = 'rudyfaro@farorudy.com';

\echo '=== C. ETAT DES DEUX RESERVATIONS CONCERNEES ==='
SELECT id, type, status, "creditsAmount", "createdAt"
FROM "CreditTransaction"
WHERE id IN ('cmtaxj31j000cq926wdhsx856','cmtax9vvk0003ev6ovfgbbfjd');

\echo '=== D. EVENEMENTS DES DEUX TACHES ==='
SELECT left(e."jobId", 8) AS job, e.status, e.progress, left(e.message, 45) AS message, e."createdAt"
FROM "ClipWorkerJobEvent" e
WHERE e."jobId" IN ('c3fe7a5c-4937-4c54-9a82-dffc51c00718','5e74b2ff-7f9b-4005-8d59-282b265cbbda')
ORDER BY e."jobId", e."createdAt";

\echo '=== E. URL COMPLETES DES MP4 A CONTROLER ==='
SELECT f.id, f."projectId", f.url
FROM "FinalExport" f
WHERE f."projectId" IN ('cmtaxj2bo0006q926jkfrr355','cmtax3x8s0006xg2j9awdiksd');

ROLLBACK;
