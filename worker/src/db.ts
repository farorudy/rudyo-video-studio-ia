import pg from "pg";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { ClipWorkerJob, ClipWorkerManifest, MontageJob, MontageManifest, WorkerStage } from "./types.js";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Math.max(4, config.concurrency + 2),
  application_name: "rudyo-montage-worker",
  statement_timeout: 30_000,
});

export type ClipGenerationTaskRow = {
  id: string;
  sceneId: string;
  bytePlusTaskId: string | null;
  status: string;
  permanentVideoUrl: string | null;
  actualCompletionTokens: number | null;
  errorCode: string | null;
};

export async function ensureClipGenerationTask(job: ClipWorkerJob, manifest: ClipWorkerManifest, scene: ClipWorkerManifest["scenes"][number]) {
  const idempotencyKey = `clip-worker:${job.id}:scene:${scene.id}`;
  await pool.query(`
    INSERT INTO "GenerationTask" ("id","userId","projectId","sceneId","idempotencyKey","provider","source","billingMode","modelId","status","requestPayload","estimatedCredits","createdAt","updatedAt")
    VALUES ($1,$2,$3,$4,$5,'byteplus','USER','INCLUDED_IN_PROJECT',$6,'PENDING',$7::jsonb,0,NOW(),NOW())
    ON CONFLICT ("idempotencyKey") DO NOTHING
  `, [randomUUID(), job.userId, job.projectId, scene.id, idempotencyKey, scene.modelId, JSON.stringify({ model: scene.modelId, prompt: scene.prompt, duration: scene.durationSeconds, resolution: scene.resolution, ratio: scene.ratio, referenceAssetUri: manifest.referenceAssetUri })]);
  const result = await pool.query<ClipGenerationTaskRow>(`SELECT "id","sceneId","bytePlusTaskId","status"::text,"permanentVideoUrl","actualCompletionTokens","errorCode" FROM "GenerationTask" WHERE "idempotencyKey"=$1`, [idempotencyKey]);
  if (!result.rows[0]) throw new Error("GENERATION_TASK_PERSIST_FAILED");
  return result.rows[0];
}

export async function attachClipProviderTask(taskId: string, providerTaskId: string, response: unknown) {
  await pool.query(`UPDATE "GenerationTask" SET "bytePlusTaskId"=$2,"status"='SUBMITTED',"responsePayload"=$3::jsonb,"updatedAt"=NOW() WHERE "id"=$1 AND "bytePlusTaskId" IS NULL`, [taskId, providerTaskId, JSON.stringify(response)]);
  await pool.query(`UPDATE "StoryboardScene" SET "status"='QUEUED',"updatedAt"=NOW() WHERE "id"=(SELECT "sceneId" FROM "GenerationTask" WHERE "id"=$1)`, [taskId]);
}

export async function markClipSubmissionUnknown(taskId: string) {
  await pool.query(`UPDATE "GenerationTask" SET "status"='SUBMITTED',"errorCode"='SUBMISSION_UNKNOWN',"errorMessage"='Soumission BytePlus incertaine : aucune recréation automatique.',"updatedAt"=NOW() WHERE "id"=$1`, [taskId]);
}

export async function updateClipProviderProgress(taskId: string, remote: { status?: string; error?: unknown }) {
  const failed = remote.status === "failed" || remote.status === "cancelled" || remote.status === "expired";
  await pool.query(`UPDATE "GenerationTask" SET "status"=$2::"GenerationTaskStatus","responsePayload"=$3::jsonb,"errorCode"=$4,"errorMessage"=$5,"lastPolledAt"=NOW(),"completedAt"=CASE WHEN $2 IN ('FAILED','CANCELLED') THEN NOW() ELSE "completedAt" END,"updatedAt"=NOW() WHERE "id"=$1`, [taskId, failed ? (remote.status === "cancelled" ? "CANCELLED" : "FAILED") : "PROCESSING", JSON.stringify(remote), failed ? String((remote.error as { code?: string } | undefined)?.code || "BYTEPLUS_TASK_FAILED") : null, failed ? String((remote.error as { message?: string } | undefined)?.message || "La scène Seedance a échoué.").slice(0, 300) : null]);
  await pool.query(`UPDATE "StoryboardScene" SET "status"=$2::"StoryboardSceneStatus","updatedAt"=NOW() WHERE "id"=(SELECT "sceneId" FROM "GenerationTask" WHERE "id"=$1)`, [taskId, failed ? (remote.status === "cancelled" ? "CANCELED" : "FAILED") : "RUNNING"]);
}

