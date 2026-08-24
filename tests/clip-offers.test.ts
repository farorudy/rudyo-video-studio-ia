import assert from "node:assert/strict";
import test from "node:test";
import { buildTikTokScenes, CLIP_PLANS, quoteClip } from "../lib/tiktok-offer";

test("sélectionne automatiquement le plus petit pack compatible", () => {
  assert.equal(quoteClip(15).plan, "TIKTOK");
  assert.equal(quoteClip(211).plan, "LONG");
  assert.equal(quoteClip(301).plan, "PREMIUM");
  assert.equal(quoteClip(421).plan, "CUSTOM");
});

test("facture les packs à prix fixe", () => {
  assert.equal(quoteClip(15, 0, "TIKTOK").totalCredits, 3_500);
  assert.equal(quoteClip(240, 0, "LONG").totalCredits, 5_000);
  assert.equal(quoteClip(360, 0, "PREMIUM").totalCredits, 7_000);
});

test("bloque un pack trop court et recommande le suivant", () => {
  const quote = quoteClip(211, 0, "TIKTOK");
  assert.equal(quote.fitsSelectedPlan, false);
  assert.equal(quote.recommendedPlan, "LONG");
  assert.equal(quote.truncated, false);
});

test("les plafonds commerciaux restent 3 500, 5 000 et 7 000 crédits", () => {
  assert.equal(quoteClip(CLIP_PLANS.TIKTOK.maxDurationSeconds, 0, "TIKTOK").totalCredits, 3500);
  assert.equal(quoteClip(CLIP_PLANS.LONG.maxDurationSeconds, 0, "LONG").totalCredits, 5000);
  assert.equal(quoteClip(CLIP_PLANS.PREMIUM.maxDurationSeconds, 0, "PREMIUM").totalCredits, 7000);
});

test("les storyboards longs contiennent 21, 30 et 42 scènes", () => {
  assert.equal(buildTikTokScenes(210, "Une artiste chante.").length, 21);
  assert.equal(buildTikTokScenes(300, "Une artiste chante.").length, 30);
  assert.equal(buildTikTokScenes(420, "Une artiste chante.").length, 42);
  assert.throws(() => buildTikTokScenes(421, "Une artiste chante."), /DURATION_TOO_LONG/);
});
