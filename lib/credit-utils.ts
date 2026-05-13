import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CreditAction,
  getActionCreditCost,
  isActionIncludedInPlan,
  isGenerationAction,
  PLAN_MONTHLY_LIMITS,
  BillingPlan,
} from "@/lib/credit-costs";
import { getCurrentUser, getOrCreateUserByEmail } from "@/lib/auth";

export type CreditAllocationResult = {
  allowed: boolean;
  source: "plan" | "credits" | "none";
  cost: number;
  planRemaining: number;
  creditsRemaining: number;
  reason?: string;
};

export async function getReservedPendingCredits(userId: string) {
  const result = await prisma.creditTransaction.aggregate({
    _sum: {
      creditsAmount: true,
    },
    where: {
      userId,
      status: "PENDING",
    },
  });

  return result._sum.creditsAmount ?? 0;
}

export async function checkUserCredits(userId: string, action: CreditAction) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return {
      allowed: false,
      source: "none" as const,
      cost: getActionCreditCost(action),
      planRemaining: 0,
      creditsRemaining: 0,
      reason: "Utilisateur introuvable",
    };
  }

  const reservedCredits = await getReservedPendingCredits(userId);
  const cost = getActionCreditCost(action);
  const planAllowed =
    user.monthlyLimit > 0 &&
    isActionIncludedInPlan(user.plan as BillingPlan, action) &&
    user.monthlyUsed < user.monthlyLimit;
  const effectiveCreditsRemaining = user.creditsRemaining - reservedCredits;

  if (planAllowed) {
    return {
      allowed: true,
      source: "plan",
      cost: 0,
      planRemaining: Math.max(0, user.monthlyLimit - user.monthlyUsed),
      creditsRemaining: effectiveCreditsRemaining,
    };
  }

  if (effectiveCreditsRemaining >= cost) {
    return {
      allowed: true,
      source: "credits",
      cost,
      planRemaining: Math.max(0, user.monthlyLimit - user.monthlyUsed),
      creditsRemaining: effectiveCreditsRemaining,
    };
  }

  return {
    allowed: false,
    source: "none",
    cost,
    planRemaining: Math.max(0, user.monthlyLimit - user.monthlyUsed),
    creditsRemaining: effectiveCreditsRemaining,
    reason: "Crédits insuffisants",
  };
}

export async function reserveCredits(
  userId: string,
  action: CreditAction,
  description: string,
  metadata?: Record<string, unknown>,
) {
  const allocation = await checkUserCredits(userId, action);
  if (!allocation.allowed) {
    throw new Error("Crédits insuffisants ou action non autorisée.");
  }

  return prisma.creditTransaction.create({
    data: {
      userId,
      type: "USAGE",
      action: action.toUpperCase() as any,
      creditsAmount: allocation.source === "credits" ? allocation.cost : 0,
      description,
      metadata: metadata as any,
      status: "PENDING",
    },
  });
}

export async function confirmCreditUsage(transactionId: string) {
  const transaction = await prisma.creditTransaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) {
    throw new Error("Transaction introuvable.");
  }
  if (transaction.status !== "PENDING") {
    throw new Error("Transaction déjà finalisée.");
  }

  const user = await prisma.user.findUnique({
    where: { id: transaction.userId },
  });
  if (!user) {
    throw new Error("Utilisateur introuvable pour confirmer la transaction.");
  }

  const updates: Record<string, unknown> = {};
  if (transaction.creditsAmount > 0) {
    updates.creditsUsed = user.creditsUsed + transaction.creditsAmount;
    updates.creditsRemaining =
      user.creditsRemaining - transaction.creditsAmount;
  }

  if (isGenerationAction(transaction.action.toLowerCase() as CreditAction)) {
    updates.monthlyUsed = user.monthlyUsed + 1;
  }

  await prisma.$transaction([
    prisma.creditTransaction.update({
      where: { id: transactionId },
      data: { status: "CONFIRMED" },
    }),
    prisma.user.update({ where: { id: user.id }, data: updates }),
  ]);
}

export async function refundCreditUsage(transactionId: string) {
  const transaction = await prisma.creditTransaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) {
    throw new Error("Transaction introuvable.");
  }
  if (transaction.status !== "PENDING") {
    throw new Error("Impossible de rembourser une transaction déjà finalisée.");
  }

  await prisma.creditTransaction.update({
    where: { id: transactionId },
    data: { status: "REFUNDED" },
  });
}

export async function logAiUsage(params: {
  userId: string;
  provider: string;
  model: string;
  action: CreditAction;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedCost?: number;
  creditsCharged: number;
}) {
  return prisma.aiUsageLog.create({
    data: {
      userId: params.userId,
      provider: params.provider,
      model: params.model,
      action: params.action.toUpperCase() as any,
      estimatedInputTokens: params.estimatedInputTokens,
      estimatedOutputTokens: params.estimatedOutputTokens,
      estimatedCost: params.estimatedCost,
      creditsCharged: params.creditsCharged,
    },
  });
}

export async function getUserFromRequest(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (user) {
    return user;
  }

  const email = req.headers.get("x-rudyo-email")?.trim();
  if (email) {
    return getOrCreateUserByEmail(email);
  }

  return null;
}

export async function getCurrentUserFromRequest(req: NextRequest) {
  return getCurrentUser(req);
}
