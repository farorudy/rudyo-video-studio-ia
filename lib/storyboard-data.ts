import "server-only";

import { prisma } from "@/lib/prisma";

export async function loadStoryboardPageData(projectId: string, sceneId: string, userId: string) {
  const scene = await prisma.scenarioScene.findFirst({
    where: { id: sceneId, scenarioVersion: { projectId, userId } },
    include: {
      scenarioVersion: { include: { project: { select: { title: true, maxBudgetCredits: true } }, references: { orderBy: { kind: "asc" } }, scenes: { orderBy: { position: "asc" }, select: { id: true, position: true, title: true } } } },
      shots: { orderBy: { position: "asc" }, include: { storyboard: true } },
    },
  });
  if (!scene) return null;
  const version = scene.scenarioVersion;
  const index = version.scenes.findIndex((item) => item.id === scene.id);
  return {
    projectId,
    projectTitle: version.project.title,
    estimatedClipCredits: version.project.maxBudgetCredits || 0,
    version: { id: version.id, number: version.version, status: version.status, audioDurationMs: version.audioDurationMs, validatedAt: version.validatedAt?.toISOString() || null },
    scene: {
      id: scene.id, position: scene.position, title: scene.title, startMs: scene.startMs, endMs: scene.endMs,
      narrativeContent: scene.narrativeContent, emotionalArc: scene.emotionalArc, soundVibe: scene.soundVibe,
      contextualPosition: scene.contextualPosition, pacing: scene.pacing, transitionOut: scene.transitionOut,
    },
    sceneCount: version.scenes.length,
    previousSceneId: version.scenes[index - 1]?.id || null,
    nextSceneId: version.scenes[index + 1]?.id || null,
    references: version.references.map((reference) => ({ id: reference.id, stableKey: reference.stableKey, kind: reference.kind, name: reference.name, description: reference.description })),
    shots: scene.shots.map((shot) => ({
      id: shot.id, position: shot.position, startMs: shot.startMs, endMs: shot.endMs,
      shotFunction: shot.shotFunction, startFrame: shot.startFrame, actionAndCamera: shot.actionAndCamera,
      environmentalDynamics: shot.environmentalDynamics, endFrame: shot.endFrame,
      seedancePrompt: shot.seedancePrompt, cameraMovement: shot.cameraMovement,
      continuity: shot.continuityJson as { castKeys?: string[]; locationKeys?: string[]; propKeys?: string[] },
      storyboard: shot.storyboard ? { id: shot.storyboard.id, status: shot.storyboard.status, available: Boolean(shot.storyboard.storageKey), errorCode: shot.storyboard.errorCode } : null,
    })),
  };
}

export type StoryboardPageData = NonNullable<Awaited<ReturnType<typeof loadStoryboardPageData>>>;
