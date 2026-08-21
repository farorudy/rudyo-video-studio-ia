import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const sceneSchema = z.object({
  title: z.string().trim().min(1).max(120),
  startTimeSeconds: z.number().min(0).max(1800),
  endTimeSeconds: z.number().positive().max(1800),
  prompt: z.string().trim().min(10).max(5000),
  negativePrompt: z.string().trim().max(1500).optional(),
  mood: z.string().trim().max(300).optional(),
  location: z.string().trim().max(300).optional(),
  cameraMovement: z.string().trim().max(300).optional(),
  modelId: z.string().trim().max(100).optional(),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  ratio: z.enum(["16:9", "9:16", "1:1", "adaptive"]).default("16:9"),
  variantsRequested: z.number().int().min(1).max(4).default(1),
  seed: z.number().int().min(0).max(4_294_967_295).optional(),
  cameraFixed: z.boolean().default(false),
  generateAudio: z.boolean().default(false),
  watermark: z.boolean().default(false),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  if (!(await prisma.videoProject.findFirst({ where: { id, userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const items = Array.isArray(body?.scenes) ? body.scenes : [body];
  const parsed = z.array(sceneSchema).min(1).max(100).safeParse(items);
  if (!parsed.success) return NextResponse.json({ error: "Découpage des scènes invalide.", details: parsed.error.flatten() }, { status: 400 });
  const current = await prisma.storyboardScene.count({ where: { projectId: id } });
  const scenes = await prisma.$transaction(parsed.data.map((scene, index) => {
    const durationSeconds = Math.round(scene.endTimeSeconds - scene.startTimeSeconds);
    if (durationSeconds <= 0) throw new Error("Le timecode de fin doit être supérieur au début.");
    return prisma.storyboardScene.create({ data: { ...scene, durationSeconds, projectId: id, order: current + index + 1, status: "READY" } });
  }));
  return NextResponse.json({ success: true, scenes }, { status: 201 });
}

