import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
process.env.BLOB_READ_WRITE_TOKEN ||= "test_blob_token";
process.env.MONTAGE_WORKER_SECRET ||= "0123456789abcdef0123456789abcdef";

test("the claim is atomic and safe for concurrent workers", async () => {
  const { CLAIM_CLIP_JOB_SQL, CLAIM_JOB_SQL } = await import("../src/db.js");
  assert.match(CLAIM_JOB_SQL, /FOR UPDATE SKIP LOCKED/);
  assert.match(CLAIM_JOB_SQL, /UPDATE "MontageJob"/);
  assert.match(CLAIM_JOB_SQL, /"leaseExpiresAt" < NOW\(\)/);
  assert.match(CLAIM_JOB_SQL, /"attemptCount" < LEAST\("maxAttempts", \$3\)/);
  assert.match(CLAIM_CLIP_JOB_SQL, /FOR UPDATE SKIP LOCKED/);
  assert.match(CLAIM_CLIP_JOB_SQL, /UPDATE "ClipWorkerJob"/);
});

test("POST /jobs exige une signature HMAC récente et refuse le rejeu", async () => {
  const { signRequest, verifySignedRequest } = await import("../src/server.js");
  const now = 1_800_000_000;
  const timestamp = String(now);
  const nonce = "12345678-1234-4234-8234-123456789abc";
  const body = JSON.stringify({ jobId: "12345678-1234-4234-8234-123456789abc", idempotencyKey: "clip-worker:12345678-1234-4234-8234-123456789abc" });
  const headers = { "x-rudyo-timestamp": timestamp, "x-rudyo-nonce": nonce, "x-rudyo-signature": signRequest(body, timestamp, nonce) };
  assert.equal(verifySignedRequest(headers, body, now).ok, true);
  assert.equal(verifySignedRequest(headers, body, now).code, "REPLAY_DETECTED");
  assert.equal(verifySignedRequest({ ...headers, "x-rudyo-nonce": "22345678-1234-4234-8234-123456789abc" }, body, now).code, "SIGNATURE_INVALID");
  assert.equal(verifySignedRequest({ ...headers, "x-rudyo-nonce": "32345678-1234-4234-8234-123456789abc", "x-rudyo-timestamp": String(now - 301) }, body, now).code, "TIMESTAMP_INVALID");
});

test("retry backoff is bounded and exponential", async () => {
  const { retryDelaySeconds } = await import("../src/db.js");
  assert.deepEqual([1, 2, 3, 4].map(retryDelaySeconds), [15, 30, 60, 120]);
  assert.equal(retryDelaySeconds(20), 900);
});

test("storage paths cannot escape the private prefix", async () => {
  const { normalizeStorageKey } = await import("../src/storage.js");
  assert.equal(normalizeStorageKey("users/u/projects/p/video.mp4"), "users/u/projects/p/video.mp4");
  for (const invalid of ["../secret", "users/../secret", "/", "users//secret", "users/./secret"]) {
    assert.throws(() => normalizeStorageKey(invalid), /STORAGE_KEY_INVALID/);
  }
});

test("manifest rejects unknown fields and contains storage keys, never credentials", async () => {
  const { montageManifestSchema } = await import("../src/types.js");
  const manifest = {
    version: 1, jobId: "job", userId: "user", projectId: "project", finalExportId: "export", generationId: "generation", expectedDurationSeconds: 2,
    scenes: [{ order: 0, storageKey: "users/user/scene.mp4", durationSeconds: 2 }],
    audio: { storageKey: "users/user/music.wav" },
    output: { storageKey: "users/user/final.mp4", format: "16:9", resolution: "720p", transition: "cut", subtitles: false },
    creditReservationIds: [],
  };
  assert.equal(montageManifestSchema.parse(manifest).audio.storageKey, "users/user/music.wav");
  assert.equal(JSON.stringify(manifest).includes("BLOB_READ_WRITE_TOKEN"), false);
});

test("manifest accepts a complete seven-minute clip and rejects longer audio", async () => {
  const { montageManifestSchema } = await import("../src/types.js");
  const manifest = {
    version: 1, jobId: "job-420", userId: "user", projectId: "project", finalExportId: "export", generationId: "generation", expectedDurationSeconds: 420,
    scenes: Array.from({ length: 42 }, (_, order) => ({ order, storageKey: `users/user/scene-${order}.mp4`, durationSeconds: 10 })),
    audio: { storageKey: "users/user/music.wav", durationSeconds: 420 },
    output: { storageKey: "users/user/final.mp4", format: "9:16", resolution: "1080p", transition: "cut", subtitles: false },
    creditReservationIds: [],
  };
  assert.equal(montageManifestSchema.parse(manifest).audio.durationSeconds, 420);
  assert.throws(() => montageManifestSchema.parse({ ...manifest, audio: { ...manifest.audio, durationSeconds: 421 } }));
});

test("le manifeste clip 240 s impose 24 scènes de 10 s avec le modèle exact", async () => {
  const { clipWorkerManifestSchema } = await import("../src/types.js");
  const manifest = {
    version: 1,
    jobId: "12345678-1234-4234-8234-123456789abc",
    userId: "user",
    projectId: "project",
    finalExportId: "22345678-1234-4234-8234-123456789abc",
    photoStorageKey: "users/user/photo.jpg",
    audioStorageKey: "users/user/music.mp3",
    audioStartSeconds: 0,
    durationSeconds: 240,
    referenceAssetUri: "asset://authorized-person-1",
    scenes: Array.from({ length: 24 }, (_, order) => ({ id: `scene-${order}`, order, title: `Plan ${order + 1}`, prompt: "Portrait cinématographique cohérent de l’artiste en mouvement naturel.", durationSeconds: 10, modelId: "dreamina-seedance-2-0-260128", resolution: "720p", ratio: "9:16" })),
    outputStorageKey: "users/user/final.mp4",
    plan: "LONG",
    creditReservationId: "reservation",
  };
  assert.equal(clipWorkerManifestSchema.parse(manifest).scenes.length, 24);
  assert.throws(() => clipWorkerManifestSchema.parse({ ...manifest, scenes: manifest.scenes.map((scene, index) => index === 0 ? { ...scene, modelId: "another-model" } : scene) }));
});

test("heartbeat, verification and cleanup use the production worker path", async () => {
  const [database, processor, cleanup] = await Promise.all([
    readFile(path.join(process.cwd(), "src", "db.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src", "processor.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src", "cleanup.ts"), "utf8"),
  ]);
  assert.match(database, /INSERT INTO "WorkerHeartbeat"/);
  assert.match(database, /"balanceBefore" = \$2/);
  assert.match(database, /"provider" <> 'TEST_FIXTURE'/);
  assert.match(processor, /finally[\s\S]*rm\(directory, \{ recursive: true, force: true \}\)/);
  assert.match(cleanup, /deleteSystemTestPrefix/);
});

test("Railway utilise une liveness séparée de la readiness fournisseur", async () => {
  const [server, railway] = await Promise.all([
    readFile(path.join(process.cwd(), "src", "server.ts"), "utf8"),
    readFile(path.join(process.cwd(), "..", "railway.toml"), "utf8"),
  ]);
  assert.match(server, /request\.url === "\/health\/live"/);
  assert.match(server, /json\(response, 200, \{ status: "ok", ok: true \}\)/);
  assert.match(railway, /healthcheckPath = "\/health\/live"/);
});
