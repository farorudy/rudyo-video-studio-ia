import { NextRequest, NextResponse } from "next/server";
import { readStorageBuffer } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentification requise." },
      { status: 401 },
    );
  }

  const file = req.nextUrl.searchParams.get("file") || "";

  if (!/^[a-z0-9-]+\.mp4$/i.test(file)) {
    return NextResponse.json(
      { success: false, error: "Nom de fichier video invalide." },
      { status: 400 },
    );
  }

  const buffer = await readStorageBuffer(`export/${user.id}/${file}`).catch(() => null);

  if (!buffer) {
    return NextResponse.json(
      { success: false, error: "Vidéo introuvable." },
      { status: 404 },
    );
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `inline; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
