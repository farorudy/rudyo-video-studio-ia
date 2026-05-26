import Stripe from "stripe";
import { PLAN_LABELS } from "@/lib/credit-costs";

export type CreditPackDefinition = {
  id: string;
  name: string;
  credits: number;
  amount: number;
  description: string;
};

export type SubscriptionPlanDefinition = {
  id: string;
  name: string;
  price: number;
  monthlyLimit: number;
  description: string;
  stripeMapping?: string;
};

const CREDIT_PACKS: Record<string, CreditPackDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    credits: 100,
    amount: 500,
    description: "100 tokens pour tester les generations IA essentielles.",
  },
  creator: {
    id: "creator",
    name: "Creator",
    credits: 500,
    amount: 1900,
    description: "500 tokens pour produire plusieurs projets courts.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    credits: 1500,
    amount: 4900,
    description: "1 500 tokens pour des workflows video avances.",
  },
  studio: {
    id: "studio",
    name: "Studio",
    credits: 5000,
    amount: 14900,
    description: "5 000 tokens pour une production IA intensive.",
  },
};

const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanDefinition> = {
  starter_monthly: {
    id: "starter_monthly",
    name: "Createur Mensuel",
    price: 1900,
    monthlyLimit: 150,
    description:
      "150 credits / mois pour createurs reguliers et artistes independants.",
  },
  createur_monthly: {
    id: "createur_monthly",
    name: "Pro Mensuel",
    price: 4900,
    monthlyLimit: 500,
    description:
      "500 credits / mois pour entrepreneurs, formateurs et associations.",
  },
  studio_monthly: {
    id: "studio_monthly",
    name: "Studio Mensuel",
    price: 12900,
    monthlyLimit: 1500,
    description:
      "1 500 credits / mois pour structures, agences et centres de formation.",
  },
};

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY est manquante");
  }

  if (
    process.env.NODE_ENV !== "production" &&
    secretKey.startsWith("sk_live_") &&
    process.env.ALLOW_STRIPE_LIVE_IN_DEV !== "true"
  ) {
    throw new Error(
      "STRIPE_SECRET_KEY live détectée en développement. Utilisez une clé sk_test_ pour tester Stripe Checkout.",
    );
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
  });
}

export function getCreditPack(productId: string) {
  return CREDIT_PACKS[productId];
}

export function getSubscriptionPlan(productId: string) {
  return SUBSCRIPTION_PLANS[productId];
}

export function getAllCreditPacks() {
  return Object.values(CREDIT_PACKS);
}

export function getFirstPurchaseBonusTokens() {
  const configured = Number.parseInt(
    process.env.FIRST_PURCHASE_BONUS_TOKENS ?? "25",
    10,
  );

  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}

export function getAllSubscriptionPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

export function getStripeProductName(productId: string) {
  return (
    getCreditPack(productId)?.name ??
    getSubscriptionPlan(productId)?.name ??
    productId
  );
}

export function getStripeProductDescription(productId: string) {
  return (
    getCreditPack(productId)?.description ??
    getSubscriptionPlan(productId)?.description ??
    "Crédits internes Rudyo."
  );
}

export function getPlanLabel(plan: string) {
  return PLAN_LABELS[plan as keyof typeof PLAN_LABELS] ?? plan;
}
