import "server-only";

import { GenerationTaskStatus, MediaAssetType, StoryboardSceneStatus } from "@prisma/client";
import { confirmCreditUsage, refundCreditUsage, reserveCredits } from "@/lib/credit-utils";
import { prisma } from "@/lib/prisma";
import { signedMediaUrl } from "@/lib/media-access";
import { putStorageBuffer, toClientFileRef } from "@/lib/storage";
import {
  BytePlusApiError,
  bytePlusClient,
  isBytePlusDemoMode,
  type BytePlusContent,
  type BytePlusTask,
  type CreateBytePlusTaskInput,
} from "@/lib/seedance/client";
import { chooseSeedanceModel } from "@/lib/seedance/models";
import { quoteSeedanceCredits } from "@/lib/seedance/pricing";

const TERMINAL_FAILURES = new Set<GenerationTaskStatus>([
  GenerationTaskStatus.FAILED,
  GenerationTaskStatus.CANCELLED,
  GenerationTaskStatus.REFUNDED,
]);

function safeMessage(error: unknown) {
  if (error instanceof BytePlusApiError) {
    if (error.status === 401 || error.status === 403) return "La clé BytePlus est invalide ou le modèle n’est pas activé.";
    if (error.status === 429) return "La limite de débit BytePlus est atteinte. Réessayez plus tard.";
    if (error.code === "submission_unknown") return error.message;
    return error.message.slice(0, 300);
  }
  return "Une erreur temporaire empêche la génération Seedance.";
}

function assertSecureRemoteUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("URL de média non sécurisée.");
  }
  return url.toString();
}

