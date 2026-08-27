import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClipCallToAction,
  calculateClipQuote,
  calculateRequiredClipCredits,
  normalizeDuration,
  resolveClipPlan,
} from "./clip-pricing";

test("arrondit les millisecondes MP3", () => {
  assert.equal(normalizeDuration(210.05), 210);
});

/**
 * Tableau contractuel : le client paie la durée réelle normalisée.
 * 1 minute = 1 000 crédits = 10 €, 1 crédit = 0,01 €.
 */
const officialPricing = [
  { raw: 15.04, normalized: 15, plan: "TIKTOK", credits: 250, euros: 2.5 },
  { raw: 210.05, normalized: 210, plan: "TIKTOK", credits: 3_500, euros: 35 },
  { raw: 210.6, normalized: 211, plan: "LONG", credits: 3_517, euros: 35.17 },
  { raw: 240, normalized: 240, plan: "LONG", credits: 4_000, euros: 40 },
  { raw: 300.05, normalized: 300, plan: "LONG", credits: 5_000, euros: 50 },
  { raw: 300.6, normalized: 301, plan: "PREMIUM", credits: 5_017, euros: 50.17 },
  { raw: 360, normalized: 360, plan: "PREMIUM", credits: 6_000, euros: 60 },
  { raw: 420.05, normalized: 420, plan: "PREMIUM", credits: 7_000, euros: 70 },
] as const;

for (const row of officialPricing) {
  test(`${row.raw} s est facturée ${row.credits} crédits en formule ${row.plan}`, () => {
    const quote = calculateClipQuote(row.raw, 10_000);
    assert.equal(quote.normalizedSeconds, row.normalized);
    assert.equal(quote.plan, row.plan);
    assert.equal(quote.requiredCredits, row.credits);
    assert.equal(quote.priceInCents, row.credits);
    assert.equal(quote.priceInEuros, row.euros);
    assert.equal(quote.supported, true);
  });
}

test("420,60 s est refusée avant tout paiement", () => {
  const quote = calculateClipQuote(420.6, 10_000);
  assert.equal(quote.normalizedSeconds, 421);
  assert.equal(quote.plan, "CUSTOM");
  assert.equal(quote.supported, false);
  assert.equal(quote.requiredCredits, null);
  assert.equal(quote.priceInCents, null);
  assert.equal(quote.canAfford, false);
});

test("l’arrondi à la demi-seconde bascule vers la seconde supérieure", () => {
  assert.equal(normalizeDuration(210.5), 211);
  assert.equal(resolveClipPlan(normalizeDuration(210.5)), "LONG");
  assert.equal(calculateRequiredClipCredits(211), 3_517);

  assert.equal(normalizeDuration(300.5), 301);
  assert.equal(resolveClipPlan(normalizeDuration(300.5)), "PREMIUM");
  assert.equal(calculateRequiredClipCredits(301), 5_017);

  assert.equal(normalizeDuration(420.5), 421);
  assert.equal(resolveClipPlan(normalizeDuration(420.5)), "CUSTOM");
  assert.throws(() => calculateRequiredClipCredits(421), /INVALID_BILLABLE_DURATION/);
});

test("les bornes de classification suivent exactement 210, 300 et 420 secondes", () => {
  assert.equal(resolveClipPlan(1), "TIKTOK");
  assert.equal(resolveClipPlan(210), "TIKTOK");
  assert.equal(resolveClipPlan(211), "LONG");
  assert.equal(resolveClipPlan(300), "LONG");
  assert.equal(resolveClipPlan(301), "PREMIUM");
  assert.equal(resolveClipPlan(420), "PREMIUM");
  assert.equal(resolveClipPlan(421), "CUSTOM");
});

test("la formule est choisie automatiquement, sans jamais tronquer la musique", () => {
  const quote = calculateClipQuote(240, 10_000, "TIKTOK");
  assert.equal(quote.plan, "LONG");
  assert.equal(quote.requiredPlan, "LONG");
  assert.equal(quote.recommendedPlan, "LONG");
  assert.equal(quote.fitsSelectedPlan, false);
  assert.equal(quote.normalizedSeconds, 240);
  assert.equal(quote.requiredCredits, 4_000);
});

test("calcule uniquement les crédits manquants", () => {
  const quote = calculateClipQuote(300, 3_500, "LONG");
  assert.equal(quote.requiredCredits, 5_000);
  assert.equal(quote.missingCredits, 1_500);
  assert.equal(quote.canAfford, false);
});

// Intl produit des espaces insécables (U+202F / U+00A0) : on compare le texte lisible.
const plainText = (value: string) => value.replace(/[   ]/g, " ");

test("le bouton principal annonce la durée réelle quand le solde suffit", () => {
  const action = buildClipCallToAction({ requiredCredits: 3_517, balanceCredits: 10_000 });
  assert.equal(action.kind, "create");
  assert.equal(plainText(action.label), "Créer mon clip — 3 517 crédits / 35,17 €");
  assert.equal(action.missingCredits, 0);
});

test("le bouton principal n’achète que les crédits manquants", () => {
  const action = buildClipCallToAction({ requiredCredits: 5_017, balanceCredits: 3_500 });
  assert.equal(action.kind, "topup");
  assert.equal(action.missingCredits, 1_517);
  assert.equal(action.purchasedCredits, 1_517);
  assert.equal(action.overcreditCredits, 0);
  assert.equal(action.amountInCents, 1_517);
  assert.equal(plainText(action.label), "Acheter les 1 517 crédits manquants — 15,17 €");
});

test("sous le minimum Stripe, le surcrédit acheté reste visible", () => {
  const action = buildClipCallToAction({ requiredCredits: 3_500, balanceCredits: 3_480 });
  assert.equal(action.missingCredits, 20);
  assert.equal(action.purchasedCredits, 50);
  assert.equal(action.overcreditCredits, 30);
  assert.equal(action.amountInCents, 50);
});
