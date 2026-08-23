export type SeedanceAvailability = "active" | "unavailable" | "deprecated" | "verification_required";

export type SeedanceCapabilities = {
  textToVideo: boolean | "unknown";
  imageToVideo: boolean | "unknown";
  firstLastFrame: boolean | "unknown";
  multipleReferences: boolean | "unknown";
  videoReference: boolean | "unknown";
  audioReference: boolean | "unknown";
  generatedAudio: boolean | "unknown";
  videoEditOrExtend: boolean | "unknown";
  durations: number[];
  resolutions: string[];
  ratios: string[];
};

export type SeedanceModel = {
  key: string;
  label: string;
  modelId: string | null;
  family: "2.5" | "2.0" | "1.5" | "1.0";
  tier: "hero" | "quality" | "preview" | "draft" | "fallback";
  availability: SeedanceAvailability;
  capabilities: SeedanceCapabilities;
  note?: string;
};

const durations = (maximum: number) => Array.from({ length: maximum - 3 }, (_, index) => index + 4);

const modernCapabilities: SeedanceCapabilities = {
  textToVideo: true,
  imageToVideo: true,
  firstLastFrame: "unknown",
  multipleReferences: true,
  videoReference: true,
  audioReference: true,
  generatedAudio: true,
  videoEditOrExtend: "unknown",
  durations: durations(15),
  resolutions: ["720p", "1080p"],
  ratios: ["16:9", "9:16", "1:1", "adaptive"],
};

export const SEEDANCE_MODELS: SeedanceModel[] = [
  {
    key: "seedance-2.5",
    label: "Seedance 2.5",
    modelId: "dreamina-seedance-2-5-260628",
    family: "2.5",
    tier: "hero",
    availability: "verification_required",
    capabilities: { ...modernCapabilities, durations: durations(30) },
    note: "À privilégier pour les plans principaux après activation dans ModelArk.",
  },
  {
    key: "seedance-2.0",
    label: "Seedance 2.0",
    modelId: "dreamina-seedance-2-0-260128",
    family: "2.0",
    tier: "quality",
    availability: "active",
    capabilities: modernCapabilities,
  },
  {
    key: "seedance-2.0-fast",
    label: "Seedance 2.0 Fast",
    modelId: "dreamina-seedance-2-0-fast-260128",
    family: "2.0",
    tier: "preview",
    availability: "verification_required",
    capabilities: modernCapabilities,
  },
  {
    key: "seedance-2.0-mini",
    label: "Seedance 2.0 Mini",
    modelId: "dreamina-seedance-2-0-mini-260615",
    family: "2.0",
    tier: "draft",
    availability: "verification_required",
    capabilities: {
      ...modernCapabilities,
      videoReference: "unknown",
      audioReference: "unknown",
      resolutions: ["720p"],
    },
  },
  ...["Seedance 1.5 Pro", "Seedance 1.0 Pro", "Seedance 1.0 Pro Fast", "Seedance 1.0 Lite"].map(
    (label, index): SeedanceModel => ({
      key: `legacy-${index + 1}`,
      label,
      modelId: null,
      family: index === 0 ? "1.5" : "1.0",
      tier: "fallback",
      availability: "unavailable",
      capabilities: {
        textToVideo: "unknown",
        imageToVideo: "unknown",
        firstLastFrame: "unknown",
        multipleReferences: "unknown",
        videoReference: "unknown",
        audioReference: "unknown",
        generatedAudio: "unknown",
        videoEditOrExtend: "unknown",
        durations: [],
        resolutions: [],
        ratios: [],
      },
      note: "Identifiant volontairement absent tant qu’il n’est pas vérifié dans le compte BytePlus.",
    }),
  ),
];

function configuredIds() {
  const configured = process.env.BYTEPLUS_ENABLED_MODELS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length ? new Set(configured) : null;
}

export function listAvailableSeedanceModels() {
  const enabled = configuredIds();
  return SEEDANCE_MODELS.map((model) => ({
    ...model,
    availability:
      model.modelId && enabled?.has(model.modelId)
        ? ("active" as const)
        : model.availability,
  })).filter((model) => model.modelId && model.availability !== "deprecated");
}

export function getSeedanceModel(modelId: string) {
  return listAvailableSeedanceModels().find((model) => model.modelId === modelId);
}

export function chooseSeedanceModel(input: {
  requestedModelId?: string | null;
  preview?: boolean;
  economicalDraft?: boolean;
  durationSeconds: number;
  referenceCount: number;
}) {
  if (input.requestedModelId && input.requestedModelId !== "auto") {
    const requested = getSeedanceModel(input.requestedModelId);
    if (!requested || requested.availability !== "active") {
      throw new Error("Le modèle Seedance demandé n’est pas disponible dans la configuration Rudyo.");
    }
    return requested;
  }

  const models = listAvailableSeedanceModels().filter((model) => model.availability === "active");
  const preferredTier = input.preview
    ? "preview"
    : input.economicalDraft
      ? "draft"
      : input.durationSeconds > 10 || input.referenceCount > 1
        ? "hero"
        : "quality";

  return (
    models.find((model) => model.tier === preferredTier) ??
    models.find((model) => model.tier === "quality") ??
    models[0]
  );
}
