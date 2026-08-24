import "server-only";

import { createHash, randomUUID } from "crypto";
import { FinalExportStatus, GenerationTaskStatus, MediaAssetType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storageKeyFromClientRef } from "@/lib/storage";
import type { MontageManifest } from "@/lib/montage/types";

type EnqueueOptions = {
  projectId: string;
  userId: string;
  resolution?: "720p" | "1080p";
  transition?: "cut" | "crossfade";
  subtitles?: boolean;
  format?: "16:9" | "9:16" | "1:1";
  systemTestRunId?: string;
  systemTestScenario?: MontageManifest["systemTestScenario"];
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function enqueueMontageJob(options: EnqueueOptions) {
  const project = await prisma.videoProject.findFirst({
    where: { id: options.projectId, userId: options.userId },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: {
          variants: { where: { selected: true }, orderBy: { createdAt: "desc" }, take: 1 },
          generationTasks: {
            where: { status: GenerationTaskStatus.SUCCEEDED },
            orderBy: { completedAt: "desc" },
            take: 1,
          },
        },
      },
      mediaAssets: {
        where: { type: MediaAssetType.AUDIO },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) throw new Error("Projet introuvable.");
  if (project.scenes.length === 0) throw new Error("Aucune scène à monter.");
  const audio = project.mediaAssets[0];
  if (!audio) throw new Error("Musique du projet introuvable.");

  const scenes = project.scenes.map((scene) => {
    const task = scene.generationTasks[0];
    const clientRef = scene.variants[0]?.videoUrl || task?.permanentVideoUrl;
    const storageKey = storageKeyFromClientRef(clientRef);
    if (!task || !storageKey) throw new Error(`La scène ${scene.order + 1} n’est pas prête pour le montage.`);
    return {
      order: scene.order,
      storageKey,
      durationSeconds: scene.variants[0]?.durationSeconds || scene.durationSeconds,
      taskId: task.id,
      creditReservationId: task.creditReservationId,
    };
  });

  const resolution = options.resolution || (project.finalFormat === "9:16" ? "1080p" : "720p");
  const transition = options.transition || "cut";
  const format = options.format || (project.finalFormat === "9:16" ? "9:16" : project.finalFormat === "1:1" ? "1:1" : "16:9");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ projectId: project.id, scenes: scenes.map((scene) => scene.taskId), audio: audio.storageKey, resolution, transition, subtitles: Boolean(options.subtitles), systemTestRunId: options.systemTestRunId, systemTestScenario: options.systemTestScenario }))
    .digest("hex");
  const idempotencyKey = `montage:${fingerprint}`;

  const existing = await prisma.montageJob.findUnique({
    where: { idempotencyKey },
    include: { finalExport: true },
  });
  if (existing) return existing;

  const jobId = randomUUID();
  const finalExportId = randomUUID();
  const generationId = randomUUID();
  const outputPath = options.systemTestRunId
    ? `system-tests/${options.systemTestRunId}/final/clip.mp4`
    : `users/${options.userId}/projects/${project.id}/generations/${generationId}/final/clip.mp4`;
  const manifest: MontageManifest = {
    version: 1,
    jobId,
    userId: options.userId,
    projectId: project.id,
    finalExportId,
    generationId,
    ...(options.systemTestRunId ? { systemTestRunId: options.systemTestRunId } : {}),
    ...(options.systemTestScenario ? { systemTestScenario: options.systemTestScenario } : {}),
    expectedDurationSeconds: project.billedDurationSeconds || project.durationSeconds || scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    scenes: scenes.map(({ order, storageKey, durationSeconds }) => ({ order, storageKey, durationSeconds })),
    audio: { storageKey: audio.storageKey, startSeconds: project.audioStartSeconds, durationSeconds: project.billedDurationSeconds || undefined },
    output: { storageKey: outputPath, format, resolution, transition, subtitles: Boolean(options.subtitles) },
    creditReservationIds: [project.creditReservationId, ...scenes.flatMap((scene) => scene.creditReservationId ? [scene.creditReservationId] : [])].filter((value): value is string => Boolean(value)),
  };

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.finalExport.create({
        data: {
          id: finalExportId,
          projectId: project.id,
          status: FinalExportStatus.QUEUED,
          format,
          resolution,
          settings: { transition, subtitles: Boolean(options.subtitles), generationId },
        },
      });
      const job = await tx.montageJob.create({
        data: {
          id: jobId,
          userId: options.userId,
          projectId: project.id,
          finalExportId,
          generationId,
          inputManifest: manifest as unknown as Prisma.InputJsonValue,
          outputPath,
          idempotencyKey,
          maxAttempts: positiveInteger(process.env.MONTAGE_MAX_ATTEMPTS, 3),
        },
        include: { finalExport: true },
      });
      await tx.montageJobEvent.create({ data: { jobId, status: "QUEUED", progress: 0, message: "Tâche créée" } });
      if (options.systemTestRunId) {
        await tx.systemTestRun.update({
          where: { id: options.systemTestRunId },
          data: { montageJobId: jobId, finalExportId, outputPath, status: "QUEUED" },
        });
      }
      return job;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.montageJob.findUnique({ where: { idempotencyKey }, include: { finalExport: true } });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function enqueueAutomaticMontageIfReady(projectId: string, userId: string) {
  const project = await prisma.videoProject.findFirst({
    where: { id: projectId, userId, scenes: { some: { title: { startsWith: "Clip automatique" } } } },
    select: {
      colors: true,
      scenes: {
        select: { generationTasks: { where: { status: GenerationTaskStatus.SUCCEEDED }, select: { permanentVideoUrl: true }, take: 1 } },
      },
    },
  });
  if (!project || project.scenes.length === 0 || project.scenes.some((scene) => !scene.generationTasks[0]?.permanentVideoUrl)) return null;
  const simpleOptions = project.colors && typeof project.colors === "object" && !Array.isArray(project.colors)
    ? (project.colors as { simpleClip?: { quality?: string; subtitles?: boolean } }).simpleClip
    : undefined;
  const isTikTokClip = Boolean(project.colors && typeof project.colors === "object" && !Array.isArray(project.colors) && "tiktokClip" in project.colors);
  return enqueueMontageJob({
    projectId,
    userId,
    resolution: isTikTokClip || simpleOptions?.quality === "high" ? "1080p" : "720p",
    transition: "cut",
    subtitles: Boolean(simpleOptions?.subtitles),
  });
}
