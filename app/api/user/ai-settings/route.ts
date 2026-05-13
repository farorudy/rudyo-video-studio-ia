import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AiSettingsPayload = {
  preferredAiProvider?: string;
  allowPremiumAi?: boolean;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    preferredAiProvider: user.preferredAiProvider || null,
    allowPremiumAi: user.allowPremiumAi,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 },
    );
  }

  const payload = (await req.json()) as AiSettingsPayload;
  const data: Record<string, unknown> = {};

  if (typeof payload.preferredAiProvider === "string") {
    data.preferredAiProvider = payload.preferredAiProvider.trim() || null;
  }

  if (typeof payload.allowPremiumAi === "boolean") {
    data.allowPremiumAi = payload.allowPremiumAi;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({
    success: true,
    preferredAiProvider: updated.preferredAiProvider || null,
    allowPremiumAi: updated.allowPremiumAi,
  });
}
