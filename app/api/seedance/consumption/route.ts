import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
    const project = projectId ? await prisma.videoProject.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true, title: true } }) : null;
    if (projectId && !project) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 });
    const where = { userId: user.id, ...(projectId ? { projectId } : {}) };
    const [usage, totals] = await Promise.all([
      prisma.tokenUsage.findMany({ where, orderBy: { createdAt: "desc" }, take: 250, include: { scene: { select: { title: true } }, project: { select: { title: true } } } }),
      prisma.tokenUsage.aggregate({ where, _sum: { completionTokens: true, costUsd: true, costEur: true, creditsCharged: true } }),
    ]);
    const baseName = (project?.title || "historique").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "historique";
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    if (request.nextUrl.searchParams.get("download") === "1") {
      headers.set("Content-Disposition", `attachment; filename="rudyo-${baseName}-consommation.json"`);
    }
    return NextResponse.json({ success: true, totals: totals._sum, usage, pricingConfigured: Boolean(process.env.BYTEPLUS_USD_PER_MILLION_TOKENS_BY_MODEL) }, { headers });
  } catch (error) {
    console.error("Consumption export failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible de charger l’historique." }, { status: 500 });
  }
}
