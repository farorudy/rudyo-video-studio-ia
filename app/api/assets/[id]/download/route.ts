import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openStorageStream, storageKeyFromClientRef } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanDownloadName(value: string) {
  const normalized = path.basename(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return normalized.slice(0, 140) || "rudyo-resultat.mp4";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ error: "Vous devez vous connecter pour télécharger ce résultat." }, { status: 401 });
    const { id } = await params;

  const asset = await prisma.mediaAsset.findUnique({ where: { id }, include: { project: { select: { userId: true, title: true } } } });
  let ownerId = asset?.project.userId;
  let storageKey = asset?.storageKey || null;
  let mimeType = asset?.mimeType || "application/octet-stream";
  let fileName = asset ? `rudyo-${asset.project.title}-${asset.fileName}` : "";

  if (!asset) {
    const task = await prisma.generationTask.findUnique({
      where: { id },
      include: { project: { select: { userId: true, title: true } }, scene: { select: { order: true } } },
    });
    if (task) {
      if (task.status !== "SUCCEEDED") return NextResponse.json({ error: "Le résultat est encore en cours de génération." }, { status: 409 });
      ownerId = task.project.userId;
      storageKey = storageKeyFromClientRef(task.permanentVideoUrl);
      mimeType = "video/mp4";
      fileName = `rudyo-${task.project.title}-scene-${String(task.scene.order).padStart(2, "0")}.mp4`;
    }
  }

  if (!ownerId) {
    const finalExport = await prisma.finalExport.findUnique({ where: { id }, include: { project: { select: { userId: true, title: true } } } });
    if (finalExport) {
      if (finalExport.status !== "COMPLETED") return NextResponse.json({ error: "Le résultat est encore en cours de génération." }, { status: 409 });
      ownerId = finalExport.project.userId;
      storageKey = finalExport.storageKey || storageKeyFromClientRef(finalExport.url);
      mimeType = "video/mp4";
      fileName = `rudyo-${finalExport.project.title}-export-final.mp4`;
    }
  }

  if (!ownerId) return NextResponse.json({ error: "Le fichier demandé n’est plus disponible." }, { status: 404 });
  if (ownerId !== user.id) return NextResponse.json({ error: "Ce résultat ne vous appartient pas." }, { status: 403 });
  if (!storageKey) return NextResponse.json({ error: "Le fichier demandé n’est plus disponible." }, { status: 404 });

    const stored = await openStorageStream(storageKey);
    if (!stored) return NextResponse.json({ error: "Le fichier demandé n’est plus disponible." }, { status: 404 });
    const cleanName = cleanDownloadName(fileName);
    const headers = new Headers({
      "Content-Type": mimeType,
      "Content-Disposition": `${request.nextUrl.searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename="${cleanName}"; filename*=UTF-8''${encodeURIComponent(cleanName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (stored.size !== undefined) headers.set("Content-Length", String(stored.size));
    return new Response(stored.stream, { headers });
  } catch (error) {
    console.error("Result download failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Téléchargement impossible pour le moment." }, { status: 500 });
  }
}
