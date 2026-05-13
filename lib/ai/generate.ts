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
  if (action === "storyboard_complete" || action === "storyboard_simple") {
    return `Tu es un réalisateur vidéo. Réponds en français avec un storyboard clair et structuré basé sur cette demande :\n${prompt}`;
  }

  if (action === "prompts_video") {
    return `Tu es un scénariste et un prompt engineer. Génère un prompt d'image vidéo IA précis et créatif basé sur cette demande :\n${prompt}`;
  }

  if (action === "script_voiceover") {
    return `Tu es un écrivain de script voix off. Rédige un script narratif propre en français à partir de cette demande :\n${prompt}`;
  }

  if (action === "subtitles") {
    return `Tu es un spécialiste des sous-titres. Génère des sous-titres français synchronisables à partir de cette demande :\n${prompt}`;
  }

  return prompt;
}

async function callGemini(params: {
  prompt: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}) {
  const { prompt, model, apiKey, baseUrl } = params;
  if (!apiKey) {
    throw new Error("Gemini non configuré : clé API manquante.");
  }

  const response = await fetch(`${baseUrl}/v1/models/${model}:generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        text: prompt,
      },
      temperature: 0.7,
      max_output_tokens: 1200,
    }),
  });

  const json = await response.json();
  const candidate = json?.candidates?.[0];
  const content =
    candidate?.output?.[0]?.content?.[0]?.text ?? candidate?.content;

  if (!response.ok || !content) {
    throw new Error(
      `Gemini indisponible (${response.status}): ${JSON.stringify(json)}`,
    );
  }

  return content.trim();
}

async function callClaude(params: {
  prompt: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}) {
  const { prompt, model, apiKey, baseUrl } = params;
  if (!apiKey) {
    throw new Error("Claude non configuré : clé API manquante.");
  }

  const response = await fetch(`${baseUrl}/v1/complete`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      max_tokens_to_sample: 1200,
      temperature: 0.7,
      stop_sequences: ["\n\nHuman:"],
    }),
  });

  const json = await response.json();
  const content = json?.completion ?? json?.response ?? json?.output;

  if (!response.ok || !content) {
    throw new Error(
      `Claude indisponible (${response.status}): ${JSON.stringify(json)}`,
    );
  }

  return String(content).trim();
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

async function callRemoteProvider(params: {
  provider: AiProviderName;
  settings: ReturnType<typeof resolveAiProviderSettings>;
  prompt: string;
  action: CreditAction;
}) {
  const { provider, settings, prompt, action } = params;

  if (provider === "openai" || provider === "blackbox") {
    const completion = await callRemoteChatCompletion({
      settings: {
        provider: provider === "openai" ? "openai" : "blackbox",
        baseUrl: settings.baseUrl ?? "",
        apiKey: settings.apiKey ?? "",
        model: settings.model,
        label: settings.label,
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

  if (provider === "gemini") {
    return callGemini({
      prompt,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
    });
  }

  if (provider === "claude") {
    return callClaude({
      prompt,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
    });
  }

  if (provider === "ollama") {
    return callOllama({
      prompt,
      model: settings.model,
      baseUrl: settings.baseUrl,
    });
  }

  throw new Error(`Aucun provider de génération disponible pour ${provider}`);
}

export async function generateWithBestProvider(request: AiGenerateRequest) {
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

  const estimatedCredits =
    action === "storyboard_simple"
      ? 2
      : action === "storyboard_complete"
        ? 5
        : action === "prompts_video"
          ? 5
          : action === "script_voiceover"
            ? 3
            : action === "subtitles"
              ? 2
              : action === "export_pdf" || action === "export_txt"
                ? 1
                : action === "clip_pack"
                  ? 15
                  : 0;

  if (selection.provider === "mock") {
    return {
      success: true,
      provider: "mock" as const,
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
    request.modelOverride,
  );

  if (!isProviderConfigured(selection.provider)) {
    throw new Error(`Provider ${selection.provider} non configuré.`);
  }

  let text = "";
  let providerUsed = selection.provider;
  let fallbackReason: string | undefined;

  try {
    text = await callRemoteProvider({
      provider: selection.provider,
      settings,
      action,
      prompt: getDefaultConversationPrompt(action, prompt),
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
          request.modelOverride,
        );
        text = await callRemoteProvider({
          provider,
          settings: fallbackSettings,
          action,
          prompt: getDefaultConversationPrompt(action, prompt),
        });
        providerUsed = provider;
        fallbackReason = `Fallback vers ${provider}`;
        break;
      } catch {
        continue;
      }
    }

    if (!text) {
      throw error;
    }
  }

  return {
    success: true,
    provider: providerUsed,
    providerLabel: resolveAiProviderSettings(providerUsed).label,
    model: resolveAiProviderSettings(providerUsed, request.modelOverride).model,
    text,
    modeLabel: selection.modeLabel,
    estimatedCredits,
    reason: selection.reason + (fallbackReason ? ` (${fallbackReason})` : ""),
  };
}
