import { CreditAction } from "@/lib/credit-costs";
import { AiProviderName } from "@/lib/ai/providers";

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
  seedance_video: "premium",
  training_video: "balanced",
  animated_flyer: "economy",
  promo_video: "balanced",
  clip_package: "balanced",
  project: "balanced",
};

export const PROVIDER_MODE_LABEL: Record<AiProviderName, string> = {
  ollama: "Mode local",
  openai: "Mode OpenAI",
  mistral: "Mode Mistral",
};
