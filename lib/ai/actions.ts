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

import { CreditAction } from "@/lib/credit-costs";

export type AiQuality = "economy" | "balanced" | "premium";

export const ACTION_QUALITY_SUGGESTION: Record<CreditAction, AiQuality> = {
  storyboard: "economy",
  storyboard_complete: "balanced",
  script: "balanced",
  prompts: "economy",
  subtitles: "economy",
  audio_analysis: "economy",
  clip_lyrics: "balanced",
  quick_clip: "economy",
  training_video: "balanced",
  animated_flyer: "economy",
  promo_video: "balanced",
  clip_package: "balanced",
  project: "balanced",
};

export const PROVIDER_MODE_LABEL: Record<AiQuality, string> = {
  economy: "Économique",
  balanced: "Équilibré",
  premium: "Premium",
};
