import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CREDIT_COSTS,
  CREDIT_TOOLS,
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
import { enforceApiRateLimit, readJsonWithLimit, requireIdempotencyKey } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  tool: z.string().refine((value): value is CreditTool => CREDIT_TOOLS.includes(value as CreditTool)),
  input: z.record(z.string(), z.unknown()).default({}),
}).strict();

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

export async function POST(request: NextRequest) {
  let reservationId: string | null = null;

  try {
    const user = await getCurrentUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Utilisateur non authentifié. Connectez-vous ou créez un compte pour utiliser Rudyo Video Studio IA.",
        },
        { status: 401 },
      );
    }

    await enforceApiRateLimit(request, "ai-generate", user.id, 10, 60_000);
    const parsed = requestSchema.safeParse(await readJsonWithLimit<unknown>(request, 64 * 1024));
    if (!parsed.success) return NextResponse.json({ success: false, error: "Requête de génération invalide." }, { status: 400 });

    const tool = parsed.data.tool;
    const input = parsed.data.input;

    if (!tool || !(tool in CREDIT_COSTS)) {
      return NextResponse.json(
        {
          success: false,
          error: "Modèle de génération invalide.",
        },
        { status: 400 },
      );
    }

    if (tool === "seedance_video") {
      return NextResponse.json(
        {
          success: false,
          error: "Une vidéo Seedance doit être créée depuis le Studio Seedance afin d’utiliser le workflow BytePlus asynchrone.",
          redirectTo: "/studio-clip-seedance",
        },
        { status: 409 },
      );
    }

    const creditCost = CREDIT_COSTS[tool];
    const reservation = await reserveCredits({
      userId: user.id,
      action: tool,
      amount: creditCost,
      description: `Génération Rudyo : ${CREDIT_TOOL_LABELS[tool]}`,
      metadata: { tool },
      idempotencyKey: requireIdempotencyKey(request),
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
            "Crédits insuffisants. Choisissez un modèle moins cher ou rechargez votre compte.",
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
          "Erreur lors de la génération IA. Aucun contenu n'a été produit.",
      },
      { status: 500 },
    );
  }
}
