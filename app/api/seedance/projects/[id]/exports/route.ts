import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { enqueueMontageJob } from "@/lib/montage/queue";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  format: z.enum(["youtube-16-9", "tiktok-9-16", "instagram-1-1", "whatsapp"]),
  resolution: z.enum(["720p", "1080p"]),
  transitions: z.boolean().default(true),
  subtitles: z.boolean().default(false),
  artistLogoAssetId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  if (!(await prisma.videoProject.findFirst({ where: { id, userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  const exports = await prisma.finalExport.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, include: { montageJob: { select: { id: true, status: true, progress: true } } } });
  return NextResponse.json({ success: true, exports }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification persistante requise." }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paramètres d’export invalides." }, { status: 400 });
  try {
    const job = await enqueueMontageJob({
      projectId: id,
      userId: user.id,
      resolution: parsed.data.resolution,
      transition: parsed.data.transitions ? "crossfade" : "cut",
      subtitles: parsed.data.subtitles,
      format: parsed.data.format === "tiktok-9-16" ? "9:16" : parsed.data.format === "instagram-1-1" ? "1:1" : "16:9",
    });
    return NextResponse.json({ success: true, export: job.finalExport, job: { id: job.id, status: job.status, progress: job.progress } }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le montage n’a pas pu être placé dans la file d’attente.";
    return NextResponse.json({ error: message }, { status: message.includes("introuvable") ? 404 : 400 });
  }
}
