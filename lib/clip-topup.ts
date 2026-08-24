export function calculateMissingClipCredits(requiredCredits: number, currentBalance: number) {
  if (!Number.isInteger(requiredCredits) || requiredCredits <= 0) throw new Error("INVALID_REQUIRED_CREDITS");
  if (!Number.isInteger(currentBalance) || currentBalance < 0) throw new Error("INVALID_BALANCE");
  const missingCredits = Math.max(0, requiredCredits - currentBalance);
  return { missingCredits, priceInCents: missingCredits, priceEur: missingCredits / 100 };
}

export function validateClipTopUpFulfillment(input: {
  requiredCredits: number;
  balanceAtCheckout: number;
  purchasedCredits: number;
  amountTotal: number | null;
}) {
  const expected = calculateMissingClipCredits(input.requiredCredits, input.balanceAtCheckout).missingCredits;
  if (expected <= 0 || input.purchasedCredits !== expected || input.amountTotal !== expected) throw new Error("TOPUP_AMOUNT_MISMATCH");
  return expected;
}
