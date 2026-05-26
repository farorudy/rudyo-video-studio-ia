import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { putStorageBuffer, toClientFileRef } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";

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
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    const formData = await req.formData();
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
        const stored = await putStorageBuffer(`plans/${user.id}/${fileName}`, buffer, {
          contentType: file.type || "video/mp4",
        });

        return toClientFileRef(`plans/${user.id}/${fileName}`, stored.url);
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
