import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { startSceneGeneration } from "@/lib/seedance/service";

const schema = z.object({
  idempotencyKey: z.string().min(16).max(200),
  requestedModelId: z.string().max(100).optional(),
  preview: z.boolean().optional(), economicalDraft: z.boolean().optional(),
  referenceAssetIds: z.array(z.string().cuid()).max(12).optional(),
  confirmCost: z.literal(true),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification persistante requise." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirmez le coût et les paramètres de génération." }, { status: 400 });
  const { id } = await params;
  try {
    const task = await startSceneGeneration({ ...parsed.data, sceneId: id, userId: user.id });
    return NextResponse.json({ success: true, task, demo: task.provider === "byteplus-demo" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de lancer la génération.";
    const status = message.includes("crédit") || message.includes("budget") || message.includes("plafond") ? 402 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

