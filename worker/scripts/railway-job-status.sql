SELECT j.status,
       j.progress,
       j."attemptCount" AS tries,
       coalesce(j."errorCode", '-') AS err,
       coalesce(left(j."errorMessage", 60), '-') AS msg,
       f.status AS export_status,
       coalesce(left(f.url, 70), '-') AS export_url
FROM "ClipWorkerJob" j
LEFT JOIN "FinalExport" f ON f.id = j."finalExportId"
WHERE j."userId" = 'railway-e2e-user';

SELECT status, progress, left(message, 55) AS message
FROM "ClipWorkerJobEvent"
WHERE "jobId" = '11111111-1111-4111-8111-111111111111'
ORDER BY "createdAt";
