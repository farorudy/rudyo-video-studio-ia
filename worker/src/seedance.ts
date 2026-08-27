import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { config } from "./config.js";

export type SeedanceTask = {
  id: string;
  status?: "queued" | "running" | "cancelled" | "succeeded" | "failed" | "expired";
  content?: { video_url?: string; last_frame_url?: string };
  usage?: { completion_tokens?: number; total_tokens?: number };
  error?: { code?: string; message?: string } | null;
};

export class SeedanceApiError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number, readonly retryable = false) {
    super(message);
    this.name = "SeedanceApiError";
  }
}

async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
  if (!config.arkApiKey) throw new SeedanceApiError("ARK_API_KEY manquante", "PROVIDER_NOT_READY", 503);
  let response: Response;
  try {
    response = await fetch(`${config.bytePlusBaseUrl}${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${config.arkApiKey}`, "Content-Type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new SeedanceApiError("Résultat de soumission inconnu après une coupure réseau", "SUBMISSION_UNKNOWN");
  }
  const payload = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string } };
  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new SeedanceApiError(payload.error?.message || `BytePlus HTTP ${response.status}`, payload.error?.code || `BYTEPLUS_HTTP_${response.status}`, response.status, retryable);
  }
  return payload;
}

export function createSeedanceTask(input: { prompt: string; durationSeconds: number; referenceAssetUri: string }) {
  return request<SeedanceTask>("/contents/generations/tasks", {
    method: "POST",
    body: JSON.stringify({
      model: config.bytePlusVideoModel,
      content: [
        { type: "text", text: input.prompt },
        { type: "image_url", image_url: { url: input.referenceAssetUri }, role: "reference_image" },
      ],
      resolution: "720p",
      ratio: "9:16",
      duration: input.durationSeconds,
      generate_audio: false,
      watermark: false,
      return_last_frame: true,
    }),
  });
}

export function getSeedanceTask(taskId: string) {
  return request<SeedanceTask>(`/contents/generations/tasks/${encodeURIComponent(taskId)}`).catch((error) => {
    if (error instanceof SeedanceApiError && error.code === "SUBMISSION_UNKNOWN") throw new SeedanceApiError("Lecture de tâche BytePlus temporairement impossible", "BYTEPLUS_POLL_FAILED", undefined, true);
    throw error;
  });
}

function assertRemoteVideoUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) throw new SeedanceApiError("URL vidéo fournisseur invalide", "PROVIDER_VIDEO_URL_INVALID");
  return url.toString();
}

export async function downloadSeedanceVideo(sourceUrl: string, target: string) {
  const response = await fetch(assertRemoteVideoUrl(sourceUrl), { signal: AbortSignal.timeout(180_000), redirect: "follow" });
  if (!response.ok || !response.body) throw new SeedanceApiError("Téléchargement du résultat BytePlus impossible", "PROVIDER_VIDEO_DOWNLOAD_FAILED", response.status, response.status >= 500);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > config.maxInputBytes) throw new SeedanceApiError("Vidéo fournisseur trop volumineuse", "PROVIDER_VIDEO_TOO_LARGE");
  let bytes = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) {
    bytes += Buffer.byteLength(chunk);
    callback(bytes > config.maxInputBytes ? new SeedanceApiError("Vidéo fournisseur trop volumineuse", "PROVIDER_VIDEO_TOO_LARGE") : null, chunk);
  } });
  await pipeline(Readable.fromWeb(response.body as never), limiter, createWriteStream(target, { mode: 0o600 }));
  return bytes;
}
