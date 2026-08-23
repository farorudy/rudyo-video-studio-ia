import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeProjectId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || "projet";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.videoProject.findUnique({ where: { id }, select: { id: true, userId: true, title: true } });
    if (!project) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 });
    if (project.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Ce projet ne vous appartient pas." }, { status: 403 });
    }

    const where = { userId: user.id, projectId: project.id };
    const [usage, totals] = await Promise.all([
      prisma.tokenUsage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 250,
        include: { scene: { select: { title: true } } },
      }),
      prisma.tokenUsage.aggregate({
        where,
        _sum: { completionTokens: true, costUsd: true, costEur: true, creditsCharged: true },
      }),
    ]);

    const body = JSON.stringify({
      success: true,
      exportedAt: new Date().toISOString(),
      project: { id: project.id, title: project.title },
      totals: totals._sum,
      usage,
    }, null, 2);
    const fileName = `rudyo-historique-${safeProjectId(project.id)}.json`;
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(Buffer.byteLength(body)),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Project history download failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Téléchargement de l’historique impossible." }, { status: 500 });
  }
}
