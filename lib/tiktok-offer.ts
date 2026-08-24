import { calculateClipQuote, CLIP_PLAN_LIMITS, normalizeDuration, resolveClipPlan, type AutomaticClipPlanCode, type ClipPlanCode as PricingPlanCode } from "@/lib/clip-pricing";

export const CLIP_PLANS = Object.freeze({
  TIKTOK: Object.freeze({ id: "tiktok_clip_complete", code: "TIKTOK", name: "Clip 3:30", maxDurationSeconds: CLIP_PLAN_LIMITS.TIKTOK, maxCredits: 3500, maxPriceEur: 35 }),
  LONG: Object.freeze({ id: "clip_long", code: "LONG", name: "Clip 5:00", maxDurationSeconds: CLIP_PLAN_LIMITS.LONG, maxCredits: 5000, maxPriceEur: 50 }),
  PREMIUM: Object.freeze({ id: "clip_premium", code: "PREMIUM", name: "Clip 7:00", maxDurationSeconds: CLIP_PLAN_LIMITS.PREMIUM, maxCredits: 7000, maxPriceEur: 70 }),
});

export type ClipPlanCode = keyof typeof CLIP_PLANS;

export const CLIP_OFFER = Object.freeze({
  creditsPerEuro: 100,
  creditsPerMinute: 1000,
  maxDurationSeconds: CLIP_PLANS.PREMIUM.maxDurationSeconds,
  ratio: "9:16" as const,
  resolution: "1080p" as const,
  generationResolution: "720p" as const,
  width: 1080,
  height: 1920,
});

// Compatibilité avec les imports historiques. Les limites commerciales sont dans CLIP_PLANS.
export const TIKTOK_OFFER = Object.freeze({ ...CLIP_OFFER, ...CLIP_PLANS.TIKTOK });

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizeClipDuration(rawDurationSeconds: number, audioStartSeconds = 0) {
  if (!Number.isFinite(rawDurationSeconds) || rawDurationSeconds <= 0) throw new Error("INVALID_AUDIO_DURATION");
  if (!Number.isFinite(audioStartSeconds) || audioStartSeconds < 0 || audioStartSeconds >= rawDurationSeconds) throw new Error("INVALID_AUDIO_DURATION");
  return normalizeDuration(rawDurationSeconds - audioStartSeconds);
}

export function selectClipPlan(normalizedSeconds: number): ClipPlanCode | "CUSTOM" {
  return resolveClipPlan(normalizedSeconds) as PricingPlanCode;
}

export function quoteClip(rawDurationSeconds: number, audioStartSeconds = 0, selectedPlan?: AutomaticClipPlanCode) {
  const normalizedSeconds = normalizeClipDuration(rawDurationSeconds, audioStartSeconds);
  const centralQuote = calculateClipQuote(normalizedSeconds, 0, selectedPlan);
  const plan = centralQuote.plan;
  const requiredCredits = centralQuote.requiredCredits ?? 0;
  const supported = plan !== "CUSTOM";
  const definition = supported ? CLIP_PLANS[plan] : null;
  return {
    audioDurationSeconds: rawDurationSeconds,
    audioStartSeconds,
    normalizedSeconds,
    billableDurationSeconds: normalizedSeconds,
    plan,
    planName: definition?.name ?? "Production personnalisée",
    planId: definition?.id ?? "custom",
    supported,
    fitsSelectedPlan: centralQuote.fitsSelectedPlan,
    requiredPlan: centralQuote.requiredPlan,
    recommendedPlan: centralQuote.recommendedPlan,
    planTooShort: supported && !centralQuote.fitsSelectedPlan,
    durationTooLong: !supported,
    truncated: false,
    totalCredits: requiredCredits,
    requiredCredits,
    priceInCents: requiredCredits,
    priceEur: requiredCredits / CLIP_OFFER.creditsPerEuro,
    maxDurationSeconds: definition?.maxDurationSeconds ?? CLIP_OFFER.maxDurationSeconds,
    maxCredits: definition?.maxCredits ?? null,
    maxPriceEur: definition?.maxPriceEur ?? null,
  };
}

export const quoteTikTokClip = quoteClip;

