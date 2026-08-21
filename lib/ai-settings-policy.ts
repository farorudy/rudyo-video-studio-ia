import { z } from "zod";

export const aiSettingsSchema = z.object({
  preferredAiProvider: z.enum(["ollama", "openai"]).nullable(),
}).strict();

export function providerAllowedForPlan(plan: string, provider: "ollama" | "openai" | null) {
  if (provider === null || provider === "ollama") return true;
  return plan === "STARTER" || plan === "CREATOR" || plan === "STUDIO";
}
