import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
  if (projectId && !(await prisma.videoProject.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  const where = { userId: user.id, ...(projectId ? { projectId } : {}) };
  const [usage, totals] = await Promise.all([
    prisma.tokenUsage.findMany({ where, orderBy: { createdAt: "desc" }, take: 250, include: { scene: { select: { title: true } }, project: { select: { title: true } } } }),
    prisma.tokenUsage.aggregate({ where, _sum: { completionTokens: true, costUsd: true, costEur: true, creditsCharged: true } }),
  ]);
  return NextResponse.json({ success: true, totals: totals._sum, usage, pricingConfigured: Boolean(process.env.BYTEPLUS_USD_PER_MILLION_TOKENS_BY_MODEL) });
}
