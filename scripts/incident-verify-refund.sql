BEGIN;
SET TRANSACTION READ ONLY;

\echo '=== SOLDE APRES REMBOURSEMENT ==='
SELECT email, "creditsRemaining", "creditsTotal", "creditsUsed"
FROM "User" WHERE email = 'rudyfaro@farorudy.com';

\echo '=== ECRITURES REFUND (doivent etre exactement 2) ==='
SELECT t.type, t.status, t."creditsAmount", left(t.description, 60) AS raison,
       left(t."idempotencyKey", 52) AS idem, t."createdAt"
FROM "CreditTransaction" t
JOIN "User" u ON u.id = t."userId"
WHERE u.email = 'rudyfaro@farorudy.com' AND t.type::text = 'REFUND'
ORDER BY t."createdAt";

\echo '=== ETAT DES DEUX RESERVATIONS D ORIGINE ==='
SELECT id, type, status, "creditsAmount"
FROM "CreditTransaction"
WHERE id IN ('cmtaxj31j000cq926wdhsx856','cmtax9vvk0003ev6ovfgbbfjd');

\echo '=== CONTROLE ANTI DOUBLE REMBOURSEMENT ==='
SELECT "idempotencyKey", count(*) AS occurrences
FROM "CreditTransaction"
WHERE "idempotencyKey" LIKE 'refund:incident-mock-worker:%'
GROUP BY "idempotencyKey";

ROLLBACK;
