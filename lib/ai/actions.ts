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
