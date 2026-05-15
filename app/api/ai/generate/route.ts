import { NextResponse } from "next/server";
import {
  CREDIT_COSTS,
  CREDIT_TOOL_LABELS,
  type CreditTool,
} from "@/lib/credit-costs";
import { generateAI } from "@/lib/ai-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPrompt(tool: CreditTool, input: any) {
  const label = CREDIT_TOOL_LABELS[tool];

  return `
Tu es Rudyo Video Studio IA, un assistant de production vidéo professionnel.

Mission :
Créer une réponse complète pour le modèle suivant :
${label}

Informations utilisateur :
${JSON.stringify(input, null, 2)}

Consignes :
- Répondre en français clair.
- Structurer la réponse avec des titres.
- Donner un résultat directement exploitable.
- Adapter la réponse au type de vidéo demandé.
- Si le contenu concerne une vidéo, proposer des plans, scènes, textes écran, ambiance, transitions et prompts vidéo IA.
- Ne pas mentionner les clés API.
- Ne pas dire que tu es une IA.

Format attendu :
1. Résumé du projet
2. Proposition créative
3. Structure détaillée
4. Recommandations de production
5. Prompts ou textes utilisables si nécessaire
`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const tool = body.tool as CreditTool;
    const input = body.input ?? {};

    if (!tool || !(tool in CREDIT_COSTS)) {
      return NextResponse.json(
        {
          success: false,
          error: "Modèle de génération invalide.",
        },
        { status: 400 }
      );
    }

    const creditCost = CREDIT_COSTS[tool];

    /**
     * Version de départ :
     * On simule les crédits pour valider l'expérience utilisateur.
     * Remplacement futur :
     * - getCurrentUser()
     * - getCreditBalance(userId)
     * - debitCredits(userId)
     * - refundCredits(userId)
     */
    const fakeCreditBalance = 18;

    if (fakeCreditBalance < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: "Crédits insuffisants.",
          requiredCredits: creditCost,
          currentCredits: fakeCreditBalance,
          redirectTo: "/credits",
        },
        { status: 402 }
      );
    }

    const prompt = buildPrompt(tool, input);
    const { provider, result } = await generateAI(prompt);

    return NextResponse.json({
      success: true,
      provider,
      tool,
      creditsUsed: creditCost,
      result,
    });
  } catch (error: any) {
    console.error("Erreur /api/ai/generate :", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Erreur lors de la génération IA. Aucun contenu n’a été produit.",
      },
      { status: 500 }
    );
  }
}
