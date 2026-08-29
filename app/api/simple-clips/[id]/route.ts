import { FinalExportStatus, GenerationTaskStatus, MontageJobStatus, VideoProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { refundCreditUsage } from "@/lib/credit-utils";
import { enqueueMontageJob } from "@/lib/montage/queue";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { prisma } from "@/lib/prisma";
import { syncGenerationTask } from "@/lib/seedance/service";
import { deleteStorage, storageKeyFromClientRef } from "@/lib/storage";
import { getClipAuthorization, getClipEconomics, quoteClip } from "@/lib/tiktok-offer";
import { type AutomaticClipPlanCode } from "@/lib/clip-pricing";
import { signedDownloadUrl } from "@/lib/media-access";

export const runtime = "nodejs";
const TERMINAL_TASKS = new Set<GenerationTaskStatus>([GenerationTaskStatus.SUCCEEDED, GenerationTaskStatus.FAILED, GenerationTaskStatus.CANCELLED, GenerationTaskStatus.REFUNDED]);
const FAILED_TASKS = new Set<GenerationTaskStatus>([GenerationTaskStatus.FAILED, GenerationTaskStatus.CANCELLED, GenerationTaskStatus.REFUNDED]);
const ACTIVE_TASKS = new Set<GenerationTaskStatus>([GenerationTaskStatus.SUBMITTED, GenerationTaskStatus.PROCESSING]);

async function ownedProject(id: string, userId: string) {
  return prisma.videoProject.findFirst({
    where: { id, userId, OR: [{ clipPlan: { not: null } }, { scenes: { some: { title: { startsWith: "Clip automatique" } } } }] },
    include: {
      generationTasks: { orderBy: { createdAt: "asc" } },
      finalExports: { orderBy: { createdAt: "desc" }, take: 1 },
      montageJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      clipWorkerJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      mediaAssets: { select: { storageKey: true } },
      scenarioVersions: { orderBy: { version: "desc" }, take: 1, include: { scenes: { orderBy: { position: "asc" }, select: { id: true } } } },
    },
  });
}

async function queueFinalRender(projectId: string, userId: string) {
  const project = await prisma.videoProject.findUniqueOrThrow({ where: { id: projectId }, select: { colors: true } });
  const simpleOptions = project.colors && typeof project.colors === "object" && !Array.isArray(project.colors)
    ? (project.colors as { simpleClip?: { quality?: string; subtitles?: boolean } }).simpleClip
    : undefined;
  return enqueueMontageJob({
    projectId,
    userId,
    resolution: project.colors && typeof project.colors === "object" && "tiktokClip" in project.colors ? "1080p" : simpleOptions?.quality === "high" ? "1080p" : "720p",
    transition: "cut",
    subtitles: Boolean(simpleOptions?.subtitles),
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  let project = await ownedProject(id, user.id);
  if (!project) return NextResponse.json({ error: "Création introuvable." }, { status: 404 });
  if (project.status === VideoProjectStatus.DRAFT) {
    if (!project.clipPlan || project.clipPlan === "CUSTOM") return NextResponse.json({ error: "Formule de clip invalide." }, { status: 409 });
    const selectedPlan = project.clipPlan as AutomaticClipPlanCode;
    const quote = quoteClip(project.billedDurationSeconds || project.durationSeconds || 0, 0, selectedPlan);
    const economics = getClipEconomics(quote.normalizedSeconds, selectedPlan);
    const worker = await getMontageServiceStatus();
    const scenarioVersion = project.scenarioVersions[0];
    const scenarioValidated = scenarioVersion?.status === "VALIDATED";
    const authorization = getClipAuthorization(quote.totalCredits, user.creditsRemaining, worker.paidGenerationAllowed, economics.enabled, quote.supported, quote.fitsSelectedPlan);
    return NextResponse.json({
      success: true,
      state: "draft",
      projectId: project.id,
      message: project.paymentCompletedAt ? "Vos crédits ont été ajoutés. Vous pouvez maintenant générer votre clip." : "Votre projet est conservé.",
      ...quote,
      ...authorization,
      allowed: authorization.allowed && scenarioValidated,
      refusalCode: scenarioValidated ? authorization.refusalCode : "SCENARIO_VALIDATION_REQUIRED",
      scenarioValidated,
      storyboardUrl: scenarioVersion?.scenes[0] ? `/projects/${encodeURIComponent(project.id)}/storyboard/${encodeURIComponent(scenarioVersion.scenes[0].id)}` : `/projects/${encodeURIComponent(project.id)}/storyboard`,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }
  let task = project.generationTasks[0];

  try {
    const activeTasks = project.generationTasks.filter((item) => !TERMINAL_TASKS.has(item.status)).slice(0, 10);
    if (activeTasks.length) await Promise.all(activeTasks.map((item) => syncGenerationTask(item.id, user.id).catch(() => null)));
    project = (await ownedProject(id, user.id))!;
    task = project.generationTasks[0];
    const allReady = project.generationTasks.length > 0 && project.generationTasks.every((item) => item.status === GenerationTaskStatus.SUCCEEDED && item.permanentVideoUrl);
    if (allReady) {
      await prisma.generationVariant.updateMany({ where: { taskId: { in: project.generationTasks.map((item) => item.id) } }, data: { selected: true } });
      await prisma.videoProject.update({ where: { id }, data: { status: VideoProjectStatus.RENDERING } });
      await queueFinalRender(id, user.id);
      project = (await ownedProject(id, user.id))!;
    }
  } catch (error) {
    console.error("Simple clip follow-up failed", error instanceof Error ? error.message : error);
  }

  const finalExport = project.finalExports[0];
  const montageJob = project.montageJobs[0];
  const clipWorkerJob = project.clipWorkerJobs[0];
  if (clipWorkerJob?.status === "FAILED" || clipWorkerJob?.status === "REFUNDED") {
    return NextResponse.json({ success: true, state: "failed", progress: 100, message: clipWorkerJob.errorMessage || "La création a échoué. Les crédits ont été recrédités une seule fois et votre projet est conservé." });
  }
  if (task?.provider === "byteplus-demo" && !task.permanentVideoUrl) {
    return NextResponse.json({ success: true, state: "failed", progress: 100, message: "La génération réelle est indisponible tant que BytePlus n’est pas configuré. Aucun crédit n’a été débité." });
  }
  if (montageJob?.status === MontageJobStatus.REFUNDED) {
    return NextResponse.json({ success: true, state: "failed", progress: 100, message: "La création de votre clip n’a pas pu être terminée. Vos crédits ont été recrédités. Vous pouvez recommencer." });
  }
  if (montageJob?.status === MontageJobStatus.FAILED || finalExport?.status === FinalExportStatus.FAILED) {
    return NextResponse.json({ success: true, state: "failed", progress: 100, message: "La création de votre clip n’a pas pu être terminée." });
  }
  if (project.generationTasks.some((item) => FAILED_TASKS.has(item.status))) {
    if (project.creditReservationId) await refundCreditUsage(project.creditReservationId).catch(() => undefined);
    return NextResponse.json({ success: true, state: "failed", progress: 100, message: "La création de votre clip n’a pas pu être terminée. Vos crédits ont été recrédités. Vous pouvez recommencer." });
  }
  if (finalExport?.status === FinalExportStatus.COMPLETED) {
    await prisma.videoProject.updateMany({ where: { id, status: { not: VideoProjectStatus.COMPLETED } }, data: { status: VideoProjectStatus.COMPLETED } });
    const downloadUrl = signedDownloadUrl(finalExport.id);
    return NextResponse.json({
      success: true,
      state: "completed",
      progress: 100,
      message: "Votre clip est prêt !",
      videoUrl: `${downloadUrl}&preview=1`,
      downloadUrl,
      projectTitle: project.title,
      durationSeconds: project.billedDurationSeconds || project.durationSeconds || 0,
      createdAt: project.createdAt.toISOString(),
    });
  }

  if (clipWorkerJob) {
    const messages: Record<string, string> = {
      QUEUED: "Démarrage du service de création…",
      CLAIMED: "Préparation du projet",
      PREPARING: "Analyse de la musique",
      RENDERING: "Création et montage du clip",
      UPLOADING: "Finalisation du clip",
      RETRYING: "Nouvelle tentative automatique",
    };
    return NextResponse.json({ success: true, state: "processing", progress: clipWorkerJob.progress, message: messages[clipWorkerJob.status] || "Création en cours" }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const submitted = project.generationTasks.some((item) => ACTIVE_TASKS.has(item.status));
  const stage = montageJob?.status;
  const montageProgress = montageJob ? Math.max(70, Math.min(98, 70 + Math.round(montageJob.progress * 0.28))) : null;
  const montageMessage = stage === MontageJobStatus.UPLOADING
    ? "Finalisation de votre clip"
    : stage === MontageJobStatus.RENDERING
      ? "Montage avec votre musique"
      : "Préparation du montage";
  return NextResponse.json({
    success: true,
    state: "processing",
    progress: montageProgress ?? (finalExport ? 70 : submitted ? 54 : 22),
    message: montageJob ? montageMessage : finalExport ? "Montage avec votre musique" : submitted ? "Génération des scènes" : "Création du scénario",
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  const project = await ownedProject(id, user.id);
  if (!project) return NextResponse.json({ error: "Création introuvable." }, { status: 404 });
  const keys = [
    ...project.mediaAssets.map((asset) => asset.storageKey),
    ...project.generationTasks.flatMap((item) => [storageKeyFromClientRef(item.permanentVideoUrl), storageKeyFromClientRef(item.thumbnailUrl)]),
    ...project.finalExports.map((item) => item.storageKey || storageKeyFromClientRef(item.url)),
  ].filter((value): value is string => Boolean(value));
  await prisma.videoProject.delete({ where: { id } });
  await Promise.all(keys.map((key) => deleteStorage(key).catch(() => false)));
  return NextResponse.json({ success: true });
}
