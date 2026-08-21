import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  personName: z.string().trim().min(2).max(120),
  authorizationType: z.enum(["image", "voix", "image_et_voix", "mandat_professionnel"]),
  consentedAt: z.string().datetime(),
  documentAssetId: z.string().cuid().optional(),
  notes: z.string().trim().max(1000).optional(),
  confirmed: z.literal(true),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  if (!(await prisma.videoProject.findFirst({ where: { id, userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vous devez confirmer disposer des autorisations nécessaires." }, { status: 400 });
  if (parsed.data.documentAssetId && !(await prisma.mediaAsset.findFirst({ where: { id: parsed.data.documentAssetId, projectId: id, userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Justificatif invalide." }, { status: 400 });
  const { confirmed: _, ...data } = parsed.data;
  void _;
  const consent = await prisma.consentRecord.create({ data: { ...data, consentedAt: new Date(data.consentedAt), userId: user.id, projectId: id } });
  return NextResponse.json({ success: true, consent }, { status: 201 });
}

