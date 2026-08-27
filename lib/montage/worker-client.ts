import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import type { WorkerHealth } from "@/lib/montage/paid-generation-gate";

const REQUEST_TIMEOUT_MS = 5_000;

function workerConfig() {
  const url = process.env.MONTAGE_WORKER_URL?.trim().replace(/\/$/, "");
  const secret = process.env.MONTAGE_WORKER_SECRET?.trim();
  return { url, secret, configured: Boolean(url && secret && secret.length >= 32) };
}

export function signWorkerRequest(body: string, timestamp: string, nonce: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

async function request(pathname: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const { url, secret, configured } = workerConfig();
  if (!configured || !url || !secret) throw new Error("WORKER_NOT_CONFIGURED");
  const body = typeof init.body === "string" ? init.body : "";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const signature = signWorkerRequest(body, timestamp, nonce, secret);
  return fetch(`${url}${pathname}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "Content-Type": "application/json",
      "X-Rudyo-Timestamp": timestamp,
      "X-Rudyo-Nonce": nonce,
      "X-Rudyo-Signature": signature,
      ...init.headers,
    },
  });
}

const UNREADY: WorkerHealth = { reachable: false, mode: null, providerReady: false, ffmpegReady: false, databaseReady: false, storageReady: false };

/**
 * Le corps de /health est lu et rapporté tel quel. Un worker joignable ne
 * suffit pas : c'est `mode` et les indicateurs de disponibilité qui décident
 * ensuite d'un débit, via canStartPaidGeneration().
 */
export async function checkRailwayWorkerHealth(): Promise<{ configured: boolean; reachable: boolean; waking: boolean; health: WorkerHealth }> {
  const { configured } = workerConfig();
  if (!configured) return { configured: false, reachable: false, waking: false, health: UNREADY };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await request("/health", { method: "GET" }, attempt === 0 ? 3_500 : 5_000);
      if (response.ok) {
        const body = await response.json().catch(() => ({})) as Partial<WorkerHealth> & { mode?: string };
        const health: WorkerHealth = {
          reachable: true,
          mode: body.mode === "seedance" ? "seedance" : body.mode === "mock" ? "mock" : null,
          providerReady: body.providerReady === true,
          ffmpegReady: body.ffmpegReady === true,
          databaseReady: body.databaseReady === true,
          storageReady: body.storageReady === true,
        };
        return { configured: true, reachable: true, waking: false, health };
      }
    } catch {
      // Railway Serverless peut nécessiter un premier appel de réveil.
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return { configured: true, reachable: false, waking: true, health: UNREADY };
}

export async function dispatchRailwayClipJob(jobId: string) {
  const body = JSON.stringify({ jobId, idempotencyKey: `clip-worker:${jobId}` });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await request("/jobs", { method: "POST", body, headers: { "Idempotency-Key": `clip-worker:${jobId}` } }, attempt === 0 ? 5_000 : 8_000);
      if (response.ok || response.status === 409) return { accepted: true, waking: attempt > 0 };
      lastError = new Error(`WORKER_HTTP_${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  console.error(JSON.stringify({ event: "railway_worker_dispatch_failed", jobId, code: lastError instanceof Error ? lastError.message.slice(0, 80) : "UNKNOWN" }));
  return { accepted: false, waking: true };
}
