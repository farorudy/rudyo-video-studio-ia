import { quoteClip } from "../lib/tiktok-offer";

const cases = [
  { raw: 15.04, selectedPlan: "TIKTOK", requestedCredits: 250 },
  { raw: 210.05, selectedPlan: "TIKTOK", requestedCredits: 3_500 },
  { raw: 210.60, selectedPlan: "TIKTOK", requestedCredits: null },
  { raw: 240, selectedPlan: "LONG", requestedCredits: 4_000 },
  { raw: 300.05, selectedPlan: "LONG", requestedCredits: 5_000 },
  { raw: 300.60, selectedPlan: "LONG", requestedCredits: null },
  { raw: 360, selectedPlan: "PREMIUM", requestedCredits: 6_000 },
  { raw: 420.05, selectedPlan: "PREMIUM", requestedCredits: 7_000 },
  { raw: 420.60, selectedPlan: "PREMIUM", requestedCredits: null },
] as const;

console.log(JSON.stringify(cases.map((item) => {
  const quote = quoteClip(item.raw, 0, item.selectedPlan);
  return {
    rawSeconds: item.raw,
    normalizedSeconds: quote.normalizedSeconds,
    selectedPlan: item.selectedPlan,
    requiredPlan: quote.requiredPlan,
    fitsSelectedPlan: quote.fitsSelectedPlan,
    supported: quote.supported,
    actualCredits: quote.totalCredits,
    requestedCredits: item.requestedCredits,
    matchesRequestedCredits: item.requestedCredits === null ? null : quote.totalCredits === item.requestedCredits,
  };
})));
