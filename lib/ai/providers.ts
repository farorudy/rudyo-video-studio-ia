import {
  AiProvider,
  AiProviderName,
  generateWithMistral,
  generateWithOpenAI,
  isAiProvider,
  resolveDefaultAiProvider,
  resolveModelForProvider,
} from "@/lib/ai-provider";

export type { AiProvider, AiProviderName };

export {
  generateWithMistral,
  generateWithOpenAI,
  isAiProvider,
  resolveDefaultAiProvider,
  resolveModelForProvider,
};

export function isProviderConfigured(provider: AiProviderName) {
  if (provider === "mistral") {
    return Boolean(process.env.MISTRAL_API_KEY);
  }

  if (provider === "openai") {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  if (provider === "ollama") {
    return true;
  }

  return false;
}

export function resolveAiProviderSettings(provider?: AiProviderName) {
  const selectedProvider = provider || resolveDefaultAiProvider();

  return {
    provider: selectedProvider,
    model: resolveModelForProvider(selectedProvider),
    configured: isProviderConfigured(selectedProvider),
  };
}
