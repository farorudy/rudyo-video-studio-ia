import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error:
            "Utilisateur non authentifié. Connectez-vous ou créez un compte pour consulter vos crédits Rudyo.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
      credits: {
        balance: user.creditsRemaining,
        total: user.creditsTotal,
        used: user.creditsUsed,
      },
      creditsTotal: user.creditsTotal,
      creditsUsed: user.creditsUsed,
      creditsRemaining: user.creditsRemaining,
      plan: user.plan,
      monthlyLimit: user.monthlyLimit,
      monthlyUsed: user.monthlyUsed,
      billingStatus: user.billingStatus,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur inconnue.";
    console.error("[rudyo-credits] erreur lecture solde", {
      message,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
