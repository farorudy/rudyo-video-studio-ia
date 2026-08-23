import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStorage } from "@/lib/storage";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const { id } = await params;
    const project = await prisma.videoProject.findFirst({ where: { id, userId: user.id }, include: { mediaAssets: { select: { storageKey: true } } } });
    if (!project) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 });

    await Promise.all(project.mediaAssets.map((asset) => deleteStorage(asset.storageKey).catch(() => false)));
    await prisma.videoProject.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Project deletion failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible de supprimer le projet." }, { status: 500 });
  }
}
