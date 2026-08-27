export const CENTS_PER_CREDIT = 1;
export const CREDITS_PER_MINUTE = 1_000;
export const STRIPE_MINIMUM_EUR_CENTS = 50;

export const CLIP_PLAN_CATALOG = Object.freeze({
  TIKTOK: Object.freeze({ code: "TIKTOK", name: "Clip 3:30", commercialName: "Clip TikTok", maxDurationSeconds: 210, maxCredits: 3_500, maxPriceInCents: 3_500, maxPriceInEuros: 35 }),
  LONG: Object.freeze({ code: "LONG", name: "Clip 5:00", commercialName: "Clip Long", maxDurationSeconds: 300, maxCredits: 5_000, maxPriceInCents: 5_000, maxPriceInEuros: 50 }),
  PREMIUM: Object.freeze({ code: "PREMIUM", name: "Clip 7:00", commercialName: "Clip Premium", maxDurationSeconds: 420, maxCredits: 7_000, maxPriceInCents: 7_000, maxPriceInEuros: 70 }),
} as const);

export const CLIP_PLAN_LIMITS = Object.freeze({
  TIKTOK: CLIP_PLAN_CATALOG.TIKTOK.maxDurationSeconds,
  LONG: CLIP_PLAN_CATALOG.LONG.maxDurationSeconds,
  PREMIUM: CLIP_PLAN_CATALOG.PREMIUM.maxDurationSeconds,
} as const);

export type AutomaticClipPlanCode = keyof typeof CLIP_PLAN_CATALOG;
export type ClipPlanCode = AutomaticClipPlanCode | "CUSTOM";

export interface ClipQuote {
  rawDurationSeconds: number;
  normalizedSeconds: number;
  plan: ClipPlanCode;
  requiredPlan: ClipPlanCode;
  recommendedPlan: AutomaticClipPlanCode | null;
  planName: string;
  supported: boolean;
  fitsSelectedPlan: boolean;
  requiredCredits: number | null;
  priceInCents: number | null;
  priceInEuros: number | null;
  balanceCredits: number;
  missingCredits: number | null;
  remainingCredits: number | null;
  canAfford: boolean;
}

function assertValidDuration(duration: number): void {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("INVALID_AUDIO_DURATION");
}

export function normalizeDuration(rawDurationSeconds: number): number {
  assertValidDuration(rawDurationSeconds);
  return Math.max(1, Math.round(rawDurationSeconds));
}

export function resolveClipPlan(normalizedSeconds: number): ClipPlanCode {
  if (normalizedSeconds <= CLIP_PLAN_LIMITS.TIKTOK) return "TIKTOK";
  if (normalizedSeconds <= CLIP_PLAN_LIMITS.LONG) return "LONG";
  if (normalizedSeconds <= CLIP_PLAN_LIMITS.PREMIUM) return "PREMIUM";
  return "CUSTOM";
}

export function calculateRequiredClipCredits(normalizedSeconds: number): number {
  if (!Number.isInteger(normalizedSeconds) || normalizedSeconds <= 0 || normalizedSeconds > CLIP_PLAN_LIMITS.PREMIUM) throw new Error("INVALID_BILLABLE_DURATION");
  return Math.ceil((normalizedSeconds * CREDITS_PER_MINUTE) / 60);
}

export function calculateClipTopUp(requiredCredits: number, currentBalance: number) {
  if (!Number.isInteger(requiredCredits) || requiredCredits <= 0) throw new Error("INVALID_REQUIRED_CREDITS");
  if (!Number.isInteger(currentBalance) || currentBalance < 0) throw new Error("INVALID_BALANCE");
  const missingCredits = Math.max(0, requiredCredits - currentBalance);
  const purchasedCredits = missingCredits === 0 ? 0 : Math.max(missingCredits, STRIPE_MINIMUM_EUR_CENTS);
  return {
    missingCredits,
    purchasedCredits,
    overcreditCredits: purchasedCredits - missingCredits,
    priceInCents: purchasedCredits * CENTS_PER_CREDIT,
    priceInEuros: (purchasedCredits * CENTS_PER_CREDIT) / 100,
  };
}

