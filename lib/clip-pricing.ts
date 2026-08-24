export const CENTS_PER_CREDIT = 1;

export const CLIP_PLAN_CATALOG = Object.freeze({
  TIKTOK: Object.freeze({ code: "TIKTOK", name: "Clip 3:30", commercialName: "Clip TikTok", maxDurationSeconds: 210, credits: 3_500, priceInCents: 3_500, priceInEuros: 35 }),
  LONG: Object.freeze({ code: "LONG", name: "Clip 5:00", commercialName: "Clip Long", maxDurationSeconds: 300, credits: 5_000, priceInCents: 5_000, priceInEuros: 50 }),
  PREMIUM: Object.freeze({ code: "PREMIUM", name: "Clip 7:00", commercialName: "Clip Premium", maxDurationSeconds: 420, credits: 7_000, priceInCents: 7_000, priceInEuros: 70 }),
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

export function getClipPlanName(plan: ClipPlanCode): string {
  return plan === "CUSTOM" ? "Production non disponible" : `Formule ${CLIP_PLAN_CATALOG[plan].commercialName}`;
}

export function calculateClipQuote(rawDurationSeconds: number, balanceCredits: number, selectedPlan?: AutomaticClipPlanCode): ClipQuote {
  const normalizedSeconds = normalizeDuration(rawDurationSeconds);
  const requiredPlan = resolveClipPlan(normalizedSeconds);
  const supported = requiredPlan !== "CUSTOM";
  const plan = selectedPlan ?? (supported ? requiredPlan : "CUSTOM");

  if (!supported || plan === "CUSTOM") {
    return { rawDurationSeconds, normalizedSeconds, plan: "CUSTOM", requiredPlan, recommendedPlan: null, planName: getClipPlanName("CUSTOM"), supported: false, fitsSelectedPlan: false, requiredCredits: null, priceInCents: null, priceInEuros: null, balanceCredits, missingCredits: null, remainingCredits: null, canAfford: false };
  }

  const definition = CLIP_PLAN_CATALOG[plan];
  const fitsSelectedPlan = normalizedSeconds <= definition.maxDurationSeconds;
  const recommendedPlan = fitsSelectedPlan ? null : requiredPlan as AutomaticClipPlanCode;
  const missingCredits = Math.max(0, definition.credits - balanceCredits);
  return {
    rawDurationSeconds,
    normalizedSeconds,
    plan,
    requiredPlan,
    recommendedPlan,
    planName: getClipPlanName(plan),
    supported: true,
    fitsSelectedPlan,
    requiredCredits: definition.credits,
    priceInCents: definition.priceInCents,
    priceInEuros: definition.priceInEuros,
    balanceCredits,
    missingCredits,
    remainingCredits: Math.max(0, balanceCredits - definition.credits),
    canAfford: fitsSelectedPlan && missingCredits === 0,
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
