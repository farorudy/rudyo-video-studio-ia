import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { canStartPaidGeneration, mockBillingAllowed, isProductionRuntime, type WorkerHealth } from "../lib/montage/paid-generation-gate";

const root = path.resolve(import.meta.dirname, "..");

const healthy: WorkerHealth = {
  reachable: true, mode: "seedance", providerReady: true,
  ffmpegReady: true, databaseReady: true, storageReady: true,
};

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
const PROD = env({ VERCEL_ENV: "production" });
const PREVIEW = env({ VERCEL_ENV: "preview", ALLOW_MOCK_BILLING: "true" });

test("un worker en mode mock ne peut jamais facturer en production", () => {
  const result = canStartPaidGeneration({ ...healthy, mode: "mock", providerReady: false }, PROD);
  assert.equal(result.allowed, false);
  assert.equal(result.allowed === false && result.refusal, "WORKER_IN_MOCK_MODE");
});

test("ALLOW_MOCK_BILLING est ignoré en production", () => {
  const forced = env({ VERCEL_ENV: "production", ALLOW_MOCK_BILLING: "true" });
  assert.equal(mockBillingAllowed(forced), false);
  assert.equal(isProductionRuntime(forced), true);
  assert.equal(canStartPaidGeneration({ ...healthy, mode: "mock" }, forced).allowed, false);
});

test("en Preview, un worker mock peut facturer des crédits factices", () => {
  assert.equal(mockBillingAllowed(PREVIEW), true);
  assert.equal(canStartPaidGeneration({ ...healthy, mode: "mock", providerReady: false }, PREVIEW).allowed, true);
});

test("un worker injoignable ne permet aucun débit", () => {
  const result = canStartPaidGeneration({ ...healthy, reachable: false }, PROD);
  assert.equal(result.allowed, false);
  assert.equal(result.allowed === false && result.refusal, "WORKER_UNREACHABLE");
});

test("workerAvailable ne suffit pas : chaque dépendance est exigée", () => {
  for (const [field, refusal] of [
    ["providerReady", "PROVIDER_NOT_READY"],
    ["ffmpegReady", "FFMPEG_NOT_READY"],
    ["databaseReady", "DATABASE_NOT_READY"],
    ["storageReady", "STORAGE_NOT_READY"],
  ] as const) {
    const result = canStartPaidGeneration({ ...healthy, [field]: false }, PROD);
    assert.equal(result.allowed, false, `${field} ignoré`);
    assert.equal(result.allowed === false && result.refusal, refusal);
  }
});

test("un worker Seedance complet autorise la facturation", () => {
  assert.equal(canStartPaidGeneration(healthy, PROD).allowed, true);
});

test("une santé absente ou inconnue est un refus, jamais une autorisation", () => {
  assert.equal(canStartPaidGeneration(null, PROD).allowed, false);
  assert.equal(canStartPaidGeneration(undefined, PROD).allowed, false);
  assert.equal(canStartPaidGeneration({}, PROD).allowed, false);
  assert.equal(canStartPaidGeneration({ reachable: true, mode: null } as Partial<WorkerHealth>, PROD).allowed, false);
});

test("la réservation de crédits est gardée avant tout débit", async () => {
  const source = await readFile(path.join(root, "lib", "simple-clip-production.ts"), "utf8");
  const gateIndex = source.indexOf("paidGenerationAllowed");
  const reserveIndex = source.indexOf("reserveCredits({");
  assert.ok(gateIndex > 0, "la garde de facturation est absente");
  assert.ok(reserveIndex > 0, "la réservation est introuvable");
  assert.ok(gateIndex < reserveIndex, "la garde doit précéder la réservation de crédits");
});

test("la route de création refuse en 503 sans débit", async () => {
  const source = await readFile(path.join(root, "app", "api", "simple-clips", "route.ts"), "utf8");
  assert.match(source, /paidGenerationAllowed/);
  assert.match(source, /PAID_GENERATION_UNAVAILABLE_MESSAGE/);
  assert.match(source, /status:\s*503/);
});

test("le worker refuse de livrer un rendu dont la durée ne correspond pas", async () => {
  const source = await readFile(path.join(root, "worker", "src", "clip-processor.ts"), "utf8");
  assert.match(source, /MAX_DURATION_DRIFT_SECONDS = 2/);
  assert.match(source, /ClipValidationError/);
  // La vérification doit précéder la finalisation de la tâche.
  assert.ok(source.indexOf("MAX_DURATION_DRIFT_SECONDS") < source.indexOf("completeClipJob(job"));
});

test("une non-conformité est terminale et remboursée, sans réessai", async () => {
  const source = await readFile(path.join(root, "worker", "src", "db.ts"), "utf8");
  assert.match(source, /export async function failClipValidation/);
  assert.match(source, /FAILED_VALIDATION/);
  assert.match(source, /Résultat non conforme — crédits remboursés/);
});

test("le health du worker expose un mode explicite et non devinable", async () => {
  const source = await readFile(path.join(root, "worker", "src", "server.ts"), "utf8");
  assert.match(source, /mode:\s*"mock"\s*\|\s*"seedance"/);
  assert.match(source, /providerReady/);
  assert.match(source, /ffmpegReady/);
  assert.match(source, /databaseReady/);
});
