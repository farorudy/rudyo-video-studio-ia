import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (...parts: string[]) => readFile(path.join(root, ...parts), "utf8");

test("le scénario complet existe et est validé avant le verrou puis la réservation", async () => {
  const [route, production] = await Promise.all([source("app", "api", "simple-clips", "route.ts"), source("lib", "simple-clip-production.ts")]);
  assert.ok(route.indexOf("storyboardScene.createMany") < route.indexOf("createScenarioVersionFromLegacyProject(project.id"));
  assert.doesNotMatch(route, /const started = await startPreparedSimpleClip/);
  assert.ok(production.indexOf("SCENARIO_VALIDATION_REQUIRED") < production.indexOf("getMontageServiceStatus()"));
  assert.ok(production.indexOf("validateClipScenario(project.scenes") < production.indexOf("getMontageServiceStatus()"));
  assert.ok(production.indexOf("getMontageServiceStatus()") < production.indexOf("reserveCredits({"));
  assert.match(production, /scenes: project\.scenes\.map/);
});

test("la voie vidéo réelle appelle uniquement l’API Seedance exacte", async () => {
  const [provider, processor] = await Promise.all([source("worker", "src", "seedance.ts"), source("worker", "src", "clip-processor.ts")]);
  assert.match(provider, /contents\/generations\/tasks/);
  assert.match(provider, /config\.bytePlusVideoModel/);
  assert.doesNotMatch(`${provider}\n${processor}`, /openai|anthropic|mistral/i);
  assert.match(processor, /SEEDANCE_SUBMISSION_UNKNOWN/);
  assert.match(processor, /seedanceConcurrency/);
  assert.match(processor, /renderMontage/);
});

test("chaque scène fournisseur possède une clé d’idempotence persistée", async () => {
  const database = await source("worker", "src", "db.ts");
  assert.match(database, /clip-worker:\$\{job\.id\}:scene:\$\{scene\.id\}/);
  assert.match(database, /ON CONFLICT \("idempotencyKey"\) DO NOTHING/);
  assert.match(database, /SUBMISSION_UNKNOWN/);
  assert.match(database, /ON CONFLICT \("taskId"\)/);
});

test("un vrai visage exige un actif privé BytePlus autorisé", async () => {
  const [production, health] = await Promise.all([source("lib", "simple-clip-production.ts"), source("worker", "src", "server.ts")]);
  assert.match(production, /BYTEPLUS_REFERENCE_ASSET_REQUIRED/);
  assert.match(production, /asset:\/\//);
  assert.match(health, /bytePlusAssetLibraryReady/);
});

test("le téléchargement MP4 gère les plages et conserve l’autorisation", async () => {
  const route = await source("app", "api", "assets", "[id]", "download", "route.ts");
  assert.match(route, /verifyDownloadSignature/);
  assert.match(route, /parseSingleByteRange/);
  assert.match(route, /"Accept-Ranges": "bytes"/);
  assert.match(route, /"Content-Range"/);
  assert.match(route, /status: range \? 206 : 200/);
});
