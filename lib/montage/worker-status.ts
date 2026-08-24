import "server-only";

import { WorkerHealthStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRailwayWorkerHealth } from "@/lib/montage/worker-client";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getMontageServiceStatus() {
  const offlineSeconds = positiveInteger(process.env.MONTAGE_WORKER_OFFLINE_SECONDS, 90);
  const cutoff = new Date(Date.now() - offlineSeconds * 1000);
  const [workers, pendingJobs, railway] = await Promise.all([
    prisma.workerHeartbeat.findMany({ orderBy: { lastSeenAt: "desc" }, take: 20 }),
    prisma.montageJob.count({ where: { status: { in: ["QUEUED", "RETRYING"] } } }),
    checkRailwayWorkerHealth(),
  ]);
  const recent = workers.filter((worker) => worker.lastSeenAt >= cutoff);
  const healthy = recent.find((worker) => worker.status === WorkerHealthStatus.ONLINE && worker.ffmpegAvailable && worker.databaseAvailable && worker.storageAvailable);
  const latest = workers[0] || null;
  const configuredHealthy = railway.reachable || Boolean(healthy);
  const state = configuredHealthy ? "ONLINE" : railway.configured ? "STARTING" : recent.length > 0 ? "DEGRADED" : "OFFLINE";
  return {
    // Un service Railway Serverless configuré peut dormir : le premier POST /jobs le réveille.
    available: configuredHealthy || railway.configured,
    state,
    waking: railway.waking,
    configured: railway.configured,
    pendingJobs,
    latest: latest ? {
      id: latest.id,
      version: latest.version,
      status: latest.status,
      lastSeenAt: latest.lastSeenAt.toISOString(),
      currentJobId: latest.currentJobId,
      ffmpegAvailable: latest.ffmpegAvailable,
      databaseAvailable: latest.databaseAvailable,
      storageAvailable: latest.storageAvailable,
      tempAvailableBytes: latest.tempAvailableBytes === null ? null : Number(latest.tempAvailableBytes),
      startedAt: latest.startedAt.toISOString(),
      errorCode: latest.errorCode,
    } : null,
  };
}
