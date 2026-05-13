import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Utilisateur non authentifié." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    creditsTotal: user.creditsTotal,
    creditsUsed: user.creditsUsed,
    creditsRemaining: user.creditsRemaining,
    plan: user.plan,
    monthlyLimit: user.monthlyLimit,
    monthlyUsed: user.monthlyUsed,
    billingStatus: user.billingStatus,
  });
}
