import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { createAdminSessionToken, getAdminCsrfToken, getAdminSubject, hasStrictSameOrigin, verifyAdminCsrfToken } from "@/lib/admin-auth";
import { getSimpleClipAuthorization } from "@/lib/simple-clip";
import { createSyntheticMontageFixtures } from "@/lib/system-tests/fixtures";

process.env.ADMIN_EMAILS = "admin@example.com";
process.env.ADMIN_SESSION_SECRET = "0123456789abcdef0123456789abcdef";

test("20 crédits ne peuvent jamais autoriser un clip facturé 300 crédits", () => {
  const result = getSimpleClipAuthorization(300, 20, true);
  assert.equal(result.allowed, false);
  assert.equal(result.missingCredits, 280);
  assert.equal(result.balanceAfter, 0);
  assert.equal(result.refusalCode, "INSUFFICIENT_CREDITS");
});

test("le bouton public conserve le brouillon et propose uniquement le manque", async () => {
  const [component, route] = await Promise.all([
    readFile(path.join(process.cwd(), "app", "components", "SimpleClipCreator.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "app", "api", "simple-clips", "route.ts"), "utf8"),
  ]);
  assert.match(component, /quote\.refusalCode !== "INSUFFICIENT_CREDITS"/);
  assert.match(component, /Acheter.*quote\.missingCredits/);
  assert.ok(route.indexOf("prisma.videoProject.create") < route.indexOf('parsed.intent === "prepare_only"'));
  assert.ok(route.indexOf('parsed.intent === "prepare_only"') < route.indexOf("await startPreparedSimpleClip"));
  assert.ok(route.indexOf("WORKER_UNAVAILABLE") < route.indexOf("const form = await readFormDataWithLimit"));
});

test("une génération payante est refusée quand le worker est hors ligne", () => {
  const result = getSimpleClipAuthorization(10, 100, false);
  assert.equal(result.allowed, false);
  assert.equal(result.refusalCode, "WORKER_UNAVAILABLE");
});

test("le lancement administrateur exige origine stricte et jeton CSRF lié à la session", () => {
  const identity = { email: "admin@example.com", subject: getAdminSubject("admin@example.com") };
  const session = createAdminSessionToken(identity);
  const initial = new NextRequest("https://rudyo.example/api/admin/system-tests", { headers: { cookie: `rudyo_admin_session=${session}`, origin: "https://rudyo.example" } });
  const csrf = getAdminCsrfToken(initial);
  assert.ok(csrf);
  const valid = new NextRequest("https://rudyo.example/api/admin/system-tests", { headers: { cookie: `rudyo_admin_session=${session}`, origin: "https://rudyo.example", "sec-fetch-site": "same-origin", "x-csrf-token": csrf! } });
  const forged = new NextRequest("https://rudyo.example/api/admin/system-tests", { headers: { cookie: `rudyo_admin_session=${session}`, origin: "https://evil.example", "x-csrf-token": csrf! } });
  assert.equal(hasStrictSameOrigin(valid), true);
  assert.equal(verifyAdminCsrfToken(valid), true);
  assert.equal(hasStrictSameOrigin(forged), false);
});

test("les fixtures sont synthétiques, courtes et de formats fixes", { timeout: 60_000 }, async () => {
  const fixtures = await createSyntheticMontageFixtures();
  assert.equal(fixtures.videos.length, 3);
  assert.equal(fixtures.image.buffer.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(fixtures.audio.buffer.subarray(0, 4).toString("ascii"), "RIFF");
  for (const video of fixtures.videos) {
    assert.equal(video.mimeType, "video/mp4");
    assert.ok(video.buffer.includes(Buffer.from("ftyp")));
  }
});

test("le parcours système n’importe ni Seedance ni les fonctions de facturation", async () => {
  const source = await readFile(path.join(process.cwd(), "lib", "system-tests", "service.ts"), "utf8");
  assert.doesNotMatch(source, /seedance\/client|startSceneGeneration|reserveCredits|confirmCreditUsage/);
  assert.match(source, /provider:\s*"TEST_FIXTURE"/);
  assert.match(source, /billingMode:\s*"NON_BILLABLE"/);
});

test("la route publique de téléchargement interdit explicitement les projets système", async () => {
  const source = await readFile(path.join(process.cwd(), "app", "api", "assets", "[id]", "download", "route.ts"), "utf8");
  assert.match(source, /source === "SYSTEM_TEST"/);
  assert.match(source, /exige une session administrateur/);
});

test("les fonctions de crédits refusent les marqueurs non facturables", async () => {
  const source = await readFile(path.join(process.cwd(), "lib", "credit-utils.ts"), "utf8");
  assert.match(source, /NON_BILLABLE_GENERATION/);
  assert.match(source, /billingMode === "NON_BILLABLE"/);
  assert.match(source, /provider === "TEST_FIXTURE"/);
});
