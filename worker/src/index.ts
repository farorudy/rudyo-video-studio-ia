import { mkdir, readdir, rm, stat, statfs } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { checkDatabase, claimClipJob, claimJob, closeDatabase, publishWorkerHeartbeat } from "./db.js";
import { processClaimedJob } from "./processor.js";
import { processClaimedClipJob } from "./clip-processor.js";
import { startHealthServer } from "./server.js";
import { checkFfmpeg } from "./media.js";
import { checkStorage } from "./storage.js";
import { cleanupExpiredSystemTests } from "./cleanup.js";

let stopping = false;
const activeJobs = new Set<string>();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanupStaleDirectories() {
  await mkdir(config.tempDir, { recursive: true, mode: 0o700 });
  const entries = await readdir(config.tempDir, { withFileTypes: true });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("job-")) continue;
    const target = path.resolve(config.tempDir, entry.name);
    if (!target.startsWith(`${config.tempDir}${path.sep}`)) continue;
    const details = await stat(target);
    if (details.mtimeMs < cutoff) await rm(target, { recursive: true, force: true });
  }
}

async function workerLoop(slot: number) {
  while (!stopping) {
    try {
      const clipJob = await claimClipJob();
      if (clipJob) {
        console.log(JSON.stringify({ event: "clip_claimed", jobId: clipJob.id, attempt: clipJob.attemptCount, slot }));
        activeJobs.add(clipJob.id);
        try { await processClaimedClipJob(clipJob); } finally { activeJobs.delete(clipJob.id); }
        continue;
      }
      const job = await claimJob();
      if (!job) {
        await wait(config.pollIntervalMs);
        continue;
      }
      console.log(JSON.stringify({ event: "montage_claimed", jobId: job.id, attempt: job.attemptCount, slot }));
      activeJobs.add(job.id);
      try {
        await processClaimedJob(job);
      } finally {
        activeJobs.delete(job.id);
      }
    } catch (error) {
      console.error(JSON.stringify({ event: "worker_loop_error", slot, message: error instanceof Error ? error.message.split("\n", 1)[0] : "unknown" }));
      await wait(config.pollIntervalMs);
    }
  }
}

async function signalWorker(status: "ONLINE" | "DEGRADED" | "STOPPING" = "ONLINE") {
  let ffmpegAvailable = false;
  let databaseAvailable = false;
  let storageAvailable = false;
  let errorCode: string | null = null;
  const checks = await Promise.allSettled([checkFfmpeg(), checkDatabase(), checkStorage()]);
  ffmpegAvailable = checks[0].status === "fulfilled";
  databaseAvailable = checks[1].status === "fulfilled";
  storageAvailable = checks[2].status === "fulfilled";
  if (!ffmpegAvailable) errorCode = "FFMPEG_UNAVAILABLE";
  else if (!databaseAvailable) errorCode = "DATABASE_UNAVAILABLE";
  else if (!storageAvailable) errorCode = "STORAGE_UNAVAILABLE";
  const filesystem = await statfs(config.tempDir).catch(() => null);
  const actualStatus = status === "STOPPING" ? status : errorCode ? "DEGRADED" : "ONLINE";
  if (databaseAvailable) {
    await publishWorkerHeartbeat({
      status: actualStatus,
      currentJobId: activeJobs.values().next().value || null,
      ffmpegAvailable,
      databaseAvailable,
      storageAvailable,
      tempAvailableBytes: filesystem ? BigInt(filesystem.bavail) * BigInt(filesystem.bsize) : null,
      errorCode,
    });
  }
}

await cleanupStaleDirectories();
async function wakeClipJob(jobId: string) {
  if (stopping || activeJobs.has(jobId)) return;
  const job = await claimClipJob(jobId).catch(() => null);
  if (!job) return;
  activeJobs.add(job.id);
  try { await processClaimedClipJob(job); } finally { activeJobs.delete(job.id); }
}

const server = startHealthServer((jobId) => { void wakeClipJob(jobId); });
await signalWorker().catch((error) => console.error("worker_signal_failed", error));
await cleanupExpiredSystemTests().catch((error) => console.error("system_test_cleanup_failed", error));
const signalTimer = setInterval(() => { void signalWorker().catch((error) => console.error("worker_signal_failed", error)); }, config.signalSeconds * 1000);
signalTimer.unref();
const cleanupTimer = setInterval(() => { void cleanupExpiredSystemTests().catch((error) => console.error("system_test_cleanup_failed", error)); }, 10 * 60_000);
cleanupTimer.unref();
const loops = Array.from({ length: config.concurrency }, (_, index) => workerLoop(index + 1));

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(signalTimer);
  clearInterval(cleanupTimer);
  await signalWorker("STOPPING").catch(() => undefined);
  server.close();
  await Promise.race([Promise.allSettled(loops), wait(30_000)]);
  await closeDatabase();
  process.exit(0);
}

process.once("SIGTERM", () => { void shutdown(); });
process.once("SIGINT", () => { void shutdown(); });
await Promise.all(loops);
