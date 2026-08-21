import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(), prompt: z.string().trim().min(10).max(5000).optional(),
  negativePrompt: z.string().trim().max(1500).nullable().optional(), modelId: z.string().trim().max(100).nullable().optional(),
  resolution: z.enum(["720p", "1080p"]).optional(), ratio: z.enum(["16:9", "9:16", "1:1", "adaptive"]).optional(),
  variantsRequested: z.number().int().min(1).max(4).optional(), seed: z.number().int().min(0).max(4_294_967_295).nullable().optional(),
  cameraFixed: z.boolean().optional(), generateAudio: z.boolean().optional(), watermark: z.boolean().optional(), locked: z.boolean().optional(),
  selectedVariantId: z.string().cuid().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  const scene = await prisma.storyboardScene.findFirst({ where: { id, project: { userId: user.id } } });
  if (!scene) return NextResponse.json({ error: "Scène introuvable." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paramètres de scène invalides." }, { status: 400 });
  const updated = await prisma.storyboardScene.update({ where: { id }, data: parsed.data });
  if (parsed.data.selectedVariantId) {
    await prisma.$transaction([
      prisma.generationVariant.updateMany({ where: { sceneId: id }, data: { selected: false } }),
      prisma.generationVariant.updateMany({ where: { id: parsed.data.selectedVariantId, sceneId: id }, data: { selected: true } }),
    ]);
  }
  return NextResponse.json({ success: true, scene: updated });
}
