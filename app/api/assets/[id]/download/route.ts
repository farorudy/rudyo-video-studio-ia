import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyDownloadSignature } from "@/lib/media-access";
import { parseSingleByteRange, RangeNotSatisfiableError } from "@/lib/http-range";
import { prisma } from "@/lib/prisma";
import { getStorageSize, openStorageRange, openStorageStream, storageKeyFromClientRef } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanDownloadName(value: string) {
  const normalized = path.basename(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return normalized.slice(0, 140) || "rudyo-resultat.mp4";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const expires = Number(request.nextUrl.searchParams.get("expires"));
    const supplied = request.nextUrl.searchParams.get("signature") || "";
    const signed = Boolean(supplied) && verifyDownloadSignature(id, expires, supplied);
    const user = signed ? null : await getCurrentUser(request);
    if (!signed && (!user || user.localSession)) return NextResponse.json({ error: "Vous devez vous connecter pour télécharger ce résultat." }, { status: 401 });

  const asset = await prisma.mediaAsset.findUnique({ where: { id }, include: { project: { select: { userId: true, title: true, source: true } } } });
  let systemTest = asset?.project.source === "SYSTEM_TEST";
  let ownerId = asset?.project.userId;
  let storageKey = asset?.storageKey || null;
  let mimeType = asset?.mimeType || "application/octet-stream";
  let fileName = asset ? `rudyo-${asset.project.title}-${asset.fileName}` : "";
  let durationSeconds: number | null = null;

  if (!asset) {
    const task = await prisma.generationTask.findUnique({
      where: { id },
      include: { project: { select: { userId: true, title: true, source: true } }, scene: { select: { order: true } } },
    });
    if (task) {
      if (task.status !== "SUCCEEDED") return NextResponse.json({ error: "Le résultat est encore en cours de génération." }, { status: 409 });
      ownerId = task.project.userId;
      storageKey = storageKeyFromClientRef(task.permanentVideoUrl);
      mimeType = "video/mp4";
      fileName = `rudyo-${task.project.title}-scene-${String(task.scene.order).padStart(2, "0")}.mp4`;
      systemTest = task.project.source === "SYSTEM_TEST";
    }
  }

  if (!ownerId) {
    const finalExport = await prisma.finalExport.findUnique({ where: { id }, include: { project: { select: { userId: true, title: true, source: true, createdAt: true, durationSeconds: true, billedDurationSeconds: true } } } });
    if (finalExport) {
      if (finalExport.status !== "COMPLETED") return NextResponse.json({ error: "Le résultat est encore en cours de génération." }, { status: 409 });
      ownerId = finalExport.project.userId;
      storageKey = finalExport.storageKey || storageKeyFromClientRef(finalExport.url);
      mimeType = "video/mp4";
      durationSeconds = finalExport.project.billedDurationSeconds || finalExport.project.durationSeconds;
      fileName = `rudyo-clip-${durationSeconds || 0}s.mp4`;
      systemTest = finalExport.project.source === "SYSTEM_TEST";
    }
  }

  if (!ownerId) return NextResponse.json({ error: "Le fichier demandé n’est plus disponible." }, { status: 404 });
  if (systemTest) return NextResponse.json({ error: "Ce résultat système exige une session administrateur." }, { status: 403 });
  if (!signed && ownerId !== user!.id) return NextResponse.json({ error: "Ce résultat ne vous appartient pas." }, { status: 403 });
  if (!storageKey) return NextResponse.json({ error: "Le fichier demandé n’est plus disponible." }, { status: 404 });

    const totalSize = await getStorageSize(storageKey);
    if (totalSize === null) return NextResponse.json({ error: "Le fichier demandé n’est plus disponible." }, { status: 404 });
    let range: { start: number; end: number } | null;
    try { range = parseSingleByteRange(request.headers.get("range"), totalSize); }
    catch (error) {
      if (error instanceof RangeNotSatisfiableError) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${totalSize}`, "Accept-Ranges": "bytes" } });
      throw error;
    }
    const stored = range ? await openStorageRange(storageKey, range.start, range.end) : await openStorageStream(storageKey);
    if (!stored) return NextResponse.json({ error: "Le fichier demandé n’est plus disponible." }, { status: 404 });
    const cleanName = cleanDownloadName(fileName);
    const headers = new Headers({
      "Content-Type": mimeType,
      "Content-Disposition": `${request.nextUrl.searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename="${cleanName}"; filename*=UTF-8''${encodeURIComponent(cleanName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    });
    headers.set("Content-Length", String(stored.contentLength ?? stored.size ?? totalSize));
    if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${totalSize}`);
    return new Response(stored.stream, { status: range ? 206 : 200, headers });
  } catch (error) {
    console.error("Result download failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Téléchargement impossible pour le moment." }, { status: 500 });
  }
}
