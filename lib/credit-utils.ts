import { NextRequest } from "next/server";
import { getActionCreditCost } from "@/lib/credit-costs";

export type CreditReservation = {
  id: string;
  userId: string;
  action: string;
  amount: number;
  status: "reserved" | "confirmed" | "refunded";
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

export async function reserveCredits(params: {
  userId?: string;
  action?: string;
  amount?: number;
  description?: string;
  metadata?: unknown;
}) {
  const amount =
    params.amount ?? getActionCreditCost(params.action || "project");

  const balance = await getCreditBalance(params.userId);

  if (balance < amount) {
    throw new Error("CREDITS_INSUFFICIENTS");
  }

  const reservation: CreditReservation = {
    id: createReservationId(),
    userId: params.userId || "demo-user",
    action: params.action || "project",
    amount,
    status: "reserved",
  };

  return reservation;
}

export async function confirmCreditUsage(reservationOrParams: any) {
  return {
    success: true,
    reservationId: reservationOrParams?.id ?? null,
    amount: reservationOrParams?.amount ?? 0,
    status: "confirmed",
  };
}

export async function refundCreditUsage(reservationOrParams: any) {
  return {
    success: true,
    reservationId: reservationOrParams?.id ?? null,
    amount: reservationOrParams?.amount ?? 0,
    status: "refunded",
  };
}

export async function logAiUsage(params: any) {
  return {
    success: true,
    logged: true,
    ...params,
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