export function getClipPlanName(plan: ClipPlanCode): string {
  return plan === "CUSTOM" ? "Production non disponible" : `Formule ${CLIP_PLAN_CATALOG[plan].commercialName}`;
}

export function calculateClipQuote(rawDurationSeconds: number, balanceCredits: number, selectedPlan?: AutomaticClipPlanCode): ClipQuote {
  const normalizedSeconds = normalizeDuration(rawDurationSeconds);
  const requiredPlan = resolveClipPlan(normalizedSeconds);
  const supported = requiredPlan !== "CUSTOM";
  const plan = supported ? requiredPlan : "CUSTOM";

  if (!supported || plan === "CUSTOM") {
    return { rawDurationSeconds, normalizedSeconds, plan: "CUSTOM", requiredPlan, recommendedPlan: null, planName: getClipPlanName("CUSTOM"), supported: false, fitsSelectedPlan: false, requiredCredits: null, priceInCents: null, priceInEuros: null, balanceCredits, missingCredits: null, remainingCredits: null, canAfford: false };
  }

  const fitsSelectedPlan = !selectedPlan || selectedPlan === requiredPlan;
  const recommendedPlan = fitsSelectedPlan ? null : requiredPlan as AutomaticClipPlanCode;
  const requiredCredits = calculateRequiredClipCredits(normalizedSeconds);
  const missingCredits = Math.max(0, requiredCredits - balanceCredits);
  return {
    rawDurationSeconds,
    normalizedSeconds,
    plan,
    requiredPlan,
    recommendedPlan,
    planName: getClipPlanName(plan),
    supported: true,
    fitsSelectedPlan,
    requiredCredits,
    priceInCents: requiredCredits * CENTS_PER_CREDIT,
    priceInEuros: (requiredCredits * CENTS_PER_CREDIT) / 100,
    balanceCredits,
    missingCredits,
    remainingCredits: Math.max(0, balanceCredits - requiredCredits),
    canAfford: fitsSelectedPlan && missingCredits === 0,
  };
}

export function formatCreditAmount(credits: number): string {
  return credits.toLocaleString("fr-FR");
}

export function formatCentsAsEuros(amountInCents: number): string {
  return formatEuros(amountInCents / 100);
}

/**
 * Libellé unique du bouton principal, partagé par l'interface et les tests.
 * Le montant Stripe réellement facturé peut dépasser les crédits manquants
 * lorsque le minimum Stripe s'applique : le surcrédit est alors annoncé.
 */
export function buildClipCallToAction(input: { requiredCredits: number; balanceCredits: number }): {
  kind: "create" | "topup";
  label: string;
  missingCredits: number;
  purchasedCredits: number;
  overcreditCredits: number;
  amountInCents: number;
} {
  const { requiredCredits, balanceCredits } = input;
  const topUp = calculateClipTopUp(requiredCredits, balanceCredits);
  if (topUp.missingCredits === 0) {
    return {
      kind: "create",
      label: `Créer mon clip — ${formatCreditAmount(requiredCredits)} crédits / ${formatCentsAsEuros(requiredCredits * CENTS_PER_CREDIT)}`,
      missingCredits: 0,
      purchasedCredits: 0,
      overcreditCredits: 0,
      amountInCents: 0,
    };
  }
  return {
    kind: "topup",
    label: `Acheter les ${formatCreditAmount(topUp.missingCredits)} crédits manquants — ${formatCentsAsEuros(topUp.priceInCents)}`,
    missingCredits: topUp.missingCredits,
    purchasedCredits: topUp.purchasedCredits,
    overcreditCredits: topUp.overcreditCredits,
    amountInCents: topUp.priceInCents,
  };
}

export function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return seconds ? `${minutes} min ${seconds.toString().padStart(2, "0")} s` : `${minutes} minutes`;
}

export function formatEuros(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}
