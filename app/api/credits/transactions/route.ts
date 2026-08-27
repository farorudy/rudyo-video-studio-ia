import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur non authentifié." },
      { status: 401 },
    );
  }

  if (user.localSession) {
    return NextResponse.json({ transactions: [] });
  }

  const [creditTransactions, purchases, usages] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.creditUsage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const purchaseIds = new Set(
    purchases.map((purchase) => purchase.stripeSessionId),
  );
  const reservationIds = new Set(creditTransactions.map((transaction) => transaction.id));
  const transactions = [
    ...creditTransactions
      .filter((transaction) => {
        const metadata = transaction.metadata as
          | { stripeSessionId?: string }
          | null
          | undefined;
        return !metadata?.stripeSessionId || !purchaseIds.has(metadata.stripeSessionId);
      })
      .map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        action: transaction.action,
        creditsAmount: transaction.creditsAmount,
        description: transaction.description,
        status: transaction.status,
        statusLabel: transaction.status === "RESERVED" ? "Crédits réservés — génération en attente" : transaction.status === "CONFIRMED" ? "Débit confirmé" : transaction.status === "REFUNDED" ? "Crédits recrédités" : transaction.status,
        displayedAmount: transaction.status === "REFUNDED" ? Math.abs(transaction.creditsAmount) : transaction.creditsAmount,
        createdAt: transaction.createdAt,
      })),
    ...purchases.map((purchase) => ({
      id: purchase.id,
      type: "PURCHASE",
      action: "CHECKOUT",
      creditsAmount: purchase.tokens,
      description: `Achat Stripe - ${(purchase.amount / 100).toLocaleString(
        "fr-FR",
        { style: "currency", currency: "EUR" },
      )}`,
      status: purchase.status,
      statusLabel: purchase.status === "CONFIRMED" ? "Crédits ajoutés" : purchase.status === "PENDING" || purchase.status === "RESERVED" ? "Paiement en attente" : purchase.status,
      displayedAmount: purchase.tokens,
      createdAt: purchase.createdAt,
    })),
    ...usages.filter((usage) => !usage.reservationId || !reservationIds.has(usage.reservationId)).map((usage) => ({
      id: usage.id,
      type: "USAGE",
      action: "TOKEN_USAGE",
      creditsAmount: -usage.amount,
      description: usage.reason,
      status: "CONFIRMED",
      statusLabel: "Débit confirmé",
      displayedAmount: -usage.amount,
      createdAt: usage.createdAt,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 75);

  return NextResponse.json({ transactions });
}
