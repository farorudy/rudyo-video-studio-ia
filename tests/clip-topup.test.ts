import assert from "node:assert/strict";
import test from "node:test";
import { calculateMissingClipCredits, validateClipTopUpFulfillment } from "../lib/clip-topup";

for (const [required, balance, missing] of [[5000, 3500, 1500], [7000, 3500, 3500], [7000, 5000, 2000], [3500, 3500, 0], [3500, 5000, 0]] as const) {
  test(`${required} requis avec ${balance} en solde achète exactement ${missing} crédits`, () => {
    const result = calculateMissingClipCredits(required, balance);
    assert.equal(result.missingCredits, missing);
    assert.equal(result.priceInCents, missing);
  });
}

test("le webhook refuse toute divergence entre crédits et centimes Stripe", () => {
  assert.equal(validateClipTopUpFulfillment({ requiredCredits: 5000, balanceAtCheckout: 3500, purchasedCredits: 1500, amountTotal: 1500 }), 1500);
  assert.throws(() => validateClipTopUpFulfillment({ requiredCredits: 5000, balanceAtCheckout: 3500, purchasedCredits: 1500, amountTotal: 1499 }), /TOPUP_AMOUNT_MISMATCH/);
  assert.throws(() => validateClipTopUpFulfillment({ requiredCredits: 5000, balanceAtCheckout: 3500, purchasedCredits: 5000, amountTotal: 5000 }), /TOPUP_AMOUNT_MISMATCH/);
});
