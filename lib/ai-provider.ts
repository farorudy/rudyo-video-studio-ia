export type AiProvider = "ollama" | "openai" | "blackbox";
export type RemoteAiProvider = "openai" | "blackbox";

export type AiModelOption = {
  value: string;
  label: string;
  description: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RemoteAiSettings = {
  provider: RemoteAiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;
};

const DEFAULT_REMOTE_MODEL = "gpt-4o-mini";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";
const DEFAULT_BLACKBOX_BASE_URL = "https://api.blackbox.ai";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";

const AI_MODEL_OPTIONS: Record<AiProvider, AiModelOption[]> = {
  ollama: [
    {
      value: "llama3.1:8b",
      label: "llama3.1:8b",
      description: "Équilibré et rapide en local",
    },
    {
      value: "qwen2.5:7b",
      label: "qwen2.5:7b",
      description: "Bon pour le JSON et le texte structuré",
    },
    {
      value: "mistral:7b",
      label: "mistral:7b",
      description: "Alternative locale polyvalente",
    },
  ],
  openai: [
    {
      value: "gpt-4o-mini",
      label: "gpt-4o-mini",
      description: "Rapide et économique",
    },
    {
      value: "gpt-4.1-mini",
      label: "gpt-4.1-mini",
      description: "Plus précis pour les sorties structurées",
    },
    {
      value: "gpt-4.1",
      label: "gpt-4.1",
      description: "Qualité supérieure",
    },
  ],
  blackbox: [
    {
      value: "gpt-4o-mini",
      label: "gpt-4o-mini",
      description: "Compatible OpenAI, rapide",
    },
    {
      value: "claude-sonnet",
      label: "claude-sonnet",
      description: "Modèle orienté rédaction",
    },
    {
      value: "llama-3",
      label: "llama-3",
      description: "Modèle open-source généraliste",
    },
    {
      value: "mistral-large",
      label: "mistral-large",
      description: "Modèle puissant polyvalent",
    },
  ],
};

export function getAiModelOptions(provider: AiProvider) {
  return AI_MODEL_OPTIONS[provider];
}

export function getDefaultAiModel(provider: AiProvider) {
  if (provider === "ollama") {
    return process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
  }

  if (provider === "openai") {
    return process.env.OPENAI_MODEL?.trim() || DEFAULT_REMOTE_MODEL;
  }

  return process.env.BLACKBOX_MODEL?.trim() || DEFAULT_REMOTE_MODEL;
}

export function resolveModelForProvider(
  provider: AiProvider,
  modelOverride?: string,
) {
  const override = modelOverride?.trim();

  if (override) {
    return override;
  }

  return getDefaultAiModel(provider);
}

export function isAiProvider(value: unknown): value is AiProvider {
  return value === "ollama" || value === "openai" || value === "blackbox";
}

export function isRemoteAiProvider(value: unknown): value is RemoteAiProvider {
  return value === "openai" || value === "blackbox";
}

export function normalizeAiBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function resolveDefaultAiProvider() {
  return isAiProvider(process.env.DEFAULT_AI_PROVIDER)
    ? process.env.DEFAULT_AI_PROVIDER
    : "ollama";
}

export function resolveRemoteAiSettings(
  provider: RemoteAiProvider,
  modelOverride?: string,
): RemoteAiSettings {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim() || "";

    return {
      provider,
      baseUrl: normalizeAiBaseUrl(
        process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
      ),
      apiKey,
      model: resolveModelForProvider(provider, modelOverride),
      label: "OpenAI",
    };
  }

  const apiKey = process.env.BLACKBOX_API_KEY?.trim() || "";

  return {
    provider,
    baseUrl: normalizeAiBaseUrl(
      process.env.BLACKBOX_BASE_URL?.trim() || DEFAULT_BLACKBOX_BASE_URL,
    ),
    apiKey,
    model: resolveModelForProvider(provider, modelOverride),
    label: "Blackbox AI",
  };
}

export async function callRemoteChatCompletion(params: {
  settings: RemoteAiSettings;
  messages: ChatMessage[];
  temperature?: number;
  timeoutMs?: number;
}) {
  const {
    settings,
    messages,
    temperature = 0.7,
    timeoutMs = 15 * 60 * 1000,
  } = params;

  if (!settings.apiKey) {
    throw new Error(
      `${settings.label} est configuré sans clé API. Ajoutez ${
        settings.provider === "openai" ? "OPENAI_API_KEY" : "BLACKBOX_API_KEY"
      } ou revenez à Ollama.`,
    );
  }

  const url = `${settings.baseUrl}/v1/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(
        `${settings.label} indisponible (${response.status}): ${rawText}`,
      );
    }

    const parsed = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = parsed.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error(`Réponse ${settings.label} vide.`);
    }

    return {
      content,
      rawText,
      settings,
    };
  } finally {
    clearTimeout(timeout);
  }
}
