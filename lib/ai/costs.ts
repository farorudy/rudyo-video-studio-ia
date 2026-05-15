import { CreditAction } from "@/lib/credit-costs";
import { AiProviderName } from "@/lib/ai/providers";

export const PROVIDER_ESTIMATED_COST: Record<AiProviderName, number> = {
  ollama: 0.8,
  openai: 1.4,
  mistral: 1.0,
};

export const ACTION_PROVIDER_PRIORITY: Record<CreditAction, AiProviderName[]> =
  {
    storyboard: ["ollama", "openai", "mistral"],
    storyboard_complete: ["openai", "mistral", "ollama"],
    script: ["openai", "mistral", "ollama"],
    prompts: ["ollama", "openai", "mistral"],
    subtitles: ["ollama", "openai", "mistral"],
    audio_analysis: ["ollama", "openai", "mistral"],
    clip_lyrics: ["openai", "mistral", "ollama"],
    quick_clip: ["ollama", "openai", "mistral"],
    training_video: ["openai", "mistral", "ollama"],
    animated_flyer: ["ollama", "openai", "mistral"],
    promo_video: ["openai", "mistral", "ollama"],
    clip_package: ["openai", "mistral", "ollama"],
    project: ["openai", "mistral", "ollama"],
  };
