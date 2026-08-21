import { FinalExportStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
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
  const exports = await prisma.finalExport.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, exports });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification persistante requise." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.videoProject.findFirst({
    where: { id, userId: user.id },
    include: { mediaAssets: true, scenes: { include: { variants: { where: { selected: true } } } } },
  });
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paramètres d’export invalides." }, { status: 400 });
  if (!project.mediaAssets.some((asset) => asset.type === "AUDIO")) return NextResponse.json({ error: "Importez la chanson originale avant le rendu final." }, { status: 400 });
  if (project.scenes.length === 0 || project.scenes.some((scene) => scene.variants.length === 0)) return NextResponse.json({ error: "Sélectionnez une variante validée pour chaque scène." }, { status: 400 });

  const finalExport = await prisma.finalExport.create({ data: { projectId: id, format: parsed.data.format, resolution: parsed.data.resolution, settings: parsed.data, status: FinalExportStatus.QUEUED } });
  const workerUrl = process.env.FINAL_RENDER_WORKER_URL?.trim();
  const workerToken = process.env.FINAL_RENDER_WORKER_TOKEN?.trim();
  if (!workerUrl || !workerToken) {
    await prisma.finalExport.update({ where: { id: finalExport.id }, data: { status: FinalExportStatus.DRAFT, errorMessage: "Worker de rendu non configuré." } });
    return NextResponse.json({ error: "Le worker FFmpeg d’arrière-plan doit être configuré avant le rendu final.", exportId: finalExport.id }, { status: 503 });
  }
  try {
    const url = new URL(workerUrl);
    if (url.protocol !== "https:") throw new Error("URL worker non sécurisée");
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${workerToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ exportId: finalExport.id, projectId: id }) });
    if (!response.ok) throw new Error(`Worker indisponible (${response.status})`);
  } catch {
    await prisma.finalExport.update({ where: { id: finalExport.id }, data: { status: FinalExportStatus.FAILED, errorMessage: "Le worker de rendu n’a pas accepté la tâche." } });
    return NextResponse.json({ error: "Le rendu n’a pas pu être placé dans la file d’attente." }, { status: 502 });
  }
  return NextResponse.json({ success: true, export: finalExport }, { status: 202 });
}

