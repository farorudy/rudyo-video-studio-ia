import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openStorageStream, storageKeyFromClientRef } from "@/lib/storage";

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "projet";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  const task = await prisma.generationTask.findFirst({
    where: { id, userId: user.id },
    select: { permanentVideoUrl: true, project: { select: { title: true } } },
  });
  if (!task) return NextResponse.json({ error: "Vidéo introuvable." }, { status: 404 });
  if (!task.permanentVideoUrl) return NextResponse.json({ error: "La vidéo finale n’est pas encore prête." }, { status: 409 });
  const key = storageKeyFromClientRef(task.permanentVideoUrl);
  if (!key) return NextResponse.json({ error: "Référence de stockage invalide." }, { status: 500 });
  const stored = await openStorageStream(key);
  if (!stored) return NextResponse.json({ error: "Fichier vidéo introuvable." }, { status: 404 });
  return new Response(stored.stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${safeName(task.project.title)}-rudyo-ai.mp4"`,
      ...(stored.size ? { "Content-Length": String(stored.size) } : {}),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
