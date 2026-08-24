import assert from "node:assert/strict";
import test from "node:test";
import { calculateClipQuote, normalizeDuration } from "./clip-pricing";

test("arrondit les millisecondes MP3", () => {
  assert.equal(normalizeDuration(210.05), 210);
});

const fixedPlans = [
  ["TIKTOK", 180, 3_500, 35],
  ["LONG", 240, 5_000, 50],
  ["PREMIUM", 360, 7_000, 70],
] as const;

for (const [plan, duration, credits, euros] of fixedPlans) {
  test(`${plan} conserve son prix fixe`, () => {
    const quote = calculateClipQuote(duration, 10_000, plan);
    assert.equal(quote.plan, plan);
    assert.equal(quote.requiredCredits, credits);
    assert.equal(quote.priceInEuros, euros);
    assert.equal(quote.fitsSelectedPlan, true);
  });
}

test("propose le pack supérieur sans tronquer la musique", () => {
  const quote = calculateClipQuote(240, 10_000, "TIKTOK");
  assert.equal(quote.plan, "TIKTOK");
  assert.equal(quote.requiredPlan, "LONG");
  assert.equal(quote.recommendedPlan, "LONG");
  assert.equal(quote.fitsSelectedPlan, false);
});

test("refuse 421 secondes sans prix automatique", () => {
  const quote = calculateClipQuote(420.6, 10_000, "PREMIUM");
  assert.equal(quote.normalizedSeconds, 421);
  assert.equal(quote.supported, false);
  assert.equal(quote.plan, "CUSTOM");
  assert.equal(quote.requiredCredits, null);
  assert.equal(quote.priceInCents, null);
});

test("calcule uniquement les crédits manquants", () => {
  const quote = calculateClipQuote(300, 3_500, "LONG");
  assert.equal(quote.requiredCredits, 5_000);
  assert.equal(quote.missingCredits, 1_500);
  assert.equal(quote.canAfford, false);
});
