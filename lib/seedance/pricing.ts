export type SeedanceCreditRate = {
  modelId: string;
  label: string;
  resolution: "720p" | "1080p";
  creditsPerSecond: number;
};

// Source commune du Studio, de la page Tarifs et du calcul serveur.
export const SEEDANCE_DEFAULT_CREDIT_RATES: SeedanceCreditRate[] = [
  { modelId: "dreamina-seedance-2-0-260128", label: "Seedance 2.0", resolution: "720p", creditsPerSecond: 20 },
  { modelId: "dreamina-seedance-2-0-260128", label: "Seedance 2.0", resolution: "1080p", creditsPerSecond: 50 },
  { modelId: "dreamina-seedance-2-0-fast-260128", label: "Seedance 2.0 Fast", resolution: "720p", creditsPerSecond: 15 },
];

type ConfiguredRates = Record<string, Partial<Record<"720p" | "1080p", number>>>;

function configuredRates(): ConfiguredRates {
  const raw = process.env.SEEDANCE_CREDIT_RATES_JSON?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ConfiguredRates;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new Error("SEEDANCE_CREDIT_RATES_JSON contient un JSON invalide.");
  }
}

export function getSeedanceCreditRate(modelId: string, resolution: string) {
  const normalizedResolution = resolution.toLowerCase() as "720p" | "1080p";
  const override = configuredRates()[modelId]?.[normalizedResolution];
  if (Number.isSafeInteger(override) && Number(override) > 0) return Number(override);
  return SEEDANCE_DEFAULT_CREDIT_RATES.find(
    (rate) => rate.modelId === modelId && rate.resolution === normalizedResolution,
  )?.creditsPerSecond ?? null;
}

export function quoteSeedanceCredits(input: {
  modelId: string;
  durationSeconds: number;
  resolution: string;
  ratio: string;
  generateAudio?: boolean;
  watermark?: boolean;
}) {
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new Error("Durée Seedance invalide.");
  }
  const unitCredits = getSeedanceCreditRate(input.modelId, input.resolution);
  if (unitCredits === null) {
    throw new Error("Le tarif Rudyo de ce modèle et de cette résolution n’est pas configuré.");
  }

  // Ces options n'ont actuellement aucun supplément, mais font partie du devis.
  const baseCredits = unitCredits * input.durationSeconds;
  const optionsCredits = 0;
  return {
    modelId: input.modelId,
    durationSeconds: input.durationSeconds,
    resolution: input.resolution.toLowerCase(),
    ratio: input.ratio,
    generateAudio: Boolean(input.generateAudio),
    watermark: Boolean(input.watermark),
    unitCredits,
    baseCredits,
    optionsCredits,
    totalCredits: baseCredits + optionsCredits,
  };
}

export function listSeedanceRatesForModel(modelId: string, resolutions: string[]) {
  return resolutions.flatMap((resolution) => {
    const creditsPerSecond = getSeedanceCreditRate(modelId, resolution);
    return creditsPerSecond === null ? [] : [{ resolution, creditsPerSecond }];
  });
}