export function getClipEconomics(durationSeconds: number, selectedPlan?: AutomaticClipPlanCode) {
  const quote = quoteClip(durationSeconds, 0, selectedPlan);
  const providerCostEur = quote.normalizedSeconds * envNumber("TIKTOK_PROVIDER_COST_EUR_PER_SECOND", 0.072);
  const workerCostEur = envNumber("TIKTOK_WORKER_COST_EUR", 0.1);
  const storageCostEur = envNumber("TIKTOK_STORAGE_COST_EUR", 0.02);
  const retryReserveEur = Math.min(envNumber("TIKTOK_RETRY_RESERVE_EUR", 2), providerCostEur * 0.1);
  const internalCostEur = providerCostEur + workerCostEur + storageCostEur + retryReserveEur;
  const marginEur = quote.priceEur - internalCostEur;
  const minimumMarginEur = envNumber("TIKTOK_MIN_MARGIN_EUR", 0.5);
  const planEnabled = quote.plan === "TIKTOK"
    ? process.env.TIKTOK_OFFER_ENABLED !== "false"
    : quote.plan === "LONG"
      ? process.env.CLIP_LONG_ENABLED !== "false"
      : quote.plan === "PREMIUM"
        ? process.env.CLIP_PREMIUM_ENABLED !== "false"
        : false;
  return { ...quote, clientRevenueEur: quote.priceEur, providerCostEur, workerCostEur, storageCostEur, retryReserveEur, internalCostEur, marginEur, minimumMarginEur, enabled: quote.supported && planEnabled && marginEur >= minimumMarginEur };
}

export const getTikTokEconomics = getClipEconomics;

export function getClipAuthorization(totalCost: number, currentBalance: number | null, serviceAvailable: boolean, economicallyAllowed = true, supported = true, fitsSelectedPlan = true) {
  const missingCredits = currentBalance === null ? 0 : Math.max(0, totalCost - currentBalance);
  const refusalCode = !supported ? "DURATION_TOO_LONG" : !fitsSelectedPlan ? "PLAN_TOO_SHORT" : !serviceAvailable ? "WORKER_UNAVAILABLE" : !economicallyAllowed ? "OFFER_PAUSED" : missingCredits > 0 ? "INSUFFICIENT_CREDITS" : null;
  return { totalCost, currentBalance, balanceAfter: currentBalance === null ? null : Math.max(0, currentBalance - totalCost), missingCredits, missingPriceEur: missingCredits / CLIP_OFFER.creditsPerEuro, allowed: refusalCode === null, workerAvailable: serviceAvailable, refusalCode };
}

export const getTikTokAuthorization = getClipAuthorization;

export function buildSongSections(durationSeconds: number) {
  const labels = ["Introduction", "Couplet", "Pré-refrain", "Refrain", "Couplet", "Refrain", "Pont", "Conclusion"], energy = ["low", "medium", "medium", "high", "medium", "high", "medium", "low"] as const;
  return labels.map((label, index) => ({ label, startSec: Number(((durationSeconds * index) / labels.length).toFixed(3)), endSec: Number(((durationSeconds * (index + 1)) / labels.length).toFixed(3)), energy: energy[index] }));
}

export function buildTikTokScenes(durationSeconds: number, idea: string, style?: string) {
  const normalizedSeconds = normalizeClipDuration(durationSeconds);
  if (normalizedSeconds > CLIP_OFFER.maxDurationSeconds) throw new Error("DURATION_TOO_LONG");
  const count = Math.max(1, Math.ceil(normalizedSeconds / 10)), sections = buildSongSections(normalizedSeconds), shots = ["plan large", "plan moyen", "gros plan"];
  return Array.from({ length: count }, (_, index) => { const start = index * 10, end = Math.min(normalizedSeconds, start + 10), section = sections.find((item) => start >= item.startSec && start < item.endSec) || sections.at(-1)!; return { order: index, title: `Clip automatique · ${section.label} ${index + 1}`, startTimeSeconds: start, endTimeSeconds: end, durationSeconds: Math.max(4, Math.ceil(end - start)), prompt: [idea.trim(), style ? `Direction visuelle : ${style.trim()}.` : "", `${section.label}, énergie ${section.energy}, ${shots[index % shots.length]}.`, "Même artiste et même identité que la photo de référence, continuité des vêtements, des lieux et de la lumière. Mouvement naturel, narration progressive, sans texte ni logo."].filter(Boolean).join(" ") }; });
}
