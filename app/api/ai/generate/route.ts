import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateWithBestProvider } from "@/lib/ai/generate";
import { CreditAction } from "@/lib/credit-costs";

type ApiGenerateRequest = {
  action: CreditAction;
  prompt: string;
  quality?: "economy" | "balanced" | "premium";
  modelOverride?: string;
  preferredProvider?: string;
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Connectez-vous pour utiliser l’IA Rudyo." },
      { status: 401 },
    );
  }

  const body = (await req.json()) as ApiGenerateRequest;
  if (!body?.action || !body?.prompt) {
    return NextResponse.json(
      { error: "L’action IA et le prompt sont requis." },
      { status: 400 },
    );
  }

  try {
    const response = await generateWithBestProvider({
      action: body.action,
      prompt: body.prompt,
      quality: body.quality,
      modelOverride: body.modelOverride,
      preferredProvider: body.preferredProvider,
      userId: user.id,
      userPlan: user.plan,
      allowPremiumAi: user.allowPremiumAi,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Erreur génération IA :", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la génération IA.",
      },
      { status: 500 },
    );
  }
}
