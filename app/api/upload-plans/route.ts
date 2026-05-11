import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { putStorageBuffer, toClientFileRef } from "@/lib/storage";

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function POST(req: NextRequest) {
  try {
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
        const extension = path.extname(file.name) || ".mp4";
        const baseName = path.basename(file.name, extension);
        const fileName = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(baseName)}${extension}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await putStorageBuffer(`plans/${fileName}`, buffer, {
          contentType: file.type || "video/mp4",
        });

        return toClientFileRef(`plans/${fileName}`, stored.url);
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
