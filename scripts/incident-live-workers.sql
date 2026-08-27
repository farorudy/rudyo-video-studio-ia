BEGIN;
SET TRANSACTION READ ONLY;

\echo '=== WORKERS VIVANTS SUR LA PRODUCTION ==='
SELECT id, status, "ffmpegAvailable" AS ffmpeg, "lastSeenAt",
       now() - "lastSeenAt" AS silence,
       (now() - "lastSeenAt") < interval '90 seconds' AS considere_actif
FROM "WorkerHeartbeat"
ORDER BY "lastSeenAt" DESC
LIMIT 5;

\echo '=== TACHES NON TERMINALES (risque de debit) ==='
SELECT count(*) AS taches_en_attente
FROM "ClipWorkerJob"
WHERE status NOT IN ('SUCCEEDED','FAILED','REFUNDED');

ROLLBACK;
