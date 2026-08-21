import { NextRequest, NextResponse } from "next/server";
import { readStorageBuffer } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/request-security";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.localSession) {
      return NextResponse.json({ error: "Authentification vérifiée requise." }, { status: 401 });
    }
    try {
      await enforceApiRateLimit(req, "thumbnail-read", user.id, 60, 60_000);
    } catch {
      return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
    }
    const buffer = await readStorageBuffer(`export/${user.id}/thumbnail.jpg`);

    if (!buffer) {
      throw new Error("Miniature introuvable");
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Miniature non disponible." },
      { status: 404 },
    );
  }
}
