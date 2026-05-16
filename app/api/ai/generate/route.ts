import { NextRequest, NextResponse } from "next/server";
import {
  CREDIT_COSTS,
  CREDIT_TOOL_LABELS,
  type CreditTool,
} from "@/lib/credit-costs";
import { generateAI } from "@/lib/ai-provider";
import {
  confirmCreditUsage,
  getCurrentUserFromRequest,
  logAiUsage,
  refundCreditUsage,
  reserveCredits,
} from "@/lib/credit-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPrompt(tool: CreditTool, input: any) {
  const label = CREDIT_TOOL_LABELS[tool];

  return `
Tu es Rudyo Video Studio IA, un assistant de production video professionnel.

Mission :
Creer une reponse complete pour le modele suivant :
${label}

Informations utilisateur :
${JSON.stringify(input, null, 2)}

Consignes :
- Repondre en francais clair.
- Structurer la reponse avec des titres.
- Donner un resultat directement exploitable.
- Adapter la reponse au type de video demande.
- Si le contenu concerne une video, proposer des plans, scenes, textes ecran, ambiance, transitions et prompts video IA.
- Ne pas mentionner les cles API.
- Ne pas dire que tu es une IA.

Format attendu :
1. Resume du projet
2. Proposition creative
3. Structure detaillee
4. Recommandations de production
5. Prompts ou textes utilisables si necessaire
`;
}

export async function POST(request: NextRequest) {
  let reservationId: string | null = null;

  try {
    const body = await request.json();
    const user = await getCurrentUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Utilisateur non authentifie. Connectez-vous ou creez un compte pour utiliser Rudyo Video Studio IA.",
        },
        { status: 401 },
      );
    }

    const tool = body.tool as CreditTool;
    const input = body.input ?? {};

    if (!tool || !(tool in CREDIT_COSTS)) {
      return NextResponse.json(
        {
          success: false,
          error: "Modele de generation invalide.",
        },
        { status: 400 },
      );
    }

    const creditCost = CREDIT_COSTS[tool];
    const reservation = await reserveCredits({
      userId: user.id,
      action: tool,
      amount: creditCost,
      description: `Generation Rudyo : ${CREDIT_TOOL_LABELS[tool]}`,
      metadata: { tool },
    });
    reservationId = reservation.id;

    const prompt = buildPrompt(tool, input);
    const { provider, result } = await generateAI(prompt);

    await confirmCreditUsage(reservation.id);
    await logAiUsage({
      userId: user.id,
      provider,
      model: process.env.OPENAI_MODEL ?? "unknown",
      action: tool,
      creditsCharged: creditCost,
    });

    return NextResponse.json({
      success: true,
      provider,
      tool,
      creditsUsed: creditCost,
      result,
    });
  } catch (error: any) {
    console.error("Erreur /api/ai/generate :", error);

    if (reservationId) {
      await refundCreditUsage(reservationId).catch(() => undefined);
    }

    if (error?.message === "CREDITS_INSUFFICIENTS") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Credits insuffisants. Rechargez votre compte ou choisissez une generation moins couteuse.",
          redirectTo: "/credits",
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Erreur lors de la generation IA. Aucun contenu n'a ete produit.",
      },
      { status: 500 },
    );
  }
}
