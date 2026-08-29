"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPageUser } from "@/lib/page-auth";
import { putStorageBuffer } from "@/lib/storage";
import { createScenarioVersionFromLegacyProject, validateScenarioForProject } from "@/lib/scenario-studio-service";

async function owner() {
  const user = await getPageUser();
  if (!user || user.localSession) throw new Error("Authentification requise.");
  return user;
}

export async function validateScenarioAction(projectId: string, versionId: string) {
  const user = await owner();
  await validateScenarioForProject(projectId, user.id, versionId);
  revalidatePath(`/projects/${projectId}/storyboard`);
  revalidatePath("/creations");
  return { ok: true };
}

async function renderMockFrame(projectId: string, userId: string, versionId: string, shotId: string) {
  const key = `users/${userId}/projects/${projectId}/storyboards/${versionId}/${shotId}/frame.png`;
  const buffer = await sharp({ create: { width: 720, height: 1280, channels: 4, background: { r: 12, g: 28, b: 46, alpha: 1 } } }).png().toBuffer();
  await putStorageBuffer(key, buffer, { contentType: "image/png", access: "private" });
  await prisma.storyboardFrame.update({ where: { shotId }, data: { status: "READY", storageKey: key, thumbnailStorageKey: key, provider: "mock", model: "storyboard-placeholder-v1", estimatedCostCents: 0, errorCode: null } });
}

export async function regenerateStoryboardFrameAction(projectId: string, shotId: string) {
  const user = await owner();
  const shot = await prisma.scenarioShot.findFirst({ where: { id: shotId, scene: { scenarioVersion: { projectId, userId: user.id } } }, include: { scene: true } });
  if (!shot) throw new Error("Plan introuvable.");
  await prisma.storyboardFrame.update({ where: { shotId }, data: { status: "GENERATING", errorCode: null } });
  await renderMockFrame(projectId, user.id, shot.scene.scenarioVersionId, shotId);
  revalidatePath(`/projects/${projectId}/storyboard/${shot.sceneId}`);
  return { ok: true };
}

export async function regenerateMissingFramesAction(projectId: string, versionId: string) {
  const user = await owner();
  const version = await prisma.scenarioVersion.findFirst({ where: { id: versionId, projectId, userId: user.id }, include: { scenes: { include: { shots: { include: { storyboard: true } } } } } });
  if (!version) throw new Error("Scénario introuvable.");
  const missing = version.scenes.flatMap((scene) => scene.shots).filter((shot) => shot.storyboard?.status !== "READY");
  for (const shot of missing) await renderMockFrame(projectId, user.id, versionId, shot.id);
  revalidatePath(`/projects/${projectId}/storyboard`);
  return { ok: true, count: missing.length };
}

export async function updateShotPromptAction(projectId: string, shotId: string, prompt: string) {
  const user = await owner();
  const normalized = prompt.trim();
  if (normalized.length < 80) throw new Error("Décrivez le plan avec au moins 80 caractères.");
  const shot = await prisma.scenarioShot.findFirst({ where: { id: shotId, scene: { scenarioVersion: { projectId, userId: user.id } } }, select: { legacySceneId: true } });
  if (!shot?.legacySceneId) throw new Error("Ce plan historique ne peut pas être modifié.");
  await prisma.$transaction([
    prisma.storyboardScene.update({ where: { id: shot.legacySceneId }, data: { prompt: normalized } }),
    prisma.videoProject.update({ where: { id: projectId }, data: { updatedAt: new Date() } }),
  ]);
  const version = await createScenarioVersionFromLegacyProject(projectId, user.id);
  revalidatePath(`/projects/${projectId}/storyboard`);
  revalidatePath("/creations");
  return { ok: true, sceneId: version.firstSceneId };
}
