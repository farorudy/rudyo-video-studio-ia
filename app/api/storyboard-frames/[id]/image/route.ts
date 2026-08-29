import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readStorageBuffer } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  const frame = await prisma.storyboardFrame.findFirst({ where: { id, userId: user.id }, select: { storageKey: true } });
  if (!frame?.storageKey) return NextResponse.json({ error: "Croquis indisponible." }, { status: 404 });
  const buffer = await readStorageBuffer(frame.storageKey);
  if (!buffer) return NextResponse.json({ error: "Croquis indisponible." }, { status: 404 });
  return new NextResponse(buffer, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
