import {
  getDefaultAiModel,
  isRemoteAiProvider,
  normalizeAiBaseUrl,
  resolveRemoteAiSettings,
} from "@/lib/ai-provider";

export type AiProviderName =
  | "ollama"
  | "openai"
  | "gemini"
  | "claude"
  | "blackbox"
  | "mock";

export type AiProviderSettings = {
  provider: AiProviderName;
  label: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
};

const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-mini";
const DEFAULT_CLAUDE_MODEL = "claude-3.5";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_GEMINI_BASE_URL = "https://gemini.googleapis.com";
const DEFAULT_CLAUDE_BASE_URL = "https://api.anthropic.com";

export function resolveAiProviderSettings(
  provider: AiProviderName,
  modelOverride?: string,
): AiProviderSettings {
  if (provider === "ollama") {
    return {
      provider,
      label: "Ollama",
      model:
        modelOverride?.trim() ||
        process.env.OLLAMA_MODEL?.trim() ||
        DEFAULT_OLLAMA_MODEL,
      baseUrl: normalizeAiBaseUrl(
        process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
      ),
    };
  }

  if (provider === "openai" || provider === "blackbox") {
    const settings = resolveRemoteAiSettings(provider, modelOverride?.trim());

    return {
      provider,
      label: settings.label,
      model: settings.model,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
    };
  }

  if (provider === "gemini") {
    return {
      provider,
      label: "Gemini",
      model:
        modelOverride?.trim() ||
        process.env.GEMINI_MODEL?.trim() ||
        DEFAULT_GEMINI_MODEL,
      baseUrl: normalizeAiBaseUrl(
        process.env.GEMINI_BASE_URL?.trim() || DEFAULT_GEMINI_BASE_URL,
      ),
      apiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    };
  }

  if (provider === "claude") {
    return {
      provider,
      label: "Claude",
      model:
        modelOverride?.trim() ||
        process.env.CLAUDE_MODEL?.trim() ||
        DEFAULT_CLAUDE_MODEL,
      baseUrl: normalizeAiBaseUrl(
        process.env.CLAUDE_BASE_URL?.trim() || DEFAULT_CLAUDE_BASE_URL,
      ),
      apiKey: process.env.CLAUDE_API_KEY?.trim() || undefined,
    };
  }

  return {
    provider: "mock",
    label: "Mock local",
    model: "mock",
  };
}

export function isProviderConfigured(provider: AiProviderName) {
  if (provider === "ollama") {
    return Boolean(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL);
  }

  if (provider === "gemini") {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  if (provider === "claude") {
    return Boolean(process.env.CLAUDE_API_KEY);
  }

  if (provider === "openai") {
    const settings = resolveAiProviderSettings("openai");
    return Boolean(settings.apiKey);
  }

  if (provider === "blackbox") {
    const settings = resolveAiProviderSettings("blackbox");
    return Boolean(settings.apiKey);
  }

  return provider === "mock";
}

export function isAiProviderName(value: unknown): value is AiProviderName {
  return (
    value === "ollama" ||
    value === "openai" ||
    value === "gemini" ||
    value === "claude" ||
    value === "blackbox" ||
    value === "mock"
  );
}
