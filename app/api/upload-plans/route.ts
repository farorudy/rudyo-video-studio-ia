import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { putStorageBuffer, toClientFileRef } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  enforceApiRateLimit,
  readFormDataWithLimit,
  sniffMime,
} from "@/lib/request-security";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.localSession) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    await enforceApiRateLimit(req, "upload-plans", user.id, 5, 60_000);
    const formData = await readFormDataWithLimit(req, 301 * 1024 * 1024);
    const projectId = String(formData.get("projectId") || "");
    const project = await prisma.videoProject.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } });
    if (!project) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 });
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun fichier vidéo reçu.",
        },
        { status: 400 },
      );
    }
    if (files.length > 10) return NextResponse.json({ success: false, error: "Dix fichiers maximum par envoi." }, { status: 400 });

    const savedFiles = await Promise.all(
      files.map(async (file, index) => {
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error("Fichier video trop volumineux.");
        }

        const extension = path.extname(file.name).toLowerCase() || ".mp4";
        if (
          !ALLOWED_EXTENSIONS.has(extension) ||
          (file.type && !ALLOWED_MIME_TYPES.has(file.type))
        ) {
          throw new Error("Format video non autorise.");
        }

        const baseName = path.basename(file.name, extension);
        const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(baseName)}${extension}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const actualMime = sniffMime(buffer);
        if (!actualMime || !ALLOWED_MIME_TYPES.has(actualMime)) throw new Error("Le contenu réel du fichier vidéo n’est pas autorisé.");
        const assetId = crypto.randomUUID();
        const storageKey = `users/${user.id}/projects/${projectId}/${assetId}/${fileName}`;
        await putStorageBuffer(storageKey, buffer, {
          contentType: actualMime,
          access: "private",
        });
        await prisma.mediaAsset.create({
          data: {
            id: assetId, userId: user.id, projectId, type: "REFERENCE_VIDEO", fileName,
            storageKey, url: toClientFileRef(storageKey), mimeType: actualMime,
            sizeBytes: buffer.byteLength, metadata: { source: "upload-plans" },
          },
        });
        return { assetId, fileName, downloadUrl: `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/download` };
      }),
    );

    return NextResponse.json({
      success: true,
      result: {
        count: savedFiles.length,
        files: savedFiles,
      },
    });
  } catch (error) {
    console.error("Erreur upload plans :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'upload des clips.",
      },
      { status: 500 },
    );
  }
}
