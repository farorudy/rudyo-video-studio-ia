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
  rudyo_50: {
    id: "rudyo_50",
    name: "Pack Decouverte",
    credits: 50,
    amount: 900,
    description:
      "50 credits Rudyo pour tester storyboards, scripts courts et prompts.",
  },
  rudyo_200: {
    id: "rudyo_200",
    name: "Pack Createur",
    credits: 200,
    amount: 2900,
    description: "200 credits Rudyo pour preparer plusieurs projets video.",
  },
  rudyo_700: {
    id: "rudyo_700",
    name: "Pack Pro",
    credits: 700,
    amount: 7900,
    description: "700 credits Rudyo pour dossiers, exports et packs complets.",
  },
  rudyo_2000: {
    id: "rudyo_2000",
    name: "Pack Studio",
    credits: 2000,
    amount: 19900,
    description: "2 000 credits Rudyo pour une production video intensive.",
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
    "Credits internes Rudyo."
  );
}

export function getPlanLabel(plan: string) {
  return PLAN_LABELS[plan as keyof typeof PLAN_LABELS] ?? plan;
}