export async function completeClipGenerationTask(options: { job: ClipWorkerJob; taskId: string; sceneId: string; remote: unknown; providerVideoUrl: string; permanentVideoUrl: string; tokens: number }) {
  const costUsd = (options.tokens / 1_000_000) * config.bytePlusUsdPerMillionTokens;
  const costEur = costUsd * config.usdToEurRate;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE "GenerationTask" SET "status"='SUCCEEDED',"responsePayload"=$2::jsonb,"sourceVideoUrl"=$3,"permanentVideoUrl"=$4,"actualCompletionTokens"=$5,"actualCostUsd"=$6,"lastPolledAt"=NOW(),"completedAt"=NOW(),"errorCode"=NULL,"errorMessage"=NULL,"updatedAt"=NOW() WHERE "id"=$1`, [options.taskId, JSON.stringify(options.remote), options.providerVideoUrl, options.permanentVideoUrl, options.tokens, costUsd]);
    await client.query(`UPDATE "StoryboardScene" SET "status"='COMPLETED',"updatedAt"=NOW() WHERE "id"=$1`, [options.sceneId]);
    await client.query(`INSERT INTO "GenerationVariant" ("id","taskId","sceneId","variantNumber","videoUrl","durationSeconds","selected","createdAt") VALUES ($1,$2,$3,1,$4,NULL,true,NOW()) ON CONFLICT ("taskId","variantNumber") DO UPDATE SET "videoUrl"=EXCLUDED."videoUrl","selected"=true`, [randomUUID(), options.taskId, options.sceneId, options.permanentVideoUrl]);
    await client.query(`INSERT INTO "TokenUsage" ("id","userId","projectId","sceneId","taskId","modelId","completionTokens","costUsd","costEur","creditsCharged","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,NOW()) ON CONFLICT ("taskId") DO UPDATE SET "completionTokens"=EXCLUDED."completionTokens","costUsd"=EXCLUDED."costUsd","costEur"=EXCLUDED."costEur"`, [randomUUID(), options.job.userId, options.job.projectId, options.sceneId, options.taskId, config.bytePlusVideoModel, options.tokens, costUsd, costEur]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  return { costUsd, costEur };
}

// pg emits connection failures from idle clients on the Pool itself. Without
// a listener, a brief database restart terminates the whole worker process.
pool.on("error", (error) => {
  console.error(JSON.stringify({
    event: "database_pool_error",
    message: error.message.split("\n", 1)[0],
  }));
});

export async function checkDatabase() {
  await pool.query("SELECT 1");
}

export async function publishWorkerHeartbeat(input: {
  status: "ONLINE" | "DEGRADED" | "STOPPING";
  currentJobId?: string | null;
  ffmpegAvailable: boolean;
  databaseAvailable: boolean;
  storageAvailable: boolean;
  tempAvailableBytes?: bigint | null;
  errorCode?: string | null;
}) {
  await pool.query(`
    INSERT INTO "WorkerHeartbeat" (
      "id", "version", "status", "lastSeenAt", "currentJobId", "ffmpegAvailable",
      "databaseAvailable", "storageAvailable", "tempAvailableBytes", "errorCode", "startedAt", "updatedAt"
    ) VALUES ($1, $2, $3::"WorkerHealthStatus", NOW(), $4, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT ("id") DO UPDATE SET
      "version" = EXCLUDED."version", "status" = EXCLUDED."status", "lastSeenAt" = NOW(),
      "currentJobId" = EXCLUDED."currentJobId", "ffmpegAvailable" = EXCLUDED."ffmpegAvailable",
      "databaseAvailable" = EXCLUDED."databaseAvailable", "storageAvailable" = EXCLUDED."storageAvailable",
      "tempAvailableBytes" = EXCLUDED."tempAvailableBytes", "errorCode" = EXCLUDED."errorCode", "updatedAt" = NOW()
  `, [config.workerId, config.workerVersion, input.status, input.currentJobId || null, input.ffmpegAvailable,
    input.databaseAvailable, input.storageAvailable, input.tempAvailableBytes ?? null, input.errorCode || null]);
}

async function appendJobEvent(jobId: string, status: string, progress: number, message: string) {
  await pool.query(`
    INSERT INTO "MontageJobEvent" ("id", "jobId", "status", "progress", "message", "createdAt")
    VALUES (md5(random()::text || clock_timestamp()::text), $1, $2::"MontageJobStatus", $3, $4, NOW())
  `, [jobId, status, progress, message]);
}

export const CLAIM_JOB_SQL = `
    WITH candidate AS (
      SELECT "id"
      FROM "MontageJob"
      WHERE "attemptCount" < LEAST("maxAttempts", $3)
        AND (
          ("status" IN ('QUEUED', 'RETRYING') AND "availableAt" <= NOW())
          OR
          ("status" IN ('CLAIMED', 'DOWNLOADING', 'PREPARING', 'RENDERING', 'UPLOADING') AND "leaseExpiresAt" < NOW())
        )
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "MontageJob" AS job
    SET "status" = 'CLAIMED',
        "progress" = GREATEST(job."progress", 1),
        "lockedBy" = $1,
        "lockedAt" = NOW(),
        "leaseExpiresAt" = NOW() + ($2 * INTERVAL '1 second'),
        "attemptCount" = job."attemptCount" + 1,
        "startedAt" = COALESCE(job."startedAt", NOW()),
        "errorCode" = NULL,
        "errorMessage" = NULL,
        "updatedAt" = NOW()
    FROM candidate
    WHERE job."id" = candidate."id"
    RETURNING job.*
  `;

export async function claimJob(): Promise<MontageJob | null> {
  const result = await pool.query<MontageJob>(CLAIM_JOB_SQL, [config.workerId, config.leaseSeconds, config.maxAttempts]);
  const job = result.rows[0] || null;
  if (job) {
    await appendJobEvent(job.id, "CLAIMED", Math.max(job.progress, 1), "Tâche prise par le worker");
    await pool.query(`UPDATE "SystemTestRun" SET "status" = 'RUNNING', "updatedAt" = NOW() WHERE "montageJobId" = $1`, [job.id]);
  }
  return job;
}

export async function heartbeat(jobId: string) {
  const result = await pool.query(`
    UPDATE "MontageJob"
    SET "leaseExpiresAt" = NOW() + ($3 * INTERVAL '1 second'), "updatedAt" = NOW()
    WHERE "id" = $1 AND "lockedBy" = $2
      AND "status" IN ('CLAIMED', 'DOWNLOADING', 'PREPARING', 'RENDERING', 'UPLOADING')
  `, [jobId, config.workerId, config.leaseSeconds]);
  if (result.rowCount !== 1) throw new Error("LEASE_LOST");
}

export async function setStage(jobId: string, stage: WorkerStage, progress: number) {
  const result = await pool.query(`
    UPDATE "MontageJob"
    SET "status" = $3::"MontageJobStatus", "progress" = $4,
        "leaseExpiresAt" = NOW() + ($5 * INTERVAL '1 second'), "updatedAt" = NOW()
    WHERE "id" = $1 AND "lockedBy" = $2
  `, [jobId, config.workerId, stage, Math.max(0, Math.min(99, Math.round(progress))), config.leaseSeconds]);
  if (result.rowCount !== 1) throw new Error("LEASE_LOST");
  const messages: Record<WorkerStage, string> = {
    DOWNLOADING: "Téléchargement des scènes",
    PREPARING: "Préparation des médias",
    RENDERING: "Montage FFmpeg",
    UPLOADING: "Envoi du MP4 final",
  };
  await appendJobEvent(jobId, stage, Math.max(0, Math.min(99, Math.round(progress))), messages[stage]);
  await pool.query(`
    UPDATE "SystemTestRun" SET "status" = $2::"SystemTestStatus", "updatedAt" = NOW()
    WHERE "montageJobId" = $1
  `, [jobId, stage === "UPLOADING" ? "VERIFYING" : "RUNNING"]);
}

export async function completeJob(job: MontageJob, outputUrl: string, diagnostics: Record<string, unknown>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(`
      UPDATE "MontageJob"
      SET "status" = 'SUCCEEDED', "progress" = 100, "completedAt" = NOW(),
          "lockedBy" = NULL, "lockedAt" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
      WHERE "id" = $1 AND "lockedBy" = $2
    `, [job.id, config.workerId]);
    if (updated.rowCount !== 1) throw new Error("LEASE_LOST");
    await client.query(`
      UPDATE "FinalExport"
      SET "status" = 'COMPLETED', "storageKey" = $2, "url" = $3,
          "errorMessage" = NULL, "updatedAt" = NOW()
      WHERE "id" = $1
    `, [job.finalExportId, job.outputPath, outputUrl]);
    await client.query(`UPDATE "VideoProject" SET "status" = 'COMPLETED', "updatedAt" = NOW() WHERE "id" = $1`, [job.projectId]);
    const billingManifest = job.inputManifest as MontageManifest;
    for (const reservationId of new Set(billingManifest.creditReservationIds)) {
      const confirmed = await client.query<{ userId: string; amount: number; description: string; action: string }>(`
        WITH changed AS (
          UPDATE "CreditTransaction"
          SET "status" = 'CONFIRMED', "confirmedAt" = NOW(), "updatedAt" = NOW()
          WHERE "id" = $1 AND "status" = 'RESERVED'
          RETURNING "userId", ABS("creditsAmount")::int AS amount, "description", "action"::text AS action
        ) SELECT * FROM changed
      `, [reservationId]);
      const row = confirmed.rows[0];
      if (row) {
        await client.query(`UPDATE "User" SET "creditsUsed" = "creditsUsed" + $2, "updatedAt" = NOW() WHERE "id" = $1`, [row.userId, row.amount]);
        await client.query(`
          INSERT INTO "CreditUsage" ("id", "userId", "amount", "reason", "metadata", "reservationId", "createdAt")
          VALUES (md5(random()::text || clock_timestamp()::text), $1, $2, $3, jsonb_build_object('reservationId', $4::text, 'action', $5::text), $4::text, NOW())
          ON CONFLICT ("reservationId") DO NOTHING
        `, [row.userId, row.amount, row.description, reservationId, row.action]);
      }
    }
    await client.query(`
      UPDATE "VideoProject" AS project
      SET "actualProviderCostEur" = costs.total,
          "actualMarginEur" = CASE WHEN project."clientRevenueEur" IS NULL THEN NULL ELSE project."clientRevenueEur" - costs.total END,
          "updatedAt" = NOW()
      FROM (SELECT COALESCE(SUM("costEur"), 0)::double precision AS total FROM "TokenUsage" WHERE "projectId" = $1) AS costs
      WHERE project."id" = $1
    `, [job.projectId]);
    await client.query(`
      INSERT INTO "MontageJobEvent" ("id", "jobId", "status", "progress", "message", "createdAt")
      VALUES (md5(random()::text || clock_timestamp()::text), $1, 'SUCCEEDED', 100, 'Test terminé', NOW())
    `, [job.id]);
    const manifest = job.inputManifest as { systemTestRunId?: string };
    if (manifest.systemTestRunId) {
      const balance = await client.query<{ creditsRemaining: number }>(`SELECT "creditsRemaining" FROM "User" WHERE "id" = $1`, [job.userId]);
      const billing = await client.query<{ count: string }>(`
        SELECT (
          (SELECT COUNT(*) FROM "GenerationTask"
           WHERE "projectId" = $1 AND ("source" <> 'SYSTEM_TEST' OR "billingMode" <> 'NON_BILLABLE' OR "provider" <> 'TEST_FIXTURE' OR "creditReservationId" IS NOT NULL OR "estimatedCredits" <> 0))
          +
          (SELECT COUNT(*) FROM "CreditTransaction" WHERE "metadata"->>'projectId' = $1 OR "metadata"->>'testRunId' = $2)
        )::text AS count
      `, [job.projectId, manifest.systemTestRunId]);
      const claimEvents = await client.query<{ count: string }>(`
        SELECT COUNT(*)::text AS count FROM "MontageJobEvent" WHERE "jobId" = $1 AND "status" = 'CLAIMED'
      `, [job.id]);
      const runDetails = await client.query<{ scenario: string }>(`SELECT "scenario"::text AS scenario FROM "SystemTestRun" WHERE "id" = $1`, [manifest.systemTestRunId]);
      const doubleClaimSafe = runDetails.rows[0]?.scenario !== "DOUBLE_CLAIM" || Number(claimEvents.rows[0]?.count || 0) === 1;
      await client.query(`
        UPDATE "SystemTestRun"
        SET "status" = CASE WHEN "balanceBefore" = $2 AND $3 = 0 AND $6 THEN 'SUCCEEDED'::"SystemTestStatus" ELSE 'FAILED'::"SystemTestStatus" END,
            "balanceAfter" = $2, "billingVerified" = ("balanceBefore" = $2),
            "bytePlusCallVerified" = ($3 = 0), "diagnostics" = $4::jsonb,
            "outputPath" = $5, "completedAt" = NOW(), "updatedAt" = NOW(),
            "errorCode" = CASE WHEN "balanceBefore" <> $2 THEN 'BALANCE_CHANGED' WHEN $3 <> 0 THEN 'BILLING_INVARIANT_FAILED' WHEN NOT $6 THEN 'DOUBLE_CLAIM_DETECTED' ELSE NULL END,
            "errorMessage" = CASE WHEN "balanceBefore" <> $2 OR $3 <> 0 THEN 'Le contrôle de non-facturation a échoué.' WHEN NOT $6 THEN 'Plusieurs prises concurrentes ont été détectées.' ELSE NULL END
        WHERE "id" = $1
      `, [manifest.systemTestRunId, balance.rows[0]?.creditsRemaining ?? -1, Number(billing.rows[0]?.count || 0), JSON.stringify({ ...diagnostics, claimCount: Number(claimEvents.rows[0]?.count || 0) }), job.outputPath, doubleClaimSafe]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function retryDelaySeconds(attemptCount: number) {
  return Math.min(900, 15 * (2 ** Math.max(0, attemptCount - 1)));
}

export async function retryJob(job: MontageJob, code: string, message: string) {
  const delay = retryDelaySeconds(job.attemptCount);
  const result = await pool.query(`
    UPDATE "MontageJob"
    SET "status" = 'RETRYING', "availableAt" = NOW() + ($3 * INTERVAL '1 second'),
        "errorCode" = $4, "errorMessage" = $5, "lockedBy" = NULL,
        "lockedAt" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = $1 AND "lockedBy" = $2
  `, [job.id, config.workerId, delay, code, message]);
  if (result.rowCount !== 1) throw new Error("LEASE_LOST");
  await appendJobEvent(job.id, "RETRYING", job.progress, "Nouvelle tentative planifiée");
}

async function refundReservation(client: pg.PoolClient, reservationId: string) {
  const result = await client.query<{ userId: string; creditsAmount: number; previousStatus: string }>(`
    WITH locked AS (
      SELECT "id", "userId", "creditsAmount", "status"::text AS "previousStatus"
      FROM "CreditTransaction"
      WHERE "id" = $1
      FOR UPDATE
    ), changed AS (
      UPDATE "CreditTransaction" AS credit
      SET "status" = 'REFUNDED', "refundedAt" = NOW(), "updatedAt" = NOW()
      FROM locked
      WHERE credit."id" = locked."id" AND locked."previousStatus" IN ('CONFIRMED', 'RESERVED')
      RETURNING locked."userId", locked."creditsAmount", locked."previousStatus"
    )
    SELECT * FROM changed
  `, [reservationId]);
  const refunded = result.rows[0];
  if (!refunded) return false;
  const amount = Math.abs(refunded.creditsAmount);
  await client.query(`
    UPDATE "User"
    SET "credits" = "credits" + $2, "creditsRemaining" = "creditsRemaining" + $2,
        "creditsUsed" = "creditsUsed" - CASE WHEN $3 = 'CONFIRMED' THEN $2 ELSE 0 END,
        "updatedAt" = NOW()
    WHERE "id" = $1
  `, [refunded.userId, amount, refunded.previousStatus]);
  return true;
}

export async function failAndRefund(job: MontageJob, manifest: MontageManifest, code: string, message: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let refunded = false;
    for (const reservationId of new Set(manifest.creditReservationIds)) {
      refunded = (await refundReservation(client, reservationId)) || refunded;
    }
    const status = refunded || manifest.creditReservationIds.length > 0 ? "REFUNDED" : "FAILED";
    const updated = await client.query(`
      UPDATE "MontageJob"
      SET "status" = $3::"MontageJobStatus", "errorCode" = $4, "errorMessage" = $5,
          "completedAt" = NOW(), "lockedBy" = NULL, "lockedAt" = NULL,
          "leaseExpiresAt" = NULL, "updatedAt" = NOW()
      WHERE "id" = $1 AND "lockedBy" = $2
    `, [job.id, config.workerId, status, code, message]);
    if (updated.rowCount !== 1) throw new Error("LEASE_LOST");
    await client.query(`
      UPDATE "FinalExport" SET "status" = 'FAILED', "errorMessage" = $2, "updatedAt" = NOW()
      WHERE "id" = $1
    `, [job.finalExportId, message]);
    await client.query(`
      INSERT INTO "MontageJobEvent" ("id", "jobId", "status", "progress", "message", "createdAt")
      VALUES (md5(random()::text || clock_timestamp()::text), $1, $2::"MontageJobStatus", 100, 'Test échoué', NOW())
    `, [job.id, status]);
    const systemTestRunId = (job.inputManifest as { systemTestRunId?: string }).systemTestRunId;
    if (systemTestRunId) await client.query(`
      UPDATE "SystemTestRun" SET "status" = 'FAILED', "errorCode" = $2, "errorMessage" = $3,
        "completedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1
    `, [systemTestRunId, code, message]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}

export const CLAIM_CLIP_JOB_SQL = `
  WITH candidate AS (
    SELECT "id" FROM "ClipWorkerJob"
    WHERE "attemptCount" < LEAST("maxAttempts", $3)
      AND ($4::text IS NULL OR "id" = $4)
      AND (
        ("status" IN ('QUEUED', 'RETRYING') AND "availableAt" <= NOW())
        OR ("status" IN ('CLAIMED', 'PREPARING', 'RENDERING', 'UPLOADING') AND "leaseExpiresAt" < NOW())
      )
    ORDER BY "availableAt", "createdAt"
    FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE "ClipWorkerJob" AS job
  SET "status" = 'CLAIMED', "progress" = GREATEST(job."progress", 1),
      "lockedBy" = $1, "lockedAt" = NOW(),
      "leaseExpiresAt" = NOW() + ($2 * INTERVAL '1 second'),
      "attemptCount" = job."attemptCount" + 1, "startedAt" = COALESCE(job."startedAt", NOW()),
      "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = NOW()
  FROM candidate WHERE job."id" = candidate."id" RETURNING job.*
`;

async function appendClipEvent(jobId: string, status: string, progress: number, message: string) {
  await pool.query(`INSERT INTO "ClipWorkerJobEvent" ("id", "jobId", "status", "progress", "message", "createdAt") VALUES (md5(random()::text || clock_timestamp()::text), $1, $2::"ClipWorkerJobStatus", $3, $4, NOW())`, [jobId, status, progress, message]);
}

export async function claimClipJob(jobId?: string): Promise<ClipWorkerJob | null> {
  const result = await pool.query<ClipWorkerJob>(CLAIM_CLIP_JOB_SQL, [config.workerId, config.leaseSeconds, config.maxAttempts, jobId || null]);
  const job = result.rows[0] || null;
  if (job) await appendClipEvent(job.id, "CLAIMED", Math.max(job.progress, 1), "Tâche prise par Railway");
  return job;
}

export async function heartbeatClipJob(jobId: string) {
  const result = await pool.query(`UPDATE "ClipWorkerJob" SET "leaseExpiresAt" = NOW() + ($3 * INTERVAL '1 second'), "updatedAt" = NOW() WHERE "id" = $1 AND "lockedBy" = $2 AND "status" IN ('CLAIMED','PREPARING','RENDERING','UPLOADING')`, [jobId, config.workerId, config.leaseSeconds]);
  if (result.rowCount !== 1) throw new Error("LEASE_LOST");
}

export async function setClipStage(jobId: string, status: "PREPARING" | "RENDERING" | "UPLOADING", progress: number, message: string) {
  const bounded = Math.max(1, Math.min(99, Math.round(progress)));
  const result = await pool.query(`UPDATE "ClipWorkerJob" SET "status" = $3::"ClipWorkerJobStatus", "progress" = $4, "leaseExpiresAt" = NOW() + ($5 * INTERVAL '1 second'), "updatedAt" = NOW() WHERE "id" = $1 AND "lockedBy" = $2`, [jobId, config.workerId, status, bounded, config.leaseSeconds]);
  if (result.rowCount !== 1) throw new Error("LEASE_LOST");
  await appendClipEvent(jobId, status, bounded, message);
}

export async function completeClipJob(job: ClipWorkerJob, manifest: ClipWorkerManifest, outputUrl: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(`UPDATE "ClipWorkerJob" SET "status"='SUCCEEDED', "progress"=100, "completedAt"=NOW(), "lockedBy"=NULL, "lockedAt"=NULL, "leaseExpiresAt"=NULL, "updatedAt"=NOW() WHERE "id"=$1 AND "lockedBy"=$2`, [job.id, config.workerId]);
    if (updated.rowCount !== 1) throw new Error("LEASE_LOST");
    await client.query(`UPDATE "FinalExport" SET "status"='COMPLETED', "storageKey"=$2, "url"=$3, "errorMessage"=NULL, "updatedAt"=NOW() WHERE "id"=$1`, [job.finalExportId, manifest.outputStorageKey, outputUrl]);
    await client.query(`UPDATE "VideoProject" AS project SET "status"='COMPLETED', "actualProviderCostEur"=costs.total, "actualMarginEur"=CASE WHEN project."clientRevenueEur" IS NULL THEN NULL ELSE project."clientRevenueEur"-costs.total END, "updatedAt"=NOW() FROM (SELECT COALESCE(SUM("costEur"),0)::double precision AS total FROM "TokenUsage" WHERE "projectId"=$1) AS costs WHERE project."id"=$1`, [job.projectId]);
    const confirmed = await client.query<{ userId: string; amount: number; description: string; action: string }>(`WITH changed AS (UPDATE "CreditTransaction" SET "status"='CONFIRMED', "confirmedAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1 AND "status"='RESERVED' RETURNING "userId", ABS("creditsAmount")::int AS amount, "description", "action"::text AS action) SELECT * FROM changed`, [manifest.creditReservationId]);
    const row = confirmed.rows[0];
    if (row) {
      await client.query(`UPDATE "User" SET "creditsUsed"="creditsUsed"+$2, "updatedAt"=NOW() WHERE "id"=$1`, [row.userId, row.amount]);
      await client.query(`INSERT INTO "CreditUsage" ("id","userId","amount","reason","metadata","reservationId","createdAt") VALUES (md5(random()::text || clock_timestamp()::text),$1,$2,$3,jsonb_build_object('reservationId',$4::text,'action',$5::text,'provider',$6::text),$4::text,NOW()) ON CONFLICT ("reservationId") DO NOTHING`, [row.userId, row.amount, row.description, manifest.creditReservationId, row.action, config.mockMode ? "railway-mock" : "byteplus-seedance"]);
    }
    await client.query(`INSERT INTO "ClipWorkerJobEvent" ("id","jobId","status","progress","message","createdAt") VALUES (md5(random()::text || clock_timestamp()::text),$1,'SUCCEEDED',100,$2,NOW())`, [job.id, config.mockMode ? "Clip simulé terminé" : "Clip Seedance terminé et validé"]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function retryOrFailClipJob(job: ClipWorkerJob, manifest: ClipWorkerManifest, code: string, message: string) {
  if (job.attemptCount < job.maxAttempts) {
    const delay = retryDelaySeconds(job.attemptCount);
    await pool.query(`UPDATE "ClipWorkerJob" SET "status"='RETRYING', "availableAt"=NOW()+($3*INTERVAL '1 second'), "errorCode"=$4, "errorMessage"=$5, "lockedBy"=NULL, "lockedAt"=NULL, "leaseExpiresAt"=NULL, "updatedAt"=NOW() WHERE "id"=$1 AND "lockedBy"=$2`, [job.id, config.workerId, delay, code, message]);
    await appendClipEvent(job.id, "RETRYING", job.progress, "Nouvelle tentative planifiée");
    return;
  }
  await terminateClipJob(job, manifest, code, message);
}

/**
 * Résultat non conforme : aucune nouvelle tentative n'est utile puisque le
 * rendu ne correspond pas à la commande. La réservation est remboursée
 * immédiatement et le projet redevient un brouillon réutilisable.
 */
export async function failClipValidation(job: ClipWorkerJob, manifest: ClipWorkerManifest, message: string) {
  await terminateClipJob(job, manifest, "FAILED_VALIDATION", message);
  await appendClipEvent(job.id, "REFUNDED", 100, "Résultat non conforme — crédits remboursés");
}

export async function failClipTerminal(job: ClipWorkerJob, manifest: ClipWorkerManifest, code: string, message: string) {
  await terminateClipJob(job, manifest, code, message);
  await appendClipEvent(job.id, "REFUNDED", 100, "Génération interrompue — crédits remboursés");
}

async function terminateClipJob(job: ClipWorkerJob, manifest: ClipWorkerManifest, code: string, message: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const refunded = await refundReservation(client, manifest.creditReservationId);
    await client.query(`UPDATE "ClipWorkerJob" SET "status"=$3::"ClipWorkerJobStatus", "progress"=100, "errorCode"=$4, "errorMessage"=$5, "completedAt"=NOW(), "lockedBy"=NULL, "lockedAt"=NULL, "leaseExpiresAt"=NULL, "updatedAt"=NOW() WHERE "id"=$1 AND "lockedBy"=$2`, [job.id, config.workerId, refunded ? "REFUNDED" : "FAILED", code, message]);
    await client.query(`UPDATE "FinalExport" SET "status"='FAILED', "errorMessage"=$2, "updatedAt"=NOW() WHERE "id"=$1`, [job.finalExportId, message]);
    await client.query(`UPDATE "VideoProject" SET "status"='DRAFT', "creditReservationId"=NULL, "updatedAt"=NOW() WHERE "id"=$1`, [job.projectId]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function expiredSystemTests() {
  const result = await pool.query<{ id: string; projectId: string | null }>(`
    SELECT "id", "projectId" FROM "SystemTestRun"
    WHERE "expiresAt" <= NOW() AND "cleanedAt" IS NULL AND "status" IN ('SUCCEEDED', 'FAILED')
    ORDER BY "expiresAt" ASC LIMIT 20
  `);
  return result.rows;
}

export async function markSystemTestCleaned(runId: string, projectId: string | null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (projectId) await client.query(`DELETE FROM "VideoProject" WHERE "id" = $1 AND "source" = 'SYSTEM_TEST' AND "billingMode" = 'NON_BILLABLE'`, [projectId]);
    await client.query(`
      UPDATE "SystemTestRun" SET "status" = 'CLEANED', "cleanedAt" = NOW(), "projectId" = NULL,
        "outputPath" = NULL, "downloadTokenHash" = NULL, "downloadExpiresAt" = NULL, "updatedAt" = NOW()
      WHERE "id" = $1 AND "cleanedAt" IS NULL
    `, [runId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
