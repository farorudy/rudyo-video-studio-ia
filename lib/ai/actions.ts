import { CreditAction } from "@/lib/credit-costs";

export type AiQuality = "economy" | "balanced" | "premium";

export const ACTION_QUALITY_SUGGESTION: Record<CreditAction, AiQuality> = {
  storyboard_simple: "economy",
  storyboard_complete: "balanced",
  prompts_video: "economy",
  script_voiceover: "balanced",
  subtitles: "economy",
  export_pdf: "economy",
  export_txt: "economy",
  clip_pack: "balanced",
  other: "balanced",
};

export const ACTION_LABELS: Record<CreditAction, string> = {
  storyboard_simple: "Storyboard simple",
  storyboard_complete: "Storyboard complet",
  prompts_video: "Prompts vidéo",
  script_voiceover: "Script / voix off",
  subtitles: "Sous-titres",
  export_pdf: "Export PDF",
  export_txt: "Export TXT",
  clip_pack: "Pack de clips",
  other: "Autre",
};

export const PROVIDER_MODE_LABEL: Record<AiQuality, string> = {
  economy: "Économique",
  balanced: "Équilibré",
  premium: "Premium",
};
