import { AiProviderName, isProviderConfigured } from "@/lib/ai/providers";
import { CreditAction } from "@/lib/credit-costs";
import { AiQuality } from "@/lib/ai/actions";

export type ProviderSelection = {
  provider: AiProviderName;
  reason: string;
  modeLabel: string;
};

export type SupportedAiProvider = Extract<AiProviderName, "ollama" | "openai">;

const ECONOMY_PROVIDERS: SupportedAiProvider[] = ["ollama", "openai"];
const PREMIUM_PROVIDERS: SupportedAiProvider[] = ["openai", "ollama"];

function getModeLabel(quality: AiQuality) {
  const labels: Record<AiQuality, string> = {
    economy: "Mode économique",
    balanced: "Mode équilibré",
    premium: "Mode premium",
  };

  return labels[quality];
}

function isSupportedProvider(value: unknown): value is SupportedAiProvider {
  return value === "ollama" || value === "openai";
}

function getFallbackProviders(provider: AiProviderName): SupportedAiProvider[] {
  if (provider === "openai") {
    return ["ollama"];
  }

  if (provider === "ollama") {
    return ["openai"];
  }

  return ["ollama", "openai"];
}

export function chooseProviderForAction(params: {
  action: CreditAction;
  quality?: AiQuality;
  preferredProvider?: string;
  userPlan?: string;
  allowPremiumAi?: boolean;
  isProduction?: boolean;
  forceMock?: boolean;
}): ProviderSelection {
  const {
    action,
    quality = "balanced",
    preferredProvider,
    userPlan,
    allowPremiumAi = false,
    isProduction = process.env.NODE_ENV === "production",
    forceMock = process.env.USE_MOCK_STORYBOARD === "true",
  } = params;

  if (forceMock) {
    return {
      provider: "mock" as AiProviderName,
      reason: "Mode mock activé",
      modeLabel: getModeLabel(quality),
    };
  }

  if (
    preferredProvider &&
    isSupportedProvider(preferredProvider) &&
    isProviderConfigured(preferredProvider)
  ) {
    return {
      provider: preferredProvider,
      reason: "Préférence utilisateur disponible",
      modeLabel: getModeLabel(quality),
    };
  }

  const premiumAllowed = allowPremiumAi || userPlan === "STUDIO";

  if (!isProduction && isProviderConfigured("ollama" as AiProviderName)) {
    return {
      provider: "ollama" as AiProviderName,
      reason: "Environnement de développement, utilisation d'Ollama local",
      modeLabel: getModeLabel(quality),
    };
  }

  if (quality === "premium" && premiumAllowed) {
    const premiumProvider = PREMIUM_PROVIDERS.find((provider) =>
      isProviderConfigured(provider),
    );

    if (premiumProvider) {
      return {
        provider: premiumProvider,
        reason: "Qualité premium disponible",
        modeLabel: getModeLabel(quality),
      };
    }
  }

  if (action === "storyboard_complete") {
    if (isProviderConfigured("openai" as AiProviderName)) {
      return {
        provider: "openai" as AiProviderName,
        reason: "Storyboard complet via OpenAI",
        modeLabel: getModeLabel(quality),
      };
    }
  }

  if (action === "storyboard") {
    if (isProviderConfigured("ollama" as AiProviderName)) {
      return {
        provider: "ollama" as AiProviderName,
        reason: "Storyboard simple via Ollama",
        modeLabel: getModeLabel(quality),
      };
    }
  }

  if (action === "prompts" || action === "subtitles") {
    if (isProviderConfigured("ollama" as AiProviderName)) {
      return {
        provider: "ollama" as AiProviderName,
        reason: "Action légère via Ollama",
        modeLabel: getModeLabel(quality),
      };
    }
  }

  if (action === "script") {
    if (isProviderConfigured("openai" as AiProviderName)) {
      return {
        provider: "openai" as AiProviderName,
        reason: "Script généré via OpenAI",
        modeLabel: getModeLabel(quality),
      };
    }
  }

  const fallback = ECONOMY_PROVIDERS.find((provider) =>
    isProviderConfigured(provider),
  );

  if (fallback) {
    return {
      provider: fallback,
      reason: "Provider disponible utilisé en fallback",
      modeLabel: getModeLabel(quality),
    };
  }

  return {
    provider: "mock" as AiProviderName,
    reason: "Aucun provider configuré, utilisation du mock local",
    modeLabel: getModeLabel(quality),
  };
}

export function getProviderFallbackOrder(provider: AiProviderName) {
  return getFallbackProviders(provider).filter((fallbackProvider) =>
    isProviderConfigured(fallbackProvider),
  );
}
