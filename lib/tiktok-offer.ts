import { calculateClipQuote, calculateClipTopUp, CLIP_PLAN_CATALOG, CLIP_PLAN_LIMITS, normalizeDuration, resolveClipPlan, type AutomaticClipPlanCode, type ClipPlanCode as PricingPlanCode } from "@/lib/clip-pricing";

export const CLIP_PLANS = Object.freeze({
  TIKTOK: Object.freeze({ id: "tiktok_clip_complete", code: "TIKTOK", name: "Clip 3:30", maxDurationSeconds: CLIP_PLAN_LIMITS.TIKTOK, maxCredits: CLIP_PLAN_CATALOG.TIKTOK.maxCredits, maxPriceEur: CLIP_PLAN_CATALOG.TIKTOK.maxPriceInEuros }),
  LONG: Object.freeze({ id: "clip_long", code: "LONG", name: "Clip 5:00", maxDurationSeconds: CLIP_PLAN_LIMITS.LONG, maxCredits: CLIP_PLAN_CATALOG.LONG.maxCredits, maxPriceEur: CLIP_PLAN_CATALOG.LONG.maxPriceInEuros }),
  PREMIUM: Object.freeze({ id: "clip_premium", code: "PREMIUM", name: "Clip 7:00", maxDurationSeconds: CLIP_PLAN_LIMITS.PREMIUM, maxCredits: CLIP_PLAN_CATALOG.PREMIUM.maxCredits, maxPriceEur: CLIP_PLAN_CATALOG.PREMIUM.maxPriceInEuros }),
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
export const SEEDANCE_SCENE_DURATION_SECONDS = 10;

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
  // Tarif public Seedance 2.0 enhanced, 720p, sans vidéo d'entrée : 0,303 USD/s.
  // Une ancienne surcharge plus basse ne peut jamais minorer ce plancher officiel.
  const officialProviderCostEurPerSecond = envNumber("SEEDANCE_PROVIDER_COST_USD_PER_SECOND", 0.303) * envNumber("USD_TO_EUR_RATE", 0.86);
  const providerCostEurPerSecond = Math.max(officialProviderCostEurPerSecond, envNumber("TIKTOK_PROVIDER_COST_EUR_PER_SECOND", 0));
  const providerCostEur = quote.normalizedSeconds * providerCostEurPerSecond;
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
  return { ...quote, clientRevenueEur: quote.priceEur, providerCostEurPerSecond, providerCostEur, workerCostEur, storageCostEur, retryReserveEur, internalCostEur, marginEur, minimumMarginEur, enabled: quote.supported && planEnabled && marginEur >= minimumMarginEur };
}

export const getTikTokEconomics = getClipEconomics;

export function getClipAuthorization(totalCost: number, currentBalance: number | null, serviceAvailable: boolean, economicallyAllowed = true, supported = true, fitsSelectedPlan = true) {
  const topUp = currentBalance === null ? null : calculateClipTopUp(totalCost, currentBalance);
  const missingCredits = topUp?.missingCredits ?? 0;
  const refusalCode = !supported ? "DURATION_TOO_LONG" : !fitsSelectedPlan ? "PLAN_TOO_SHORT" : !serviceAvailable ? "WORKER_UNAVAILABLE" : !economicallyAllowed ? "OFFER_PAUSED" : missingCredits > 0 ? "INSUFFICIENT_CREDITS" : null;
  return {
    totalCost,
    currentBalance,
    balanceAfter: currentBalance === null ? null : Math.max(0, currentBalance - totalCost),
    missingCredits,
    missingPriceEur: missingCredits / CLIP_OFFER.creditsPerEuro,
    checkoutCredits: topUp?.purchasedCredits ?? 0,
    checkoutPriceEur: topUp?.priceInEuros ?? 0,
    overcreditCredits: topUp?.overcreditCredits ?? 0,
    allowed: refusalCode === null,
    workerAvailable: serviceAvailable,
    refusalCode,
  };
}

export const getTikTokAuthorization = getClipAuthorization;

export function buildSongSections(durationSeconds: number) {
  const labels = ["Introduction", "Couplet", "Pré-refrain", "Refrain", "Couplet", "Refrain", "Pont", "Conclusion"], energy = ["low", "medium", "medium", "high", "medium", "high", "medium", "low"] as const;
  return labels.map((label, index) => ({ label, startSec: Number(((durationSeconds * index) / labels.length).toFixed(3)), endSec: Number(((durationSeconds * (index + 1)) / labels.length).toFixed(3)), energy: energy[index] }));
}

export function buildTikTokScenes(durationSeconds: number, idea: string, style?: string, referenceImageKey?: string) {
  const normalizedSeconds = normalizeClipDuration(durationSeconds);
  if (normalizedSeconds > CLIP_OFFER.maxDurationSeconds) throw new Error("DURATION_TOO_LONG");
  const count = Math.max(1, Math.ceil(normalizedSeconds / SEEDANCE_SCENE_DURATION_SECONDS));
  const sections = buildSongSections(normalizedSeconds);
  const cameras = ["plan large avec travelling avant lent", "plan moyen stabilisé", "gros plan avec mouvement orbital discret"];
  const lightings = ["lumière douce et cinématographique", "contre-jour coloré cohérent", "lumière principale chaude et naturelle"];
  return Array.from({ length: count }, (_, index) => {
    const start = Math.round((normalizedSeconds * index) / count);
    const end = Math.round((normalizedSeconds * (index + 1)) / count);
    const section = sections.find((item) => start >= item.startSec && start < item.endSec) || sections.at(-1)!;
    const cameraMovement = cameras[index % cameras.length];
    const lighting = lightings[index % lightings.length];
    const description = `${section.label} : progression narrative de l'artiste, énergie ${section.energy}.`;
    const continuityNotes = "Conserver strictement le même visage, la même coiffure, la même tenue principale, la palette et la direction de lumière de la scène précédente.";
    const prompt = [idea.trim(), style ? `Direction visuelle : ${style.trim()}.` : "", description, `${cameraMovement}, ${lighting}.`, continuityNotes, "Vidéo verticale 9:16, mouvement naturel, sans texte, sans sous-titre et sans logo."].filter(Boolean).join(" ");
    return {
      order: index,
      title: `Clip automatique · ${section.label} ${index + 1}`,
      startTimeSeconds: start,
      endTimeSeconds: end,
      durationSeconds: Math.round(end - start),
      description,
      prompt,
      cameraMovement,
      lighting,
      transition: index === count - 1 ? "fondu au noir" : "raccord de mouvement doux",
      continuityNotes,
      referenceImageKey: referenceImageKey || null,
    };
  });
}

export function validateClipScenario(
  scenes: Array<{ order: number; startTimeSeconds: number; endTimeSeconds: number; durationSeconds: number }>,
  expectedDurationSeconds: number,
) {
  if (scenes.length === 0) throw new Error("SCENARIO_MISSING");
  let cursor = 0;
  for (const [index, scene] of scenes.entries()) {
    if (scene.order !== index || scene.startTimeSeconds !== cursor) throw new Error("SCENARIO_TIMELINE_INVALID");
    if (scene.endTimeSeconds <= scene.startTimeSeconds || scene.durationSeconds !== scene.endTimeSeconds - scene.startTimeSeconds) throw new Error("SCENARIO_DURATION_INVALID");
    if (scene.durationSeconds < 4 || scene.durationSeconds > 15) throw new Error("SCENARIO_SEEDANCE_DURATION_UNSUPPORTED");
    cursor = scene.endTimeSeconds;
  }
  if (cursor !== expectedDurationSeconds) throw new Error("SCENARIO_TOTAL_DURATION_INVALID");
  return { sceneCount: scenes.length, durationSeconds: cursor };
}
