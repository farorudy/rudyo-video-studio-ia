import path from "node:path";
import { MediaAssetType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { putStorageBuffer, toClientFileRef } from "@/lib/storage";
import { enforceApiRateLimit, readFormDataWithLimit, sniffMime } from "@/lib/request-security";

const MAX_IMAGE = 20 * 1024 * 1024;
const MAX_MEDIA = 250 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "audio/mpeg", "audio/wav", "audio/x-wav", "video/mp4", "video/quicktime", "video/webm",
  "application/pdf",
]);

function cleanName(name: string) {
  return path.basename(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification persistante requise." }, { status: 401 });
  const { id } = await params;
  if (!(await prisma.videoProject.findFirst({ where: { id, userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  await enforceApiRateLimit(request, "seedance-media", user.id, 10, 60_000);
  const form = await readFormDataWithLimit(request, MAX_MEDIA + 1024 * 1024);
  const file = form.get("file");
  const type = String(form.get("type") || "");
  if (!(file instanceof File) || !(type in MediaAssetType)) return NextResponse.json({ error: "Fichier ou type de média invalide." }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Format de fichier non autorisé." }, { status: 415 });
  const limit = file.type.startsWith("image/") ? MAX_IMAGE : MAX_MEDIA;
  if (file.size <= 0 || file.size > limit) return NextResponse.json({ error: "Le fichier dépasse la taille autorisée." }, { status: 413 });
  if (type === MediaAssetType.CONSENT_DOCUMENT && !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) return NextResponse.json({ error: "Le justificatif doit être un PDF, JPEG ou PNG." }, { status: 415 });

  const name = cleanName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const actualMime = sniffMime(buffer);
  const compatibleMime = actualMime === file.type || (actualMime === "image/heic" && file.type === "image/heif");
  if (!actualMime || !compatibleMime || !ALLOWED.has(actualMime)) return NextResponse.json({ error: "Le type réel du fichier ne correspond pas au format déclaré." }, { status: 415 });
  const assetId = crypto.randomUUID();
  const key = `users/${user.id}/projects/${id}/${assetId}/${name}`;
  const stored = await putStorageBuffer(key, buffer, {
    contentType: actualMime,
    access: "private",
  });
  const asset = await prisma.mediaAsset.create({
    data: { id: assetId, userId: user.id, projectId: id, type: type as MediaAssetType, fileName: name, storageKey: key, url: toClientFileRef(key, stored.url), mimeType: actualMime, sizeBytes: file.size },
  });
  return NextResponse.json({ success: true, asset }, { status: 201 });
}
