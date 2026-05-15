export type CreditAction =
  | "storyboard"
  | "script"
  | "prompts"
  | "subtitles"
  | "audio_analysis"
  | "clip_lyrics"
  | "quick_clip"
  | "training_video"
  | "animated_flyer"
  | "promo_video"
  | "clip_package"
  | "project";

export const CREDIT_COSTS: Record<string, number> = {
  storyboard: 2,
  script: 2,
  prompts: 3,
  subtitles: 3,
  audio_analysis: 5,
  clip_lyrics: 20,
  quick_clip: 20,
  training_video: 5,
  animated_flyer: 5,
  promo_video: 5,
  clip_package: 20,
  project: 1,
};

export function getCreditCost(action: string) {
  return CREDIT_COSTS[action] ?? 1;
}

export async function getCreditBalance(userId?: string) {
  return 18;
}

export async function requireCredits(userId: string | undefined, amount: number) {
  const balance = await getCreditBalance(userId);

  if (balance < amount) {
    throw new Error("CREDITS_INSUFFICIENTS");
  }

  return true;
}

export async function debitCredits(
  userId: string | undefined,
  amount: number,
  description?: string,
  metadata?: unknown
) {
  return {
    success: true,
    balance: 18 - amount,
    amount,
    description,
    metadata,
  };
}

export async function refundCredits(
  userId: string | undefined,
  amount: number,
  description?: string,
  metadata?: unknown
) {
  return {
    success: true,
    balance: 18 + amount,
    amount,
    description,
    metadata,
  };
}

export async function addCredits(
  userId: string | undefined,
  amount: number,
  description?: string,
  metadata?: unknown
) {
  return {
    success: true,
    balance: 18 + amount,
    amount,
    description,
    metadata,
  };
}
