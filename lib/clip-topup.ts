import { calculateClipTopUp } from "@/lib/clip-pricing";

export function calculateMissingClipCredits(requiredCredits: number, currentBalance: number) {
  const quote = calculateClipTopUp(requiredCredits, currentBalance);
  return { ...quote, priceEur: quote.priceInEuros };
}

export function validateClipTopUpFulfillment(input: {
  requiredCredits: number;
  balanceAtCheckout: number;
  purchasedCredits: number;
  amountTotal: number | null;
}) {
  const expected = calculateMissingClipCredits(input.requiredCredits, input.balanceAtCheckout).purchasedCredits;
  if (expected <= 0 || input.purchasedCredits !== expected || input.amountTotal !== expected) throw new Error("TOPUP_AMOUNT_MISMATCH");
  return expected;
}
