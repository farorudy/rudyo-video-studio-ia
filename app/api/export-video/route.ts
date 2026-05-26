import { NextRequest, NextResponse } from "next/server";
import { readStorageBuffer } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    const fileBuffer = await readStorageBuffer(`export/${user.id}/clip_final.mp4`);

    if (!fileBuffer) {
      throw new Error("clip_final.mp4 introuvable");
    }

    const isDownload = req.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileBuffer.byteLength),
        "Content-Disposition": isDownload
          ? 'attachment; filename="clip_final.mp4"'
          : 'inline; filename="clip_final.mp4"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Le fichier clip_final.mp4 est introuvable.",
      },
      { status: 404 },
    );
  }
}
