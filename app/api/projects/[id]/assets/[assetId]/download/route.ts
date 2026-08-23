import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectAccessStatus } from "@/lib/project-access";
import { openStorageStream } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileName(value: string) {
  return path.basename(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 140) || "rudyo-media";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });

    const { id: projectId, assetId } = await params;
    const project = await prisma.videoProject.findUnique({ where: { id: projectId }, select: { userId: true } });
    const access = projectAccessStatus(user.id, project?.userId);
    if (access === 404) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 });
    if (access === 403) return NextResponse.json({ success: false, error: "Ce projet ne vous appartient pas." }, { status: 403 });

    const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, projectId }, select: { storageKey: true, fileName: true, mimeType: true } });
    if (!asset) return NextResponse.json({ success: false, error: "Fichier introuvable dans ce projet." }, { status: 404 });
    const stored = await openStorageStream(asset.storageKey);
    if (!stored) return NextResponse.json({ success: false, error: "Le fichier n’existe plus dans le stockage." }, { status: 404 });

    const disposition = request.nextUrl.searchParams.get("preview") === "1" ? "inline" : "attachment";
    const fileName = safeFileName(asset.fileName);
    const headers = new Headers({
      "Content-Type": asset.mimeType,
      "Content-Disposition": `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (stored.size !== undefined) headers.set("Content-Length", String(stored.size));
    return new Response(stored.stream, { status: 200, headers });
  } catch (error) {
    console.error("Project asset download failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Téléchargement impossible pour le moment." }, { status: 500 });
  }
}
