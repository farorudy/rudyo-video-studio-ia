import { callOllamaGenerate } from "@/lib/ollama";
import { callRemoteChatCompletion } from "@/lib/ai-provider";
import {
  AiProviderName,
  resolveAiProviderSettings,
  isProviderConfigured,
} from "@/lib/ai/providers";
import {
  chooseProviderForAction,
  getProviderFallbackOrder,
} from "@/lib/ai/router";
import { CreditAction } from "@/lib/credit-costs";
import { AiQuality } from "@/lib/ai/actions";

type ResolvedAiSettings = ReturnType<typeof resolveAiProviderSettings> & {
  baseUrl?: string;
  apiKey?: string;
  label?: string;
};

export type AiGenerateRequest = {
  action: CreditAction;
  prompt: string;
  userId: string;
  quality?: AiQuality;
  preferredProvider?: string;
  modelOverride?: string;
  userPlan?: string;
  allowPremiumAi?: boolean;
};

export type AiGenerateResponse = {
  success: boolean;
  provider: AiProviderName;
  providerLabel: string;
  model: string;
  text: string;
  modeLabel: string;
  estimatedCredits: number;
  reason?: string;
  fallback?: boolean;
};

function getDefaultConversationPrompt(action: CreditAction, prompt: string) {
  if (action === "storyboard_complete" || action === "storyboard") {
    return `Tu es un réalisateur vidéo. Réponds en français avec un storyboard clair et structuré basé sur cette demande :\n${prompt}`;
  }

  if (action === "prompts") {
    return `Tu es un scénariste et un prompt engineer. Génère un prompt d'image vidéo IA précis et créatif basé sur cette demande :\n${prompt}`;
  }

  if (action === "script") {
    return `Tu es un écrivain de script voix off. Rédige un script narratif propre en français à partir de cette demande :\n${prompt}`;
  }

  if (action === "subtitles") {
    return `Tu es un spécialiste des sous-titres. Génère des sous-titres français synchronisables à partir de cette demande :\n${prompt}`;
  }

  return prompt;
}

function getEstimatedCredits(action: CreditAction) {
  const costs: Record<CreditAction, number> = {
    storyboard: 2,
    storyboard_complete: 5,
    script: 3,
    prompts: 5,
    subtitles: 2,
    audio_analysis: 2,
    clip_lyrics: 8,
    quick_clip: 5,
    training_video: 8,
    animated_flyer: 5,
    promo_video: 8,
    clip_package: 15,
    project: 0,
  };

  return costs[action] ?? 0;
}

function getProviderLabel(provider: AiProviderName, settings?: ResolvedAiSettings) {
  if (settings?.label) {
    return settings.label;
  }

  const providerKey = String(provider);

  if (providerKey === "ollama") return "Ollama";
  if (providerKey === "openai") return "OpenAI";
  if (providerKey === "blackbox") return "Blackbox AI";
  if (providerKey === "mistral") return "Mistral";
  if (providerKey === "gemini") return "Gemini";
  if (providerKey === "claude") return "Claude";

  return "Mock local";
}

async function callOllama(params: {
  prompt: string;
  model: string;
  baseUrl?: string;
}) {
  const { prompt, model, baseUrl } = params;

  const result = await callOllamaGenerate(baseUrl ?? "http://127.0.0.1:11434", {
    model,
    prompt,
    stream: false,
    format: "text",
  });

  if (!result.response?.trim()) {
    throw new Error("Réponse Ollama vide.");
  }

  return result.response.trim();
}

async function callOpenAiCompatible(params: {
  prompt: string;
  action: CreditAction;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  label?: string;
  provider?: "openai" | "blackbox";
}) {
  const {
    prompt,
    action,
    model,
    baseUrl,
    apiKey,
    label,
    provider = "openai",
  } = params;

  const completion = await callRemoteChatCompletion({
    settings: {
      provider,
      baseUrl:
        baseUrl ??
        (provider === "blackbox"
          ? "https://api.blackbox.ai"
          : "https://api.openai.com"),
      apiKey: apiKey ?? "",
      model,
      label: label ?? (provider === "blackbox" ? "Blackbox AI" : "OpenAI"),
    },
    messages: [
      {
        role: "system",
        content: getDefaultConversationPrompt(action, prompt),
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  return completion.content;
}

async function callRemoteProvider(params: {
  provider: AiProviderName;
  settings: ResolvedAiSettings;
  prompt: string;
  action: CreditAction;
}) {
  const { provider, settings, prompt, action } = params;
  const providerKey = String(provider);

  if (providerKey === "ollama") {
    return callOllama({
      prompt,
      model: settings.model,
      baseUrl: settings.baseUrl,
    });
  }

  if (providerKey === "openai") {
    return callOpenAiCompatible({
      prompt,
      action,
      model: settings.model,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      label: settings.label,
      provider: "openai",
    });
  }

  if (providerKey === "blackbox") {
    return callOpenAiCompatible({
      prompt,
      action,
      model: settings.model,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      label: settings.label,
      provider: "blackbox",
    });
  }

  throw new Error(`Provider non supporté dans generate.ts : ${providerKey}`);
}

export async function generateWithBestProvider(
  request: AiGenerateRequest,
): Promise<AiGenerateResponse> {
  const {
    action,
    prompt,
    quality = "balanced",
    preferredProvider,
    userPlan,
    allowPremiumAi,
  } = request;

  const selection = chooseProviderForAction({
    action,
    quality,
    preferredProvider,
    userPlan,
    allowPremiumAi,
  });

  const estimatedCredits = getEstimatedCredits(action);

  if (String(selection.provider) === "mock") {
    return {
      success: true,
      provider: selection.provider,
      providerLabel: "Mock local",
      model: "mock",
      text: prompt,
      modeLabel: selection.modeLabel,
      estimatedCredits,
      reason: selection.reason,
      fallback: true,
    };
  }

  const settings = resolveAiProviderSettings(
    selection.provider,
  ) as ResolvedAiSettings;

  if (!isProviderConfigured(selection.provider)) {
    throw new Error(`Provider ${String(selection.provider)} non configuré.`);
  }

  let text = "";
  let providerUsed = selection.provider;
  let fallbackReason: string | undefined;

  try {
    text = await callRemoteProvider({
      provider: selection.provider,
      settings,
      action,
      prompt,
    });
  } catch (error) {
    const fallbackProviders = getProviderFallbackOrder(selection.provider);

    for (const provider of fallbackProviders) {
      if (!isProviderConfigured(provider)) {
        continue;
      }

      try {
        const fallbackSettings = resolveAiProviderSettings(
          provider,
        ) as ResolvedAiSettings;

        text = await callRemoteProvider({
          provider,
          settings: fallbackSettings,
          action,
          prompt,
        });

        providerUsed = provider;
        fallbackReason = `Fallback vers ${String(provider)}`;
        break;
      } catch {
        continue;
      }
    }

    if (!text) {
      throw error;
    }
  }

  const finalSettings = resolveAiProviderSettings(
    providerUsed,
  ) as ResolvedAiSettings;

  return {
    success: true,
    provider: providerUsed,
    providerLabel: getProviderLabel(providerUsed, finalSettings),
    model: finalSettings.model,
    text,
    modeLabel: selection.modeLabel,
    estimatedCredits,
    reason: selection.reason + (fallbackReason ? ` (${fallbackReason})` : ""),
  };
}
