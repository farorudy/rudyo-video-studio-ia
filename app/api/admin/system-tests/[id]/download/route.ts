import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { openStorageStream } from "@/lib/storage";
import { verifySystemTestDownloadToken } from "@/lib/system-tests/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 401 });
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token") || "";
  const run = await prisma.systemTestRun.findFirst({ where: { id, adminSubject: admin.subject } });
  if (!run || run.status !== "SUCCEEDED" || run.cleanedAt || !run.outputPath || !run.downloadTokenHash || !run.downloadExpiresAt) {
    return NextResponse.json({ error: "Résultat de test indisponible." }, { status: 404 });
  }
  if (run.downloadExpiresAt <= new Date() || !verifySystemTestDownloadToken(token, run.downloadTokenHash)) {
    return NextResponse.json({ error: "Le lien temporaire a expiré." }, { status: 403 });
  }
  const stored = await openStorageStream(run.outputPath);
  if (!stored || !stored.size || stored.size < 1024) return NextResponse.json({ error: "MP4 de test absent ou invalide." }, { status: 409 });
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Content-Disposition": `${request.nextUrl.searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename="rudyo-system-test.mp4"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": String(stored.size),
  });
  return new Response(stored.stream, { headers });
}