function modelTokenPrice(modelId: string) {
  const raw = process.env.BYTEPLUS_USD_PER_MILLION_TOKENS_BY_MODEL;
  if (!raw) return null;
  try {
    const value = Number((JSON.parse(raw) as Record<string, unknown>)[modelId]);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function costUsd(modelId: string, tokens?: number | null) {
  const price = modelTokenPrice(modelId);
  return price === null || !tokens ? null : (tokens / 1_000_000) * price;
}

function mapRemoteStatus(task: BytePlusTask): GenerationTaskStatus {
  if (!task.status) return GenerationTaskStatus.PROCESSING;
  if (task.status === "queued" || task.status === "running") return GenerationTaskStatus.PROCESSING;
  if (task.status === "succeeded") return GenerationTaskStatus.SUCCEEDED;
  if (task.status === "cancelled") return GenerationTaskStatus.CANCELLED;
  return GenerationTaskStatus.FAILED;
}

function mapSceneStatus(status: GenerationTaskStatus): StoryboardSceneStatus {
  if (status === GenerationTaskStatus.PROCESSING) return StoryboardSceneStatus.RUNNING;
  if (status === GenerationTaskStatus.SUCCEEDED) return StoryboardSceneStatus.COMPLETED;
  if (status === GenerationTaskStatus.CANCELLED) return StoryboardSceneStatus.CANCELED;
  if (status === GenerationTaskStatus.FAILED || status === GenerationTaskStatus.REFUNDED) return StoryboardSceneStatus.FAILED;
  return StoryboardSceneStatus.SUBMITTED;
}

async function assertRateAndBudget(userId: string, projectId: string, credits: number) {
  const minuteAgo = new Date(Date.now() - 60_000);
  const recent = await prisma.generationTask.count({ where: { userId, createdAt: { gte: minuteAgo } } });
  if (recent >= 5) throw new Error("Trop de générations ont été demandées. Patientez une minute.");

  const project = await prisma.videoProject.findFirst({
    where: { id: projectId, userId },
    include: { budgetLimit: true },
  });
  if (!project) throw new Error("Projet introuvable.");

  const [projectSpent, dailySpent, monthlySpent] = await Promise.all([
    prisma.tokenUsage.aggregate({ where: { projectId }, _sum: { creditsCharged: true, costUsd: true } }),
    prisma.tokenUsage.aggregate({
      where: { userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      _sum: { creditsCharged: true },
    }),
    prisma.tokenUsage.aggregate({
      where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      _sum: { creditsCharged: true },
    }),
  ]);
  const limit = project.budgetLimit;
  if (limit?.perGenerationCredits && credits > limit.perGenerationCredits) throw new Error("Le plafond de crédits par génération est dépassé.");
  if (limit?.projectCredits && (projectSpent._sum.creditsCharged ?? 0) + credits > limit.projectCredits) throw new Error("Le budget du projet est épuisé.");
  if (limit?.dailyCredits && (dailySpent._sum.creditsCharged ?? 0) + credits > limit.dailyCredits) throw new Error("Le plafond quotidien est atteint.");
  if (limit?.monthlyCredits && (monthlySpent._sum.creditsCharged ?? 0) + credits > limit.monthlyCredits) throw new Error("Le plafond mensuel est atteint.");
  if (limit?.projectUsd && (projectSpent._sum.costUsd ?? 0) >= limit.projectUsd) throw new Error("Le plafond en dollars du projet est atteint.");
}

export type StartSceneGenerationInput = {
  sceneId: string;
  userId: string;
  idempotencyKey: string;
  requestedModelId?: string;
  preview?: boolean;
  economicalDraft?: boolean;
  referenceAssetIds?: string[];
};

export async function startSceneGeneration(input: StartSceneGenerationInput) {
  const existing = await prisma.generationTask.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.userId !== input.userId) throw new Error("Clé d’idempotence invalide.");
    return existing;
  }

  const scene = await prisma.storyboardScene.findFirst({
    where: { id: input.sceneId, project: { userId: input.userId } },
    include: { project: { include: { consentRecords: true } } },
  });
  if (!scene) throw new Error("Scène introuvable.");
  if (scene.locked) throw new Error("Cette scène est verrouillée.");

  const assets = input.referenceAssetIds?.length
    ? await prisma.mediaAsset.findMany({
        where: { id: { in: input.referenceAssetIds }, projectId: scene.projectId, userId: input.userId },
      })
    : [];
  if (assets.length !== (input.referenceAssetIds?.length ?? 0)) throw new Error("Une référence média est invalide.");
  const identityTypes = new Set<MediaAssetType>([
    MediaAssetType.ARTIST_PORTRAIT,
    MediaAssetType.ARTIST_PROFILE_LEFT,
    MediaAssetType.ARTIST_PROFILE_RIGHT,
    MediaAssetType.ARTIST_FULL_BODY,
  ]);
  const usesIdentity = assets.some((asset) => identityTypes.has(asset.type));
  if (usesIdentity && scene.project.consentRecords.length === 0) {
    throw new Error("Le consentement de la personne représentée doit être enregistré avant la génération.");
  }

  const model = chooseSeedanceModel({
    requestedModelId: input.requestedModelId || scene.modelId,
    preview: input.preview,
    economicalDraft: input.economicalDraft,
    durationSeconds: scene.durationSeconds,
    referenceCount: assets.length,
  });
  if (!model?.modelId) throw new Error("Aucun modèle Seedance vérifié n’est disponible.");
  if (!model.capabilities.durations.includes(scene.durationSeconds)) throw new Error("Cette durée n’est pas autorisée pour le modèle sélectionné.");
  if (!model.capabilities.resolutions.includes(scene.resolution)) throw new Error("Cette résolution n’est pas autorisée pour le modèle sélectionné.");

  const content: BytePlusContent[] = [{
    type: "text",
    text: [scene.prompt, scene.negativePrompt ? `À éviter : ${scene.negativePrompt}` : ""].filter(Boolean).join("\n"),
  }];
  for (const asset of assets) {
    const url = assertSecureRemoteUrl(signedMediaUrl(asset.id));
    if (asset.mimeType.startsWith("image/")) content.push({ type: "image_url", image_url: { url }, role: asset.type === MediaAssetType.FIRST_FRAME ? "first_frame" : asset.type === MediaAssetType.LAST_FRAME ? "last_frame" : "reference_image" });
    else if (asset.mimeType.startsWith("video/")) content.push({ type: "video_url", video_url: { url }, role: "reference_video" });
    else if (asset.mimeType.startsWith("audio/")) content.push({ type: "audio_url", audio_url: { url }, role: "reference_audio" });
  }

  const requestPayload: CreateBytePlusTaskInput = {
    model: model.modelId,
    content,
    resolution: scene.resolution,
    ratio: scene.ratio,
    duration: scene.durationSeconds,
    seed: scene.seed ?? undefined,
    camera_fixed: scene.cameraFixed,
    generate_audio: scene.generateAudio,
    watermark: scene.watermark,
    return_last_frame: true,
  };
  const quote = quoteSeedanceCredits({
    modelId: model.modelId,
    durationSeconds: scene.durationSeconds,
    resolution: scene.resolution,
    ratio: scene.ratio,
    generateAudio: scene.generateAudio,
    watermark: scene.watermark,
  });
  const credits = quote.totalCredits;
  await assertRateAndBudget(input.userId, scene.projectId, credits);

  const task = await prisma.generationTask.create({
    data: {
      userId: input.userId,
      projectId: scene.projectId,
      sceneId: scene.id,
      idempotencyKey: input.idempotencyKey,
      provider: isBytePlusDemoMode() ? "byteplus-demo" : "byteplus",
      modelId: model.modelId,
      requestPayload: { ...requestPayload, rudyoQuote: quote } as object,
      estimatedCredits: isBytePlusDemoMode() ? 0 : credits,
      estimatedCostUsd: null,
    },
  });

  if (isBytePlusDemoMode()) {
    return prisma.$transaction(async (tx) => {
      await tx.storyboardScene.update({ where: { id: scene.id }, data: { status: StoryboardSceneStatus.COMPLETED, modelId: model.modelId } });
      return tx.generationTask.update({
        where: { id: task.id },
        data: {
          bytePlusTaskId: `demo-${task.id}`,
          status: GenerationTaskStatus.SUCCEEDED,
          responsePayload: { demo: true, message: "Simulation terminée : aucune vidéo réelle n’a été générée." },
          completedAt: new Date(),
        },
      });
    });
  }

  const reservation = await reserveCredits({
    userId: input.userId,
    action: "seedance_video",
    amount: credits,
    description: `Génération Seedance : ${scene.title}`,
    metadata: { taskId: task.id, projectId: scene.projectId },
    idempotencyKey: `seedance:${input.idempotencyKey}`,
  });
  await prisma.generationTask.update({ where: { id: task.id }, data: { status: GenerationTaskStatus.SUBMITTED, creditReservationId: reservation.id } });

  let remote: BytePlusTask;
  try {
    remote = await bytePlusClient.createTask(requestPayload);
  } catch (error) {
    const unknown = error instanceof BytePlusApiError && error.code === "submission_unknown";
    if (!unknown) await refundCreditUsage(reservation.id);
    return prisma.generationTask.update({
      where: { id: task.id },
      data: {
        status: unknown ? GenerationTaskStatus.SUBMITTED : GenerationTaskStatus.REFUNDED,
        errorCode: error instanceof BytePlusApiError ? error.code : "generation_error",
        errorMessage: safeMessage(error),
      },
    });
  }

  const submitted = await prisma.$transaction(async (tx) => {
      await tx.storyboardScene.update({ where: { id: scene.id }, data: { status: StoryboardSceneStatus.QUEUED, modelId: model.modelId } });
      return tx.generationTask.update({
        where: { id: task.id },
        data: { bytePlusTaskId: remote.id, status: mapRemoteStatus(remote), responsePayload: remote as object },
      });
    });
  await confirmCreditUsage(reservation.id, { providerTaskId: remote.id });
  return submitted;
}

async function downloadPermanentVideo(taskId: string, userId: string, sourceUrl: string) {
  const url = assertSecureRemoteUrl(sourceUrl);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Le résultat BytePlus n’a pas pu être sauvegardé avant son expiration.");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 500 * 1024 * 1024) throw new Error("La vidéo générée dépasse la limite de stockage Rudyo.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 500 * 1024 * 1024) throw new Error("La vidéo générée dépasse la limite de stockage Rudyo.");
  const task = await prisma.generationTask.findFirstOrThrow({ where: { id: taskId, userId }, select: { projectId: true } });
  const key = `users/${userId}/projects/${task.projectId}/generations/${taskId}/video.mp4`;
  await putStorageBuffer(key, buffer, { contentType: "video/mp4" });
  return toClientFileRef(key);
}

