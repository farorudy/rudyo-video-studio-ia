import "server-only";

import { randomUUID } from "node:crypto";
import { FinalExportStatus, VideoProjectStatus } from "@prisma/client";
import { reserveCredits, refundCreditUsage } from "@/lib/credit-utils";
import { prisma } from "@/lib/prisma";
import { dispatchRailwayClipJob } from "@/lib/montage/worker-client";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { PaidGenerationUnavailableError } from "@/lib/montage/paid-generation-error";
import { CLIP_OFFER, getClipEconomics, quoteClip, validateClipScenario } from "@/lib/tiktok-offer";
import { type AutomaticClipPlanCode } from "@/lib/clip-pricing";

export async function startPreparedSimpleClip(options: { projectId: string; userId: string }) {
  const project = await prisma.videoProject.findFirst({
    where: { id: options.projectId, userId: options.userId },
    include: {
      mediaAssets: true,
      scenes: { orderBy: { order: "asc" } },
      generationTasks: { orderBy: { createdAt: "asc" } },
      clipWorkerJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!project) throw new Error("Projet introuvable.");
  if (project.status !== VideoProjectStatus.DRAFT) {
    if (project.clipWorkerJobs.length > 0) {
      const workerJob = project.clipWorkerJobs[0];
      const dispatch = await dispatchRailwayClipJob(workerJob.id);
      return { project, tasks: project.generationTasks, workerJob, dispatch, replay: true };
    }
    throw new Error("Ce projet ne peut plus être confirmé.");
  }

  if (!project.clipPlan || project.clipPlan === "CUSTOM") throw new Error("DURATION_TOO_LONG");
  const selectedPlan = project.clipPlan as AutomaticClipPlanCode;
  const quote = quoteClip(project.billedDurationSeconds || project.durationSeconds || 0, 0, selectedPlan);
  if (!quote.supported) throw new Error("DURATION_TOO_LONG");
  if (!quote.fitsSelectedPlan) throw new Error("PLAN_TOO_SHORT");
  const economics = getClipEconomics(quote.normalizedSeconds, selectedPlan);
  if (!economics.enabled) throw new Error("OFFER_PAUSED");
  validateClipScenario(project.scenes, quote.normalizedSeconds);
  const portrait = project.mediaAssets.find((asset) => asset.type === "ARTIST_PORTRAIT");
  if (!portrait) throw new Error("Photo du projet introuvable.");
  const audio = project.mediaAssets.find((asset) => asset.type === "AUDIO");
  if (!audio) throw new Error("Musique du projet introuvable.");
  const portraitMetadata = portrait.metadata && typeof portrait.metadata === "object" && !Array.isArray(portrait.metadata)
    ? portrait.metadata as Record<string, unknown>
    : {};
  const providerAssetId = typeof portraitMetadata.bytePlusAssetId === "string" ? portraitMetadata.bytePlusAssetId.trim() : "";
  const referenceAssetUri = providerAssetId.startsWith("asset://") ? providerAssetId : providerAssetId ? `asset://${providerAssetId}` : null;
  if (process.env.WORKER_EXPECTED_MODE === "seedance" && !referenceAssetUri) throw new Error("BYTEPLUS_REFERENCE_ASSET_REQUIRED");

  // Verrou de facturation, placé avant toute réservation : un worker de
  // démonstration ne doit jamais pouvoir débiter un client réel.
  const service = await getMontageServiceStatus();
  if (!service.paidGenerationAllowed) {
    throw new PaidGenerationUnavailableError(service.paidGenerationRefusal ?? "WORKER_UNREACHABLE");
  }

  const user = await prisma.user.findUnique({ where: { id: options.userId }, select: { creditsRemaining: true } });
  if (!user) throw new Error("Compte introuvable.");
  if (user.creditsRemaining < quote.totalCredits) throw new Error("INSUFFICIENT_CREDITS");

  const claimed = await prisma.videoProject.updateMany({
    where: { id: project.id, userId: options.userId, status: VideoProjectStatus.DRAFT },
    data: { status: VideoProjectStatus.ACTIVE },
  });
  if (claimed.count !== 1) throw new Error("Ce projet est déjà en cours de confirmation.");

  let reservationId: string | null = null;
  try {
    const reservation = await reserveCredits({
      userId: options.userId,
      action: "clip_package",
      amount: quote.totalCredits,
      description: `${quote.planName} · ${quote.normalizedSeconds} s`,
      metadata: { offer: quote.planId, plan: quote.plan, normalizedSeconds: quote.normalizedSeconds, clientRevenueEur: quote.priceEur },
      idempotencyKey: `clip-project:${options.userId}:${project.id}`,
    });
    reservationId = reservation.id;

    await prisma.videoProject.update({
      where: { id: project.id },
      data: {
        creditReservationId: reservation.id,
        status: VideoProjectStatus.GENERATING,
        clientRevenueEur: economics.clientRevenueEur,
        estimatedProviderCostEur: economics.providerCostEur,
        estimatedMarginEur: economics.marginEur,
      },
    });

    const finalExportId = randomUUID();
    const workerJobId = randomUUID();
    const generationId = randomUUID();
    const outputPath = `users/${options.userId}/projects/${project.id}/generations/${generationId}/final/clip.mp4`;
    const workerJob = await prisma.$transaction(async (tx) => {
      await tx.finalExport.create({ data: { id: finalExportId, projectId: project.id, status: FinalExportStatus.QUEUED, format: CLIP_OFFER.ratio, resolution: "1080p", settings: { railway: true, provider: "byteplus-seedance", exactDurationRequired: true } } });
      const job = await tx.clipWorkerJob.create({
        data: {
          id: workerJobId,
          userId: options.userId,
          projectId: project.id,
          finalExportId,
          idempotencyKey: `clip-worker:${project.id}`,
          outputPath,
          inputManifest: {
            version: 1,
            jobId: workerJobId,
            userId: options.userId,
            projectId: project.id,
            finalExportId,
            photoStorageKey: portrait.storageKey,
            audioStorageKey: audio.storageKey,
            audioStartSeconds: project.audioStartSeconds,
            durationSeconds: quote.normalizedSeconds,
            referenceAssetUri,
            scenes: project.scenes.map((scene) => ({ id: scene.id, order: scene.order, title: scene.title, prompt: scene.prompt, durationSeconds: scene.durationSeconds, modelId: scene.modelId || "dreamina-seedance-2-0-260128", resolution: scene.resolution, ratio: scene.ratio })),
            outputStorageKey: outputPath,
            plan: quote.plan,
            creditReservationId: reservation.id,
          },
        },
      });
      await tx.clipWorkerJobEvent.create({ data: { jobId: workerJobId, status: "QUEUED", progress: 0, message: "Tâche Railway créée" } });
      return job;
    });
    const dispatch = await dispatchRailwayClipJob(workerJob.id);
    return { project: { ...project, status: VideoProjectStatus.GENERATING, creditReservationId: reservation.id }, tasks: [], workerJob, dispatch, replay: false };
  } catch (error) {
    if (reservationId) await refundCreditUsage(reservationId).catch(() => undefined);
    await prisma.videoProject.updateMany({
      where: { id: project.id, status: { in: [VideoProjectStatus.ACTIVE, VideoProjectStatus.GENERATING] } },
      data: { status: VideoProjectStatus.DRAFT, creditReservationId: null },
    }).catch(() => undefined);
    throw error;
  }
}
