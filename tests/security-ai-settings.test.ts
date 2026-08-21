import assert from "node:assert/strict";
import test from "node:test";
import { aiSettingsSchema, providerAllowedForPlan } from "../lib/ai-settings-policy";

test("allowPremiumAi est rejeté par la liste blanche stricte", () => {
  const parsed = aiSettingsSchema.safeParse({ preferredAiProvider: "ollama", allowPremiumAi: true });
  assert.equal(parsed.success, false);
});

test("les champs de plan, quota, crédits et rôle sont rejetés", () => {
  for (const forbidden of ["plan", "subscriptionStatus", "monthlyLimit", "monthlyUsed", "creditBalance", "role"]) {
    const parsed = aiSettingsSchema.safeParse({ preferredAiProvider: "ollama", [forbidden]: "fraude" });
    assert.equal(parsed.success, false, `${forbidden} aurait dû être rejeté`);
  }
});

test("OpenAI est refusé au plan FREE et accepté aux plans payants", () => {
  assert.equal(providerAllowedForPlan("FREE", "openai"), false);
  assert.equal(providerAllowedForPlan("STARTER", "openai"), true);
  assert.equal(providerAllowedForPlan("CREATOR", "openai"), true);
  assert.equal(providerAllowedForPlan("STUDIO", "openai"), true);
});