async function downloadPermanentThumbnail(taskId: string, userId: string, sourceUrl: string) {
  const url = assertSecureRemoteUrl(sourceUrl);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("La miniature BytePlus n’a pas pu être sauvegardée.");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 20 * 1024 * 1024) throw new Error("La miniature dépasse la limite de stockage Rudyo.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 20 * 1024 * 1024) throw new Error("La miniature dépasse la limite de stockage Rudyo.");
  const contentType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const task = await prisma.generationTask.findFirstOrThrow({ where: { id: taskId, userId }, select: { projectId: true } });
  const key = `users/${userId}/projects/${task.projectId}/generations/${taskId}/thumbnail.${extension}`;
  await putStorageBuffer(key, buffer, { contentType });
  return toClientFileRef(key);
}

export async function syncGenerationTask(taskId: string, userId: string) {
  const stored = await prisma.generationTask.findFirst({ where: { id: taskId, userId } });
  if (!stored) throw new Error("Tâche introuvable.");
  if (stored.provider === "byteplus-demo" || !stored.bytePlusTaskId) return stored;

  const remote = await bytePlusClient.getTask(stored.bytePlusTaskId);
  const status = mapRemoteStatus(remote);
  let permanentVideoUrl = stored.permanentVideoUrl;
  let thumbnailUrl = stored.thumbnailUrl;
  if (status === GenerationTaskStatus.SUCCEEDED && remote.content?.video_url && !permanentVideoUrl) {
    permanentVideoUrl = await downloadPermanentVideo(stored.id, userId, remote.content.video_url);
  }
  if (status === GenerationTaskStatus.SUCCEEDED && remote.content?.last_frame_url && !thumbnailUrl) {
    try {
      thumbnailUrl = await downloadPermanentThumbnail(stored.id, userId, remote.content.last_frame_url);
    } catch {
      // La vidéo permanente reste prioritaire ; le prochain polling retentera la miniature.
    }
  }
  const tokens = remote.usage?.completion_tokens ?? null;
  const actualUsd = costUsd(stored.modelId, tokens);
  const eurRate = Number(process.env.USD_TO_EUR_RATE);
  const actualEur = actualUsd !== null && Number.isFinite(eurRate) && eurRate > 0 ? actualUsd * eurRate : null;

  let updated = await prisma.$transaction(async (tx) => {
    const task = await tx.generationTask.update({
      where: { id: stored.id },
      data: {
        status,
        responsePayload: remote as object,
        errorCode: remote.error?.code,
        errorMessage: remote.error?.message?.slice(0, 300),
        sourceVideoUrl: remote.content?.video_url,
        permanentVideoUrl,
        thumbnailUrl,
        actualCompletionTokens: tokens,
        actualCostUsd: actualUsd,
        lastPolledAt: new Date(),
        completedAt: status === GenerationTaskStatus.SUCCEEDED || TERMINAL_FAILURES.has(status) ? new Date() : undefined,
      },
    });
    await tx.storyboardScene.update({ where: { id: stored.sceneId }, data: { status: mapSceneStatus(status) } });
    if (status === GenerationTaskStatus.SUCCEEDED && permanentVideoUrl) {
      await tx.generationVariant.upsert({
        where: { taskId_variantNumber: { taskId: stored.id, variantNumber: 1 } },
        update: { videoUrl: permanentVideoUrl, thumbnailUrl },
        create: { taskId: stored.id, sceneId: stored.sceneId, variantNumber: 1, videoUrl: permanentVideoUrl, thumbnailUrl, durationSeconds: null },
      });
      if (tokens !== null) {
        await tx.tokenUsage.upsert({
          where: { taskId: stored.id },
          update: { completionTokens: tokens, costUsd: actualUsd, costEur: actualEur },
          create: {
            userId, projectId: stored.projectId, sceneId: stored.sceneId, taskId: stored.id,
            modelId: stored.modelId, completionTokens: tokens, costUsd: actualUsd,
            costEur: actualEur, creditsCharged: stored.estimatedCredits,
          },
        });
      }
    }
    return task;
  });

  if (TERMINAL_FAILURES.has(status) && !TERMINAL_FAILURES.has(stored.status) && stored.creditReservationId) {
    await refundCreditUsage(stored.creditReservationId);
    updated = await prisma.generationTask.update({ where: { id: stored.id }, data: { status: GenerationTaskStatus.REFUNDED } });
  }
  return updated;
}

export async function cancelGenerationTask(taskId: string, userId: string) {
  const task = await prisma.generationTask.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error("Tâche introuvable.");
  if (task.provider === "byteplus-demo") return task;
  if (!task.bytePlusTaskId) throw new Error("Cette tâche ne possède pas d’identifiant BytePlus vérifiable.");
  if (task.status === GenerationTaskStatus.PROCESSING) throw new Error("BytePlus ne permet pas d’annuler une tâche déjà en cours.");
  await bytePlusClient.deleteTask(task.bytePlusTaskId);
  if (task.status === GenerationTaskStatus.SUBMITTED && task.creditReservationId) {
    await refundCreditUsage(task.creditReservationId);
  }
  return prisma.$transaction(async (tx) => {
    await tx.storyboardScene.update({ where: { id: task.sceneId }, data: { status: StoryboardSceneStatus.CANCELED } });
    return tx.generationTask.update({ where: { id: task.id }, data: { status: task.creditReservationId ? GenerationTaskStatus.REFUNDED : GenerationTaskStatus.CANCELLED, completedAt: new Date() } });
  });
}
