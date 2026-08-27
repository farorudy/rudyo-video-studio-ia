import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest, hasStrictSameOrigin, verifyAdminCsrfToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 401 });
  if (!hasStrictSameOrigin(request) || !verifyAdminCsrfToken(request)) return NextResponse.json({ error: "Protection CSRF invalide." }, { status: 403 });
  const body = await request.json().catch(() => null) as { assetId?: unknown } | null;
  const raw = typeof body?.assetId === "string" ? body.assetId.trim().replace(/^asset:\/\//, "") : "";
  if (!/^[a-zA-Z0-9._:-]{3,200}$/.test(raw)) return NextResponse.json({ error: "Identifiant d’actif BytePlus invalide." }, { status: 400 });
  const { id } = await params;
  const portrait = await prisma.mediaAsset.findFirst({ where: { projectId: id, type: "ARTIST_PORTRAIT" } });
  if (!portrait) return NextResponse.json({ error: "Portrait du projet introuvable." }, { status: 404 });
  const metadata = portrait.metadata && typeof portrait.metadata === "object" && !Array.isArray(portrait.metadata) ? portrait.metadata as Record<string, unknown> : {};
  await prisma.$transaction([
    prisma.mediaAsset.update({ where: { id: portrait.id }, data: { metadata: { ...metadata, bytePlusAssetId: `asset://${raw}`, bytePlusAssetVerifiedAt: new Date().toISOString(), bytePlusAssetVerifiedBy: admin.subject } } }),
    prisma.adminAuditLog.create({ data: { adminSubject: admin.subject, action: "link_byteplus_asset", targetUserId: portrait.userId, metadata: { projectId: id, mediaAssetId: portrait.id } } }),
  ]);
  return NextResponse.json({ success: true, projectId: id, mediaAssetId: portrait.id });
}
