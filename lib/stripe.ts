import Stripe from "stripe";
import { getActionCreditCost, PLAN_LABELS } from "@/lib/credit-costs";

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
  rudyo_10: {
    id: "rudyo_10",
    name: "Pack Découverte",
    credits: 10,
    amount: 900,
    description:
      "10 Crédits Rudyo pour utiliser la plateforme Rudyo Video Studio IA.",
  },
  rudyo_50: {
    id: "rudyo_50",
    name: "Pack Créateur",
    credits: 50,
    amount: 3900,
    description:
      "50 Crédits Rudyo pour générer storyboards, prompts et exports.",
  },
  rudyo_150: {
    id: "rudyo_150",
    name: "Pack Pro",
    credits: 150,
    amount: 9900,
    description: "150 Crédits Rudyo pour usages IA avancés et exportations.",
  },
  rudyo_500: {
    id: "rudyo_500",
    name: "Pack Studio",
    credits: 500,
    amount: 24900,
    description: "500 Crédits Rudyo pour production vidéo intensive.",
  },
};

const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanDefinition> = {
  starter_monthly: {
    id: "starter_monthly",
    name: "Starter",
    price: 1900,
    monthlyLimit: 20,
    description:
      "20 générations IA / mois, storyboards simples, prompts vidéo, export PDF.",
  },
  createur_monthly: {
    id: "createur_monthly",
    name: "Créateur",
    price: 4900,
    monthlyLimit: 80,
    description:
      "80 générations IA / mois, storyboards complets, sous-titres, templates.",
  },
  studio_monthly: {
    id: "studio_monthly",
    name: "Studio",
    price: 9900,
    monthlyLimit: 200,
    description:
      "200 générations IA / mois, exports avancés, support prioritaire.",
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
    "Crédits internes Rudyo."
  );
}

export function getPlanLabel(plan: string) {
  return PLAN_LABELS[plan as keyof typeof PLAN_LABELS] ?? plan;
}
