import { NextRequest } from "next/server";
import { getActionCreditCost } from "@/lib/credit-costs";

export type CreditReservation = {
  id: string;
  userId: string;
  action: string;
  amount: number;
  status: "reserved" | "confirmed" | "refunded";
  description?: string;
  metadata?: unknown;
};

function createReservationId() {
  return `res_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function getCurrentUserFromRequest(_request?: Request | NextRequest) {
  return {
    id: "demo-user",
    email: "demo@rudyo.local",
    name: "Utilisateur Rudyo",
  };
}

export async function getCreditBalance(_userId?: string) {
  return 18;
}

export async function reserveCredits(...args: any[]) {
  let userId = "demo-user";
  let action = "project";
  let amount: number | undefined;
  let description: string | undefined;
  let metadata: unknown;

  if (args.length === 1 && typeof args[0] === "object") {
    userId = args[0]?.userId || "demo-user";
    action = args[0]?.action || "project";
    amount = args[0]?.amount;
    description = args[0]?.description;
    metadata = args[0]?.metadata;
  } else {
    userId = args[0] || "demo-user";
    action = args[1] || "project";
    amount = typeof args[2] === "number" ? args[2] : undefined;
    description = typeof args[2] === "string" ? args[2] : undefined;
    metadata = args[3];
  }

  const finalAmount = amount ?? getActionCreditCost(action);
  const balance = await getCreditBalance(userId);

  if (balance < finalAmount) {
    throw new Error("CREDITS_INSUFFICIENTS");
  }

  const reservation: CreditReservation = {
    id: createReservationId(),
    userId,
    action,
    amount: finalAmount,
    status: "reserved",
    description,
    metadata,
  };

  return reservation;
}

export async function confirmCreditUsage(...args: any[]) {
  const reservation = args[0];

  return {
    success: true,
    reservationId:
      typeof reservation === "object" ? reservation?.id ?? null : reservation ?? null,
    amount:
      typeof reservation === "object" ? reservation?.amount ?? 0 : args[1] ?? 0,
    status: "confirmed",
  };
}

export async function refundCreditUsage(...args: any[]) {
  const reservation = args[0];

  return {
    success: true,
    reservationId:
      typeof reservation === "object" ? reservation?.id ?? null : reservation ?? null,
    amount:
      typeof reservation === "object" ? reservation?.amount ?? 0 : args[1] ?? 0,
    status: "refunded",
  };
}

export async function logAiUsage(...args: any[]) {
  if (args.length === 1 && typeof args[0] === "object") {
    return {
      success: true,
      logged: true,
      ...args[0],
    };
  }

  return {
    success: true,
    logged: true,
    userId: args[0],
    action: args[1],
    provider: args[2],
    metadata: args[3],
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
  metadata?: unknown
) {
  return {
    success: true,
    userId,
    balance: 18 - amount,
    amount,
    description,
    metadata,
  };
}

export async function refundCredits(
  userId: string | undefined,
  amount: number,
  description?: string,
  metadata?: unknown
) {
  return {
    success: true,
    userId,
    balance: 18 + amount,
    amount,
    description,
    metadata,
  };
}

export async function addCredits(
  userId: string | undefined,
  amount: number,
  description?: string,
  metadata?: unknown
) {
  return {
    success: true,
    userId,
    balance: 18 + amount,
    amount,
    description,
    metadata,
  };
}

export { getActionCreditCost };