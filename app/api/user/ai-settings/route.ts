import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiSettingsSchema, providerAllowedForPlan } from "@/lib/ai-settings-policy";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Authentification vérifiée requise." }, { status: 401 });
  return NextResponse.json({
    success: true,
    preferredAiProvider: user.preferredAiProvider || null,
    allowPremiumAi: user.allowPremiumAi,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Authentification vérifiée requise." }, { status: 401 });

  const parsed = aiSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Seul le fournisseur IA autorisé peut être modifié." },
      { status: 400 },
    );
  }
  if (!providerAllowedForPlan(user.plan, parsed.data.preferredAiProvider)) {
    return NextResponse.json({ error: "Ce fournisseur n’est pas disponible avec votre formule." }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { preferredAiProvider: parsed.data.preferredAiProvider },
    select: { preferredAiProvider: true, allowPremiumAi: true },
  });
  return NextResponse.json({ success: true, ...updated });
}
