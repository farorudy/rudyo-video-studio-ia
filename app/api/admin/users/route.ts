import {
  BillingStatus,
  CreditAction,
  TransactionStatus,
  TransactionType,
  UserPlan,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminFromRequest,
  isSameOriginRequest,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_PLANS = new Set(Object.values(UserPlan));
const BILLING_STATUSES = new Set(Object.values(BillingStatus));

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Accès administrateur requis." },
    { status: 401 },
  );
}

export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return unauthorized();
  }

  const [users, usersCount, credits, aiUsageCount, recentAudit] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 250,
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          creditsTotal: true,
          creditsUsed: true,
          creditsRemaining: true,
          monthlyLimit: true,
          monthlyUsed: true,
          billingStatus: true,
          allowPremiumAi: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count(),
      prisma.user.aggregate({
        _sum: { creditsRemaining: true, creditsUsed: true },
      }),
      prisma.aiUsageLog.count(),
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          action: true,
          targetUserId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

  return NextResponse.json({
    success: true,
    admin: { email: admin.email },
    stats: {
      users: usersCount,
      creditsRemaining: credits._sum.creditsRemaining ?? 0,
      creditsUsed: credits._sum.creditsUsed ?? 0,
      aiUsage: aiUsageCount,
    },
    users,
    recentAudit,
  });
}

export async function PATCH(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return unauthorized();
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { success: false, error: "Origine de requête invalide." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    action?: string;
    amount?: number;
    plan?: UserPlan;
    billingStatus?: BillingStatus;
  } | null;
  const userId = body?.userId?.trim();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Utilisateur manquant." },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: userId },
      });
      if (!target) {
        throw new Error("USER_NOT_FOUND");
      }

      if (body?.action === "adjust_credits") {
        const amount = Number(body.amount);
        if (
          !Number.isInteger(amount) ||
          amount === 0 ||
          Math.abs(amount) > 100_000
        ) {
          throw new Error("INVALID_CREDIT_AMOUNT");
        }
        if (amount < 0 && target.creditsRemaining < Math.abs(amount)) {
          throw new Error("INSUFFICIENT_USER_CREDITS");
        }

        const updated = await transaction.user.update({
          where: { id: userId },
          data: {
            credits: { increment: amount },
            creditsTotal: { increment: amount },
            creditsRemaining: { increment: amount },
          },
        });
        await transaction.creditTransaction.create({
          data: {
            userId,
            type: amount > 0 ? TransactionType.BONUS : TransactionType.USAGE,
            action: CreditAction.OTHER,
            creditsAmount: amount,
            description:
              amount > 0
                ? "Crédits accordés par l'administration"
                : "Crédits retirés par l'administration",
            metadata: { adminSubject: admin.subject },
            status: TransactionStatus.CONFIRMED,
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            adminSubject: admin.subject,
            action: "adjust_credits",
            targetUserId: userId,
            metadata: { amount, previousBalance: target.creditsRemaining },
          },
        });
        return updated;
      }

      if (body?.action === "set_plan" && USER_PLANS.has(body.plan as UserPlan)) {
        const plan = body.plan as UserPlan;
        const updated = await transaction.user.update({
          where: { id: userId },
          data: { plan, allowPremiumAi: plan !== UserPlan.FREE },
        });
        await transaction.adminAuditLog.create({
          data: {
            adminSubject: admin.subject,
            action: "set_plan",
            targetUserId: userId,
            metadata: { previousPlan: target.plan, plan },
          },
        });
        return updated;
      }

      if (
        body?.action === "set_billing_status" &&
        BILLING_STATUSES.has(body.billingStatus as BillingStatus)
      ) {
        const billingStatus = body.billingStatus as BillingStatus;
        const updated = await transaction.user.update({
          where: { id: userId },
          data: { billingStatus },
        });
        await transaction.adminAuditLog.create({
          data: {
            adminSubject: admin.subject,
            action: "set_billing_status",
            targetUserId: userId,
            metadata: {
              previousStatus: target.billingStatus,
              billingStatus,
            },
          },
        });
        return updated;
      }

      if (body?.action === "reset_monthly_usage") {
        const updated = await transaction.user.update({
          where: { id: userId },
          data: { monthlyUsed: 0 },
        });
        await transaction.adminAuditLog.create({
          data: {
            adminSubject: admin.subject,
            action: "reset_monthly_usage",
            targetUserId: userId,
            metadata: { previousMonthlyUsed: target.monthlyUsed },
          },
        });
        return updated;
      }

      throw new Error("INVALID_ADMIN_ACTION");
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        plan: user.plan,
        creditsTotal: user.creditsTotal,
        creditsUsed: user.creditsUsed,
        creditsRemaining: user.creditsRemaining,
        monthlyUsed: user.monthlyUsed,
        billingStatus: user.billingStatus,
        allowPremiumAi: user.allowPremiumAi,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const knownErrors: Record<string, { status: number; error: string }> = {
      USER_NOT_FOUND: { status: 404, error: "Utilisateur introuvable." },
      INVALID_CREDIT_AMOUNT: {
        status: 400,
        error: "Le montant doit être un entier compris entre -100000 et 100000.",
      },
      INSUFFICIENT_USER_CREDITS: {
        status: 409,
        error: "Le compte ne possède pas assez de crédits à retirer.",
      },
      INVALID_ADMIN_ACTION: {
        status: 400,
        error: "Action administrateur invalide.",
      },
    };
    const known = knownErrors[message];
    if (known) {
      return NextResponse.json(
        { success: false, error: known.error },
        { status: known.status },
      );
    }
    console.error("[rudyo-admin] modification utilisateur échouée", {
      message,
    });
    return NextResponse.json(
      { success: false, error: "Modification impossible." },
      { status: 500 },
    );
  }
}
