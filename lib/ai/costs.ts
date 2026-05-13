import { CreditAction } from "@/lib/credit-costs";
import { AiProviderName } from "@/lib/ai/providers";

export const PROVIDER_ESTIMATED_COST: Record<AiProviderName, number> = {
  ollama: 0.8,
  gemini: 0.9,
  openai: 1.4,
  claude: 1.3,
  blackbox: 1.2,
  mock: 0,
};

export const ACTION_PROVIDER_PRIORITY: Record<CreditAction, AiProviderName[]> =
  {
    storyboard_simple: ["gemini", "ollama", "openai"],
    storyboard_complete: ["gemini", "openai", "claude"],
    prompts_video: ["gemini", "openai", "ollama"],
    script_voiceover: ["claude", "openai", "gemini"],
    subtitles: ["gemini", "openai", "claude"],
    export_pdf: ["mock", "ollama", "gemini"],
    export_txt: ["mock", "ollama", "gemini"],
    clip_pack: ["gemini", "openai", "ollama"],
    other: ["gemini", "openai", "ollama"],
  };

export function getEstimatedProviderCost(provider: AiProviderName) {
  return PROVIDER_ESTIMATED_COST[provider] ?? 1;
}

export function getEstimatedActionCost(
  action: CreditAction,
  provider: AiProviderName,
) {
  const base = getEstimatedProviderCost(provider);
  const actionMultiplier =
    action === "storyboard_complete"
      ? 1.0
      : action === "storyboard_simple"
        ? 0.6
        : action === "prompts_video"
          ? 0.7
          : action === "script_voiceover"
            ? 0.8
            : action === "subtitles"
              ? 0.5
              : action === "clip_pack"
                ? 1.1
                : 0.4;

  return Math.max(0.1, base * actionMultiplier);
}

export function getProviderLabel(provider: AiProviderName) {
  return provider === "mock"
    ? "Mock local"
    : provider === "openai"
      ? "OpenAI"
      : provider === "gemini"
        ? "Gemini"
        : provider === "claude"
          ? "Claude"
          : provider === "blackbox"
            ? "Blackbox"
            : "Ollama";
}
