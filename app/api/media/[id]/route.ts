import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyMediaSignature } from "@/lib/media-access";
import { prisma } from "@/lib/prisma";
import { enforceApiRateLimit } from "@/lib/request-security";
import { readStorageBuffer } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const expires = Number(request.nextUrl.searchParams.get("expires"));
  const supplied = request.nextUrl.searchParams.get("signature") || "";
  const signed = Boolean(supplied) && verifyMediaSignature(id, expires, supplied);
  const user = signed ? null : await getCurrentUser(request);
  if (!signed && (!user || user.localSession)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  try {
    await enforceApiRateLimit(request, "media-read", signed ? `signed:${id}` : user!.id, signed ? 30 : 120, 60_000);
  } catch {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: { id, ...(signed ? {} : { userId: user!.id }) },
  });
  if (!asset) return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
  const buffer = await readStorageBuffer(asset.storageKey);
  if (!buffer) return NextResponse.json({ error: "Média introuvable." }, { status: 404 });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
      "Cache-Control": signed ? "private, max-age=60" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
