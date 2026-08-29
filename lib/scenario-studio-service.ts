import "server-only";

import { Prisma, ScenarioVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildStructuredScenario, generatedScenarioSchema, stableScenarioHash, validateScenarioQuality, type GeneratedScenario } from "@/lib/scenario-studio";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function projectScenarioFingerprint(project: {
  summary: string | null;
  visualStyle: string | null;
  billedDurationSeconds: number | null;
  durationSeconds: number | null;
  mediaAssets: Array<{ id: string; type: string; createdAt: Date }>;
  updatedAt: Date;
}) {
  return stableScenarioHash({
    idea: project.summary || "",
    style: project.visualStyle || "",
    durationMs: Math.round((project.billedDurationSeconds || project.durationSeconds || 0) * 1000),
    projectUpdatedAt: project.updatedAt.toISOString(),
    assets: project.mediaAssets.filter((asset) => asset.type === "AUDIO" || asset.type === "ARTIST_PORTRAIT").map((asset) => [asset.id, asset.type, asset.createdAt.toISOString()]).sort(),
  });
}

export async function createScenarioVersionFromLegacyProject(projectId: string, userId: string) {
  const project = await prisma.videoProject.findFirst({
    where: { id: projectId, userId },
    include: { mediaAssets: true, scenes: { orderBy: { order: "asc" } }, scenarioVersions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!project) throw new Error("Projet introuvable.");
  const audioDurationMs = Math.round((project.billedDurationSeconds || project.durationSeconds || 0) * 1000);
  const sourceFingerprint = projectScenarioFingerprint(project);
  const version = (project.scenarioVersions[0]?.version || 0) + 1;

  // La ligne existe avant toute génération. Une actualisation retrouve donc
  // toujours le statut, même si le fournisseur ou le processus s'interrompt.
  const record = await prisma.scenarioVersion.create({
    data: {
      projectId, userId, version, status: ScenarioVersionStatus.GENERATING,
      audioDurationMs, sourcePrompt: project.summary || "Clip musical sans idée renseignée",
      sourceFingerprint, provider: "local", model: "scenario-structure-mock-v1", estimatedCostCents: 0,
    },
  });

  try {
    const structure = buildStructuredScenario({
      title: project.title,
      idea: project.summary || "Construire un clip musical cohérent autour de l'artiste et de la musique.",
      style: project.visualStyle,
      audioDurationMs,
      shots: project.scenes.map((scene) => ({
        id: scene.id, order: scene.order, title: scene.title,
        startTimeSeconds: scene.startTimeSeconds, endTimeSeconds: scene.endTimeSeconds,
        prompt: scene.prompt, description: scene.location, cameraMovement: scene.cameraMovement,
        lighting: scene.mood, continuityNotes: scene.negativePrompt,
      })),
    });
    const issues = validateScenarioQuality(structure);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(" "));
    const legacyByStart = new Map(project.scenes.map((scene) => [Math.round(scene.startTimeSeconds * 1000), scene.id]));
    const references = [
      ...structure.visualBible.cast.map((item) => ({ ...item, kind: "CAST" as const })),
      ...structure.visualBible.locations.map((item) => ({ ...item, kind: "LOCATION" as const })),
      ...structure.visualBible.props.map((item) => ({ ...item, kind: "PROP" as const })),
    ];
    const contentHash = stableScenarioHash(structure);
    let firstSceneId: string | null = null;
    await prisma.$transaction(async (tx) => {
      await tx.visualReference.createMany({ data: references.map((reference) => ({ scenarioVersionId: record.id, stableKey: reference.key, kind: reference.kind, name: reference.key, description: reference.description, continuityJson: json({}) })) });
      for (const scene of structure.scenes) {
        const savedScene = await tx.scenarioScene.create({ data: {
          scenarioVersionId: record.id, position: scene.position, title: scene.title,
          startMs: scene.startMs, endMs: scene.endMs, narrativeContent: scene.narrativeContent,
          emotionalArc: scene.emotionalArc, soundVibe: scene.soundVibe,
          contextualPosition: scene.contextualPosition, pacing: scene.pacing, transitionOut: scene.transitionOut,
        } });
        firstSceneId ||= savedScene.id;
        for (const shot of scene.shots) {
          const savedShot = await tx.scenarioShot.create({ data: {
            sceneId: savedScene.id, legacySceneId: legacyByStart.get(shot.startMs), position: shot.position,
            startMs: shot.startMs, endMs: shot.endMs, shotFunction: shot.shotFunction,
            startFrame: shot.startFrame, actionAndCamera: shot.actionAndCamera,
            environmentalDynamics: shot.environmentalDynamics, endFrame: shot.endFrame,
            seedancePrompt: shot.seedancePrompt, cameraMovement: shot.cameraMovement,
            continuityJson: json({ castKeys: shot.castKeys, locationKeys: shot.locationKeys, propKeys: shot.propKeys }),
          } });
          await tx.storyboardFrame.create({ data: { shotId: savedShot.id, userId, status: "PENDING", provider: "mock", model: "storyboard-placeholder-v1", estimatedCostCents: 0, sourcePromptHash: stableScenarioHash({ prompt: shot.seedancePrompt, references: shot.castKeys.concat(shot.locationKeys, shot.propKeys) }) } });
        }
      }
      await tx.scenarioVersion.update({ where: { id: record.id }, data: { status: ScenarioVersionStatus.READY, structureJson: json(structure), contentHash } });
    });
    return { ...record, status: ScenarioVersionStatus.READY, structureJson: structure, contentHash, firstSceneId };
  } catch (error) {
    await prisma.scenarioVersion.update({ where: { id: record.id }, data: { status: ScenarioVersionStatus.FAILED, structureJson: json({ error: error instanceof Error ? error.message : "Génération impossible" }) } }).catch(() => undefined);
    throw error;
  }
}

export function scenarioInclude() {
  return {
    references: true,
    scenes: { orderBy: { position: "asc" as const }, include: { shots: { orderBy: { position: "asc" as const }, include: { storyboard: true } } } },
  };
}

export async function validateScenarioForProject(projectId: string, userId: string, versionId: string) {
  const [project, version] = await Promise.all([
    prisma.videoProject.findFirst({ where: { id: projectId, userId }, include: { mediaAssets: true } }),
    prisma.scenarioVersion.findFirst({ where: { id: versionId, projectId, userId }, include: scenarioInclude() }),
  ]);
  if (!project || !version) throw new Error("Scénario introuvable.");
  if (version.status === ScenarioVersionStatus.VALIDATED) return version;
  if (version.status !== ScenarioVersionStatus.READY) throw new Error("Ce scénario n'est pas prêt à être validé.");
  if (projectScenarioFingerprint(project) !== version.sourceFingerprint) throw new Error("La photo, la musique ou l'idée a changé. Préparez une nouvelle version.");
  const structure = generatedScenarioSchema.parse(version.structureJson);
  const issues = validateScenarioQuality(structure);
  if (issues.length) throw new Error(issues[0].message);
  return prisma.$transaction(async (tx) => {
    await tx.scenarioVersion.updateMany({ where: { projectId, userId, status: ScenarioVersionStatus.VALIDATED, id: { not: versionId } }, data: { status: ScenarioVersionStatus.SUPERSEDED } });
    return tx.scenarioVersion.update({ where: { id: versionId }, data: { status: ScenarioVersionStatus.VALIDATED, validatedAt: new Date() } });
  });
}

export function toGeneratedScenario(version: Awaited<ReturnType<typeof prisma.scenarioVersion.findFirst>>): GeneratedScenario | null {
  if (!version?.structureJson) return null;
  const parsed = generatedScenarioSchema.safeParse(version.structureJson);
  return parsed.success ? parsed.data : null;
}
