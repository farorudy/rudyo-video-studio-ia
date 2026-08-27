import assert from "node:assert/strict";
import test from "node:test";
import { buildTikTokScenes, CLIP_PLANS, getClipEconomics, quoteClip, validateClipScenario } from "../lib/tiktok-offer";

test("sélectionne automatiquement le plus petit pack compatible", () => {
  assert.equal(quoteClip(15).plan, "TIKTOK");
  assert.equal(quoteClip(211).plan, "LONG");
  assert.equal(quoteClip(301).plan, "PREMIUM");
  assert.equal(quoteClip(421).plan, "CUSTOM");
});

test("facture la durée réelle et non un forfait", () => {
  assert.equal(quoteClip(15, 0, "TIKTOK").totalCredits, 250);
  assert.equal(quoteClip(240, 0, "LONG").totalCredits, 4_000);
  assert.equal(quoteClip(360, 0, "PREMIUM").totalCredits, 6_000);
});

test("un extrait décalé n’est facturé que sur sa durée restante", () => {
  const quote = quoteClip(240, 60, "LONG");
  assert.equal(quote.normalizedSeconds, 180);
  assert.equal(quote.plan, "TIKTOK");
  assert.equal(quote.totalCredits, 3_000);
  assert.equal(quote.priceEur, 30);
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
  assert.equal(CLIP_PLANS.TIKTOK.maxPriceEur, 35);
  assert.equal(CLIP_PLANS.LONG.maxPriceEur, 50);
  assert.equal(CLIP_PLANS.PREMIUM.maxPriceEur, 70);
});

test("les storyboards longs contiennent 21, 30 et 42 scènes", () => {
  assert.equal(buildTikTokScenes(210, "Une artiste chante.").length, 21);
  assert.equal(buildTikTokScenes(300, "Une artiste chante.").length, 30);
  assert.equal(buildTikTokScenes(420, "Une artiste chante.").length, 42);
  assert.throws(() => buildTikTokScenes(421, "Une artiste chante."), /DURATION_TOO_LONG/);
});

test("un clip de 240 s produit exactement 24 scenes Seedance continues de 10 s", () => {
  const scenes = buildTikTokScenes(240, "Une artiste interprete son titre sur scene.", "cinematographique", "portrait-key");
  assert.equal(scenes.length, 24);
  assert.deepEqual(validateClipScenario(scenes, 240), { sceneCount: 24, durationSeconds: 240 });
  assert.equal(scenes.reduce((total, scene) => total + scene.durationSeconds, 0), 240);
  scenes.forEach((scene, index) => {
    assert.equal(scene.order, index);
    assert.equal(scene.startTimeSeconds, index * 10);
    assert.equal(scene.durationSeconds, 10);
    assert.equal(scene.referenceImageKey, "portrait-key");
    assert.ok(scene.prompt.length > 20);
    assert.ok(scene.description.length > 10);
    assert.ok(scene.cameraMovement.length > 0);
    assert.ok(scene.lighting.length > 0);
    assert.ok(scene.transition.length > 0);
    assert.ok(scene.continuityNotes.length > 0);
  });
});

test("le tarif officiel Seedance 2.0 bloque une vente 240 s à 40 euros déficitaire", () => {
  const previousRate = process.env.TIKTOK_PROVIDER_COST_EUR_PER_SECOND;
  const previousUsd = process.env.SEEDANCE_PROVIDER_COST_USD_PER_SECOND;
  const previousFx = process.env.USD_TO_EUR_RATE;
  process.env.TIKTOK_PROVIDER_COST_EUR_PER_SECOND = "0.072";
  process.env.SEEDANCE_PROVIDER_COST_USD_PER_SECOND = "0.303";
  process.env.USD_TO_EUR_RATE = "0.86";
  try {
    const economics = getClipEconomics(240, "LONG");
    assert.equal(economics.priceEur, 40);
    assert.ok(economics.providerCostEur > 62);
    assert.ok(economics.marginEur < 0);
    assert.equal(economics.enabled, false);
  } finally {
    if (previousRate === undefined) delete process.env.TIKTOK_PROVIDER_COST_EUR_PER_SECOND; else process.env.TIKTOK_PROVIDER_COST_EUR_PER_SECOND = previousRate;
    if (previousUsd === undefined) delete process.env.SEEDANCE_PROVIDER_COST_USD_PER_SECOND; else process.env.SEEDANCE_PROVIDER_COST_USD_PER_SECOND = previousUsd;
    if (previousFx === undefined) delete process.env.USD_TO_EUR_RATE; else process.env.USD_TO_EUR_RATE = previousFx;
  }
});
