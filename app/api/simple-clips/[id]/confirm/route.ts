import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { prisma } from "@/lib/prisma";
import { beginIdempotentRequest, finishIdempotentRequest, requireIdempotencyKey } from "@/lib/request-security";
import { startPreparedSimpleClip } from "@/lib/simple-clip-production";
import { getClipAuthorization, getClipEconomics, quoteClip } from "@/lib/tiktok-offer";
import { type AutomaticClipPlanCode } from "@/lib/clip-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  const key = requireIdempotencyKey(request);
  const idem = await beginIdempotentRequest("simple-clip-confirm", user.id, key);
  if (!idem.fresh) {
    if (idem.record.response && idem.record.responseCode) return NextResponse.json(idem.record.response, { status: idem.record.responseCode });
    return NextResponse.json({ error: "Confirmation déjà en cours." }, { status: 409 });
  }

  try {
    const [project, worker, current] = await Promise.all([
      prisma.videoProject.findFirst({ where: { id, userId: user.id }, select: { billedDurationSeconds: true, durationSeconds: true, status: true, clipPlan: true } }),
      getMontageServiceStatus(),
      prisma.user.findUnique({ where: { id: user.id }, select: { creditsRemaining: true } }),
    ]);
    if (!project || !current) throw new Error("Projet introuvable.");
    if (!project.clipPlan || project.clipPlan === "CUSTOM") throw new Error("DURATION_TOO_LONG");
    const selectedPlan = project.clipPlan as AutomaticClipPlanCode;
    const quote = quoteClip(project.billedDurationSeconds || project.durationSeconds || 0, 0, selectedPlan);
    const economics = getClipEconomics(quote.normalizedSeconds, selectedPlan);
    const authorization = getClipAuthorization(quote.totalCredits, current.creditsRemaining, worker.available, economics.enabled, quote.supported, quote.fitsSelectedPlan);
    if (!authorization.allowed) {
      const response = { error: authorization.refusalCode === "INSUFFICIENT_CREDITS" ? `Il vous manque ${authorization.missingCredits} crédits.` : "La génération ne peut pas démarrer.", ...authorization, projectId: id };
      await finishIdempotentRequest(idem.record.id, authorization.refusalCode === "INSUFFICIENT_CREDITS" ? 402 : 503, response);
      return NextResponse.json(response, { status: authorization.refusalCode === "INSUFFICIENT_CREDITS" ? 402 : 503 });
    }
    const started = await startPreparedSimpleClip({ projectId: id, userId: user.id });
    const response = { success: true, projectId: id, workerJobId: started.workerJob.id, workerWaking: started.dispatch?.waking ?? false, taskIds: started.tasks.map((task) => task.id), credits: quote.totalCredits, plan: quote.plan };
    await finishIdempotentRequest(idem.record.id, 202, response);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La génération n’a pas pu démarrer.";
    const status = message === "INSUFFICIENT_CREDITS" ? 402 : 400;
    const response = { error: message };
    await finishIdempotentRequest(idem.record.id, status, response).catch(() => undefined);
    return NextResponse.json(response, { status });
  }
}
