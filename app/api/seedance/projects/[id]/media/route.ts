import path from "node:path";
import { MediaAssetType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStorage, putStorageBuffer, toClientFileRef } from "@/lib/storage";
import { enforceApiRateLimit, readFormDataWithLimit, RequestTooLargeError, sniffMime } from "@/lib/request-security";

export const runtime = "nodejs";

const INPUT_TYPES = new Set<MediaAssetType>([
  MediaAssetType.AUDIO, MediaAssetType.ARTIST_PORTRAIT, MediaAssetType.ARTIST_PROFILE_LEFT,
  MediaAssetType.ARTIST_PROFILE_RIGHT, MediaAssetType.ARTIST_FULL_BODY, MediaAssetType.REFERENCE_IMAGE,
  MediaAssetType.REFERENCE_VIDEO, MediaAssetType.DECOR, MediaAssetType.OUTFIT,
  MediaAssetType.FIRST_FRAME, MediaAssetType.LAST_FRAME, MediaAssetType.CONSENT_DOCUMENT,
]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const EXTENSIONS: Record<string, Set<string>> = {
  "image/jpeg": new Set(["jpg", "jpeg"]), "image/png": new Set(["png"]), "image/webp": new Set(["webp"]),
  "audio/mpeg": new Set(["mp3"]), "audio/wav": new Set(["wav"]), "audio/x-wav": new Set(["wav"]), "audio/mp4": new Set(["m4a"]),
  "video/mp4": new Set(["mp4"]), "video/quicktime": new Set(["mov"]), "video/webm": new Set(["webm"]),
  "application/pdf": new Set(["pdf"]),
};

function megabytes(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return (Number.isFinite(value) && value > 0 ? value : fallback) * 1024 * 1024;
}

function positiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function cleanName(name: string) {
  return path.basename(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120);
}

function expectedKind(type: MediaAssetType) {
  if (type === MediaAssetType.AUDIO) return "audio";
  if (type === MediaAssetType.REFERENCE_VIDEO) return "video";
  if (type === MediaAssetType.CONSENT_DOCUMENT) return "document";
  return "image";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uploadedKey = "";
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ error: "Vous devez vous connecter pour importer un fichier." }, { status: 401 });
    const { id } = await params;
    if (!(await prisma.videoProject.findFirst({ where: { id, userId: user.id }, select: { id: true } }))) {
      return NextResponse.json({ error: "Ce projet ne vous appartient pas." }, { status: 403 });
    }
    await enforceApiRateLimit(request, "seedance-media", user.id, 20, 60_000);

    const imageLimit = megabytes("MAX_IMAGE_UPLOAD_MB", 20);
    const audioLimit = megabytes("MAX_AUDIO_UPLOAD_MB", 100);
    const videoLimit = megabytes("MAX_VIDEO_UPLOAD_MB", 250);
    const requestLimit = Math.max(imageLimit, audioLimit, videoLimit) + 1024 * 1024;
    const form = await readFormDataWithLimit(request, requestLimit);
    const file = form.get("file");
    const type = String(form.get("type") || "") as MediaAssetType;
    if (!(file instanceof File) || !INPUT_TYPES.has(type)) return NextResponse.json({ error: "Fichier ou type de média invalide." }, { status: 400 });

    const projectCount = await prisma.mediaAsset.count({ where: { projectId: id } });
    if (projectCount >= positiveInteger("MAX_FILES_PER_PROJECT", 100)) return NextResponse.json({ error: "Le nombre maximal de fichiers pour ce projet est atteint." }, { status: 409 });
    const userUsage = await prisma.mediaAsset.aggregate({ where: { userId: user.id }, _sum: { sizeBytes: true } });
    if ((userUsage._sum.sizeBytes || 0) + file.size > megabytes("MAX_USER_STORAGE_MB", 5 * 1024)) return NextResponse.json({ error: "Votre espace de stockage Rudyo AI est insuffisant." }, { status: 413 });

    const kind = expectedKind(type);
    const declaredAllowed = kind === "image" ? IMAGE_TYPES.has(file.type) : kind === "audio" ? AUDIO_TYPES.has(file.type) : kind === "video" ? VIDEO_TYPES.has(file.type) : ["application/pdf", "image/jpeg", "image/png"].includes(file.type);
    if (!declaredAllowed) return NextResponse.json({ error: "Ce format de fichier n’est pas accepté." }, { status: 415 });
    const limit = kind === "image" ? imageLimit : kind === "audio" ? audioLimit : kind === "video" ? videoLimit : imageLimit;
    if (file.size <= 0 || file.size > limit) return NextResponse.json({ error: "Le fichier dépasse la taille autorisée." }, { status: 413 });

    const originalExtension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!EXTENSIONS[file.type]?.has(originalExtension)) return NextResponse.json({ error: "L’extension du fichier ne correspond pas à son format." }, { status: 415 });
    const name = cleanName(file.name);
    if (!name || name === "." || name === "..") return NextResponse.json({ error: "Le nom du fichier est invalide." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffMime(buffer);
    const actualMime = file.type === "audio/mp4" && sniffed === "video/mp4" ? "audio/mp4" : sniffed;
    const wavCompatible = actualMime === "audio/wav" && file.type === "audio/x-wav";
    if (!actualMime || (actualMime !== file.type && !wavCompatible)) return NextResponse.json({ error: "Le type réel du fichier ne correspond pas au format déclaré." }, { status: 415 });

    const assetId = crypto.randomUUID();
    const key = `users/${user.id}/projects/${id}/assets/${assetId}/${name}`;
    uploadedKey = key;
    await putStorageBuffer(key, buffer, { contentType: actualMime });
    const asset = await prisma.mediaAsset.create({
      data: {
        id: assetId, userId: user.id, projectId: id, type, fileName: name,
        storageKey: key, url: toClientFileRef(key), mimeType: actualMime, sizeBytes: file.size,
        metadata: { originalName: file.name, status: "READY" },
      },
    });
    const downloadUrl = `/api/projects/${encodeURIComponent(id)}/assets/${encodeURIComponent(asset.id)}/download`;
    return NextResponse.json({
      success: true,
      asset: { ...asset, downloadUrl },
      assetId: asset.id,
      filename: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.sizeBytes,
      downloadUrl,
    }, { status: 201 });
  } catch (error) {
    if (uploadedKey) await deleteStorage(uploadedKey).catch(() => false);
    if (error instanceof RequestTooLargeError) return NextResponse.json({ error: "Le fichier dépasse la taille autorisée." }, { status: 413 });
    console.error("Project media upload failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "L’envoi a été interrompu. Vous pouvez recommencer." }, { status: 500 });
  }
}
