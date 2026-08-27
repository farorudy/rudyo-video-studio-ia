SELECT id,
       status,
       "ffmpegAvailable" AS ffmpeg,
       "databaseAvailable" AS db,
       "storageAvailable" AS storage,
       coalesce("errorCode", '-') AS err,
       "lastSeenAt"
FROM "WorkerHeartbeat"
ORDER BY "lastSeenAt" DESC
LIMIT 5;
