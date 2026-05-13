import { AiProviderName, isProviderConfigured } from "@/lib/ai/providers";
import { CreditAction } from "@/lib/credit-costs";
import { AiQuality, PROVIDER_MODE_LABEL } from "@/lib/ai/actions";

export type ProviderSelection = {
  provider: AiProviderName;
  reason: string;
  modeLabel: string;
};

export type SupportedAiProvider = Exclude<AiProviderName, "mock">;

const PREMIUM_PROVIDERS: SupportedAiProvider[] = ["openai", "claude"];
const ECONOMY_PROVIDERS: SupportedAiProvider[] = ["gemini", "ollama"];

function getFallbackProviders(provider: AiProviderName): SupportedAiProvider[] {
  if (provider === "openai") {
    return ["claude", "gemini", "ollama"];
  }
  if (provider === "claude") {
    return ["openai", "gemini", "ollama"];
  }
  if (provider === "gemini") {
    return ["openai", "claude", "ollama"];
  }
  if (provider === "ollama") {
    return ["gemini", "openai", "claude"];
  }
  return [];
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
      provider: "mock",
      reason: "Mode mock activé",
      modeLabel: PROVIDER_MODE_LABEL[quality],
    };
  }

  if (
    preferredProvider &&
    isProviderConfigured(preferredProvider as AiProviderName)
  ) {
    return {
      provider: preferredProvider as AiProviderName,
      reason: "Préférence utilisateur disponible",
      modeLabel: PROVIDER_MODE_LABEL[quality],
    };
  }

  const premiumAllowed = allowPremiumAi || userPlan === "STUDIO";

  if (!isProduction) {
    return {
      provider: "ollama",
      reason: "Environnement de développement, utilisation d'Ollama local",
      modeLabel: PROVIDER_MODE_LABEL[quality],
    };
  }

  if (quality === "premium" && premiumAllowed) {
    if (isProviderConfigured("openai")) {
      return {
        provider: "openai",
        reason: "Qualité premium disponible via OpenAI",
        modeLabel: PROVIDER_MODE_LABEL[quality],
      };
    }
    if (isProviderConfigured("claude")) {
      return {
        provider: "claude",
        reason: "Qualité premium disponible via Claude",
        modeLabel: PROVIDER_MODE_LABEL[quality],
      };
    }
  }

  if (action === "storyboard_complete") {
    if (isProviderConfigured("gemini")) {
      return {
        provider: "gemini",
        reason: "Storyboard complet ciblé sur un bon rapport qualité / coût",
        modeLabel: PROVIDER_MODE_LABEL[quality],
      };
    }
  }

  if (action === "storyboard_simple") {
    if (isProviderConfigured("gemini")) {
      return {
        provider: "gemini",
        reason: "Storyboard simple, priorité coût bas",
        modeLabel: PROVIDER_MODE_LABEL[quality],
      };
    }
  }

  if (action === "prompts_video" || action === "subtitles") {
    if (isProviderConfigured("gemini")) {
      return {
        provider: "gemini",
        reason: "Prompt ou sous-titres optimisés pour coût et rapidité",
        modeLabel: PROVIDER_MODE_LABEL[quality],
      };
    }
  }

  if (action === "script_voiceover") {
    if (isProviderConfigured("claude")) {
      return {
        provider: "claude",
        reason: "Voix off / script avec Claude pour meilleure fluidité",
        modeLabel: PROVIDER_MODE_LABEL[quality],
      };
    }
    if (isProviderConfigured("openai")) {
      return {
        provider: "openai",
        reason: "Voix off / script via OpenAI",
        modeLabel: PROVIDER_MODE_LABEL[quality],
      };
    }
  }

  const fallback = ECONOMY_PROVIDERS.find(isProviderConfigured);
  if (fallback) {
    return {
      provider: fallback,
      reason:
        "Aucun choix spécifique disponible, utilisation d'un provider économique",
      modeLabel: PROVIDER_MODE_LABEL[quality],
    };
  }

  return {
    provider: "mock",
    reason: "Aucun provider configuré, utilisation du mock local",
    modeLabel: PROVIDER_MODE_LABEL[quality],
  };
}

export function getProviderFallbackOrder(provider: AiProviderName) {
  return getFallbackProviders(provider).filter(isProviderConfigured);
}
