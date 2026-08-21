import { NextRequest } from "next/server";
import {
  CreditAction as PrismaCreditAction,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { getCurrentUser, getInitialCredits, type SessionUser } from "@/lib/auth";
import { getActionCreditCost, type CreditAction } from "@/lib/credit-costs";
import { prisma } from "@/lib/prisma";

export type CreditReservation = {
  id: string;
  userId: string;
  action: string;
  amount: number;
  status: "reserved" | "confirmed" | "refunded";
  idempotencyKey?: string;
  description?: string;
  metadata?: unknown;
};

function isLocalUserId(userId: string | undefined) {
  return Boolean(userId?.startsWith("local:"));
}

function createLocalReservationId() {
  return `local_res_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function toPrismaCreditAction(action: string): PrismaCreditAction {
  const map: Partial<Record<CreditAction, PrismaCreditAction>> = {
    storyboard: PrismaCreditAction.STORYBOARD_SIMPLE,
    storyboard_complete: PrismaCreditAction.STORYBOARD_COMPLETE,
    script: PrismaCreditAction.SCRIPT_VOICEOVER,
    prompts: PrismaCreditAction.PROMPTS_VIDEO,
    subtitles: PrismaCreditAction.SUBTITLES,
    clip_package: PrismaCreditAction.CLIP_PACK,
  };

  return map[action as CreditAction] ?? PrismaCreditAction.OTHER;
}

function parseReservationArgs(args: any[]) {
  if (args.length === 1 && typeof args[0] === "object") {
    return {
      userId: args[0]?.userId as string | undefined,
      action: (args[0]?.action as string | undefined) ?? "project",
      amount: args[0]?.amount as number | undefined,
      description: args[0]?.description as string | undefined,
      metadata: args[0]?.metadata as unknown,
      idempotencyKey: args[0]?.idempotencyKey as string | undefined,
    };
  }

  return {
    userId: args[0] as string | undefined,
    action: (args[1] as string | undefined) ?? "project",
    amount: typeof args[2] === "number" ? (args[2] as number) : undefined,
    description: typeof args[2] === "string" ? (args[2] as string) : undefined,
    metadata: args[3] as unknown,
    idempotencyKey: args[4] as string | undefined,
  };
}

export async function getCurrentUserFromRequest(
  request: NextRequest,
): Promise<SessionUser | null> {
  return getCurrentUser(request);
}

export async function getCreditBalance(userId?: string) {
  if (!userId) {
    return 0;
  }

  if (isLocalUserId(userId)) {
    return getInitialCredits();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsRemaining: true },
  });

  return user?.creditsRemaining ?? 0;
}

export async function reserveCredits(...args: any[]): Promise<CreditReservation> {
  const { userId, action, amount, description, metadata, idempotencyKey } =
    parseReservationArgs(args);
  const finalAmount = amount ?? getActionCreditCost(action);

  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
    throw new Error("Clé d’idempotence de crédits invalide ou manquante.");
  }

  if (isLocalUserId(userId)) {
    return {
      id: createLocalReservationId(),
      userId,
      action,
      amount: finalAmount,
      status: "reserved",
      description,
      metadata,
      idempotencyKey,
    };
  }

  const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.userId !== userId || Math.abs(existing.creditsAmount) !== finalAmount) throw new Error("Clé d’idempotence déjà utilisée pour une autre opération.");
    return { id: existing.id, userId, action, amount: finalAmount, status: existing.status === TransactionStatus.CONFIRMED ? "confirmed" : existing.status === TransactionStatus.REFUNDED ? "refunded" : "reserved", description: existing.description, metadata, idempotencyKey };
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, creditsRemaining: { gte: finalAmount } },
      data: { credits: { decrement: finalAmount }, creditsRemaining: { decrement: finalAmount } },
    });
    if (updated.count !== 1) throw new Error("CREDITS_INSUFFICIENTS");
    return tx.creditTransaction.create({
      data: {
        userId,
        type: TransactionType.RESERVATION,
        action: toPrismaCreditAction(action),
        creditsAmount: -finalAmount,
        description: description ?? `Réservation crédits Rudyo : ${action}`,
        metadata: metadata === undefined ? undefined : (metadata as object),
        idempotencyKey,
        status: TransactionStatus.RESERVED,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return {
    id: transaction.id,
    userId,
    action,
    amount: finalAmount,
    status: "reserved",
    description: transaction.description,
    metadata,
    idempotencyKey,
  };
}

export async function confirmCreditUsage(...args: any[]) {
  const reservation = args[0];
  const reservationId =
    typeof reservation === "object" ? reservation?.id : reservation;

  if (!reservationId || String(reservationId).startsWith("local_res_")) {
    return {
      success: true,
      reservationId: reservationId ?? null,
      amount:
        typeof reservation === "object" ? reservation?.amount ?? 0 : args[1] ?? 0,
      status: "confirmed",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const pending = await tx.creditTransaction.findUnique({
      where: { id: String(reservationId) },
    });

    if (!pending) throw new Error("Réservation crédits introuvable.");
    if (pending.status === TransactionStatus.CONFIRMED) return pending;
    if (pending.status !== TransactionStatus.RESERVED) throw new Error("Réservation crédits déjà traitée.");

    const amount = Math.abs(pending.creditsAmount);
    const transitioned = await tx.creditTransaction.updateMany({
      where: { id: pending.id, status: TransactionStatus.RESERVED },
      data: { status: TransactionStatus.CONFIRMED, confirmedAt: new Date(), providerTaskId: args[1]?.providerTaskId },
    });
    if (transitioned.count !== 1) throw new Error("Réservation crédits déjà traitée.");
    await tx.user.update({ where: { id: pending.userId }, data: { creditsUsed: { increment: amount } } });

    await tx.creditUsage.create({
      data: {
        userId: pending.userId,
        amount,
        reason: pending.description,
        metadata: {
          reservationId: pending.id,
          action: pending.action,
        },
        reservationId: pending.id,
      },
    });
    return tx.creditTransaction.findUniqueOrThrow({ where: { id: pending.id } });
  });

  return {
    success: true,
    reservationId: result.id,
    amount: Math.abs(result.creditsAmount),
    status: "confirmed",
  };
}

export async function refundCreditUsage(...args: any[]) {
  const reservation = args[0];
  const reservationId =
    typeof reservation === "object" ? reservation?.id : reservation;

  if (!reservationId || String(reservationId).startsWith("local_res_")) {
    return {
      success: true,
      reservationId: reservationId ?? null,
      amount:
        typeof reservation === "object" ? reservation?.amount ?? 0 : args[1] ?? 0,
      status: "refunded",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.creditTransaction.findUnique({
      where: { id: String(reservationId) },
    });

    if (!transaction) {
      throw new Error("Reservation credits introuvable.");
    }

    const amount = Math.abs(transaction.creditsAmount);

    if (transaction.status === TransactionStatus.REFUNDED) return transaction;
    if (transaction.status === TransactionStatus.CONFIRMED || transaction.status === TransactionStatus.RESERVED) {
      const wasConfirmed = transaction.status === TransactionStatus.CONFIRMED;
      const transitioned = await tx.creditTransaction.updateMany({
        where: { id: transaction.id, status: transaction.status },
        data: { status: TransactionStatus.REFUNDED, refundedAt: new Date() },
      });
      if (transitioned.count !== 1) return tx.creditTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
      await tx.user.update({
        where: { id: transaction.userId },
        data: {
          credits: { increment: amount },
          creditsRemaining: { increment: amount },
          ...(wasConfirmed ? { creditsUsed: { decrement: amount } } : {}),
        },
      });
      return tx.creditTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
    }

    return transaction;
  });

  return {
    success: true,
    reservationId: result.id,
    amount: Math.abs(result.creditsAmount),
    status: "refunded",
  };
}

export async function logAiUsage(...args: any[]) {
  const payload =
    args.length === 1 && typeof args[0] === "object"
      ? args[0]
      : {
          userId: args[0],
          action: args[1],
          provider: args[2],
          metadata: args[3],
        };

  if (!payload?.userId || isLocalUserId(payload.userId)) {
    return {
      success: true,
      logged: false,
      ...payload,
    };
  }

  const action = toPrismaCreditAction(payload.action ?? "project");
  await prisma.aiUsageLog.create({
    data: {
      userId: payload.userId,
      provider: payload.provider ?? "unknown",
      model: payload.model ?? "unknown",
      action,
      quality: payload.quality,
      estimatedInputTokens: payload.estimatedInputTokens,
      estimatedOutputTokens: payload.estimatedOutputTokens,
      estimatedCost: payload.estimatedCost,
      creditsCharged: payload.creditsCharged ?? 0,
      success: payload.success ?? true,
      errorMessage: payload.errorMessage,
    },
  });

  return {
    success: true,
    logged: true,
    ...payload,
  };
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
  metadata?: unknown,
) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  if (isLocalUserId(userId)) {
    return {
      success: true,
      userId,
      balance: Math.max(0, getInitialCredits() - amount),
      amount,
      description,
      metadata,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, creditsRemaining: { gte: amount } },
      data: {
        credits: { decrement: amount },
        creditsRemaining: { decrement: amount },
        creditsUsed: { increment: amount },
      },
    });

    if (updated.count === 0) {
      throw new Error("CREDITS_INSUFFICIENTS");
    }

    await tx.creditTransaction.create({
      data: {
        userId,
        type: TransactionType.USAGE,
        action: PrismaCreditAction.OTHER,
        creditsAmount: -amount,
        description: description ?? "Utilisation credits Rudyo",
        metadata: metadata === undefined ? undefined : (metadata as object),
        status: TransactionStatus.CONFIRMED,
      },
    });

    await tx.creditUsage.create({
      data: {
        userId,
        amount,
        reason: description ?? "Utilisation credits Rudyo",
        metadata: metadata === undefined ? undefined : (metadata as object),
      },
    });

    return tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditsRemaining: true },
    });
  });

  return {
    success: true,
    userId,
    balance: result.creditsRemaining,
    amount,
    description,
    metadata,
  };
}

export async function refundCredits(
  userId: string | undefined,
  amount: number,
  description?: string,
  metadata?: unknown,
) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  if (isLocalUserId(userId)) {
    return {
      success: true,
      userId,
      balance: getInitialCredits(),
      amount,
      description,
      metadata,
    };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      credits: { increment: amount },
      creditsRemaining: { increment: amount },
      creditsUsed: { decrement: amount },
    },
    select: { creditsRemaining: true },
  });

  return {
    success: true,
    userId,
    balance: user.creditsRemaining,
    amount,
    description,
    metadata,
  };
}

export async function addCredits(
  userId: string | undefined,
  amount: number,
  description?: string,
  metadata?: unknown,
) {
  if (!userId) {
    throw new Error("Utilisateur non authentifié.");
  }

  if (isLocalUserId(userId)) {
    return {
      success: true,
      userId,
      balance: getInitialCredits() + amount,
      amount,
      description,
      metadata,
    };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      credits: { increment: amount },
      creditsTotal: { increment: amount },
      creditsRemaining: { increment: amount },
    },
    select: { creditsRemaining: true },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      type: TransactionType.BONUS,
      action: PrismaCreditAction.OTHER,
      creditsAmount: amount,
      description: description ?? "Ajout credits Rudyo",
      metadata: metadata === undefined ? undefined : (metadata as object),
      status: TransactionStatus.CONFIRMED,
    },
  });

  return {
    success: true,
    userId,
    balance: user.creditsRemaining,
    amount,
    description,
    metadata,
  };
}

export { getActionCreditCost };
