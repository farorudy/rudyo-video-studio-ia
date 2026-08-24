import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { checkDatabase } from "./db.js";
import { checkFfmpeg } from "./media.js";
import { checkStorage } from "./storage.js";
import { config } from "./config.js";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 300;
const replayCache = new Map<string, number>();
const requestCounters = new Map<string, { count: number; resetAt: number }>();

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signRequest(body: string, timestamp: string, nonce: string, secret = config.workerSecret) {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

export function verifySignedRequest(headers: Record<string, string | string[] | undefined>, body: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const timestamp = String(headers["x-rudyo-timestamp"] || "");
  const nonce = String(headers["x-rudyo-nonce"] || "");
  const signature = String(headers["x-rudyo-signature"] || "");
  const parsedTimestamp = Number(timestamp);
  if (!Number.isInteger(parsedTimestamp) || Math.abs(nowSeconds - parsedTimestamp) > MAX_CLOCK_SKEW_SECONDS) return { ok: false as const, code: "TIMESTAMP_INVALID" };
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(nonce)) return { ok: false as const, code: "NONCE_INVALID" };
  const seenUntil = replayCache.get(nonce);
  if (seenUntil && seenUntil > nowSeconds) return { ok: false as const, code: "REPLAY_DETECTED" };
  const expected = signRequest(body, timestamp, nonce);
  if (!/^[a-f0-9]{64}$/.test(signature) || !safeEqual(signature, expected)) return { ok: false as const, code: "SIGNATURE_INVALID" };
  replayCache.set(nonce, nowSeconds + MAX_CLOCK_SKEW_SECONDS);
  for (const [key, expiresAt] of replayCache) if (expiresAt <= nowSeconds) replayCache.delete(key);
  return { ok: true as const };
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    bytes += value.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function rateAllowed(address: string) {
  const now = Date.now();
  const current = requestCounters.get(address);
  if (!current || current.resetAt <= now) { requestCounters.set(address, { count: 1, resetAt: now + 60_000 }); return true; }
  current.count += 1;
  return current.count <= 30;
}

function json(response: import("node:http").ServerResponse, status: number, value: object) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}

export function startHealthServer(onJob: (jobId: string) => void) {
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const checks = { ffmpeg: false, database: false, storage: false };
      await Promise.all([
        checkFfmpeg().then(() => { checks.ffmpeg = true; }).catch(() => undefined),
        checkDatabase().then(() => { checks.database = true; }).catch(() => undefined),
        checkStorage().then(() => { checks.storage = true; }).catch(() => undefined),
      ]);
      const ok = Object.values(checks).every(Boolean);
      json(response, ok ? 200 : 503, { ok, mode: config.mockMode ? "mock" : "byteplus", region: process.env.RAILWAY_REPLICA_REGION || "unknown" });
      return;
    }
    if (request.method !== "POST" || request.url !== "/jobs") { json(response, 404, { ok: false }); return; }
    const address = request.socket.remoteAddress || "unknown";
    if (!rateAllowed(address)) { json(response, 429, { ok: false, code: "RATE_LIMITED" }); return; }
    try {
      const body = await readBody(request);
      const verified = verifySignedRequest(request.headers, body);
      if (!verified.ok) { json(response, 401, { ok: false, code: verified.code }); return; }
      const parsed = JSON.parse(body) as { jobId?: unknown; idempotencyKey?: unknown };
      if (typeof parsed.jobId !== "string" || !/^[a-f0-9-]{36}$/i.test(parsed.jobId) || parsed.idempotencyKey !== `clip-worker:${parsed.jobId}` || request.headers["idempotency-key"] !== parsed.idempotencyKey) {
        json(response, 400, { ok: false, code: "JOB_INVALID" }); return;
      }
      json(response, 202, { ok: true, jobId: parsed.jobId });
      onJob(parsed.jobId);
    } catch (error) {
      json(response, error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400, { ok: false, code: "REQUEST_INVALID" });
    }
  });
  server.listen(config.port, "0.0.0.0", () => console.log(JSON.stringify({ event: "health_server_ready", port: config.port, mockMode: config.mockMode })));
  return server;
}
