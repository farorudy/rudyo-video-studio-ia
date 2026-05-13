export type CreditAction =
  | "storyboard_simple"
  | "storyboard_complete"
  | "prompts_video"
  | "script_voiceover"
  | "subtitles"
  | "export_pdf"
  | "export_txt"
  | "clip_pack"
  | "other";

export type BillingPlan = "FREE" | "STARTER" | "CREATOR" | "STUDIO";

export type TransactionType =
  | "purchase"
  | "usage"
  | "refund"
  | "bonus"
  | "pending";

export const ACTION_CREDIT_COST: Record<CreditAction, number> = {
  storyboard_simple: 2,
  storyboard_complete: 5,
  prompts_video: 5,
  script_voiceover: 3,
  subtitles: 2,
  export_pdf: 1,
  export_txt: 1,
  clip_pack: 15,
  other: 0,
};

export const PLAN_INCLUDED_ACTIONS: Record<BillingPlan, CreditAction[]> = {
  FREE: [],
  STARTER: ["storyboard_simple", "prompts_video", "export_pdf"],
  CREATOR: [
    "storyboard_simple",
    "storyboard_complete",
    "prompts_video",
    "subtitles",
    "export_pdf",
    "export_txt",
  ],
  STUDIO: [
    "storyboard_simple",
    "storyboard_complete",
    "prompts_video",
    "script_voiceover",
    "subtitles",
    "export_pdf",
    "export_txt",
    "clip_pack",
  ],
};

export const PLAN_MONTHLY_LIMITS: Record<BillingPlan, number> = {
  FREE: 0,
  STARTER: 20,
  CREATOR: 80,
  STUDIO: 200,
};

export const PLAN_LABELS: Record<BillingPlan, string> = {
  FREE: "Gratuit",
  STARTER: "Starter",
  CREATOR: "Créateur",
  STUDIO: "Studio",
};

export function getActionCreditCost(action: CreditAction) {
  return ACTION_CREDIT_COST[action] ?? 0;
}

export function isGenerationAction(action: CreditAction) {
  return [
    "storyboard_simple",
    "storyboard_complete",
    "prompts_video",
    "script_voiceover",
    "subtitles",
  ].includes(action);
}

export function isActionIncludedInPlan(
  plan: BillingPlan,
  action: CreditAction,
) {
  return PLAN_INCLUDED_ACTIONS[plan]?.includes(action) ?? false;
}
