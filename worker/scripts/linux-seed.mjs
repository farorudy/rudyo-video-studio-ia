// Amorce un job de clip mock dans la base conteneurisée, depuis l'image worker.
import { randomUUID } from "node:crypto";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const userId = "linux-validation-user";
const projectId = process.argv[2] || randomUUID();
const finalExportId = randomUUID();
const jobId = randomUUID();
const outputStorageKey = `users/${userId}/projects/${projectId}/final/clip.mp4`;

await client.query(
  `INSERT INTO "User" (id, email, name, "creditsRemaining", "creditsTotal", "updatedAt")
   VALUES ($1, $2, $3, 10000, 10000, now())
   ON CONFLICT (id) DO UPDATE SET "creditsRemaining" = 10000`,
  [userId, "linux-validation@rudyo.test", "Validation Linux"],
);

await client.query(
  `INSERT INTO "VideoProject" (id, "userId", title, "artistName", "durationSeconds", "billedDurationSeconds", status, "clipPlan", "updatedAt")
   VALUES ($1, $2, 'Validation conteneur Linux', 'Artiste synthetique', 15, 15, 'GENERATING', 'TIKTOK', now())`,
  [projectId, userId],
);

await client.query(
  `INSERT INTO "FinalExport" (id, "projectId", format, resolution, status, "updatedAt")
   VALUES ($1, $2, '9:16', '1080p', 'QUEUED', now())`,
  [finalExportId, projectId],
);

const manifest = {
  version: 1,
  jobId,
  userId,
  projectId,
  finalExportId,
  photoStorageKey: "linux-fixtures/portrait.png",
  audioStorageKey: "linux-fixtures/music.wav",
  audioStartSeconds: 0,
  durationSeconds: 15,
  outputStorageKey,
  plan: "TIKTOK",
  creditReservationId: randomUUID(),
};

await client.query(
  `INSERT INTO "ClipWorkerJob" (id, "userId", "projectId", "finalExportId", status, progress, "inputManifest", "outputPath", "idempotencyKey", "availableAt", "updatedAt")
   VALUES ($1, $2, $3, $4, 'QUEUED', 0, $5, $6, $7, now(), now())`,
  [jobId, userId, projectId, finalExportId, JSON.stringify(manifest), outputStorageKey, `clip-worker:${projectId}`],
);

console.log(JSON.stringify({ jobId, projectId, outputStorageKey }));
await client.end();
