import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { SystemTestScenario } from "@prisma/client";
import type { AdminIdentity } from "@/lib/admin-auth";
import { enqueueMontageJob } from "@/lib/montage/queue";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { prisma } from "@/lib/prisma";
import { deleteStorage, putStorageBuffer, toClientFileRef } from "@/lib/storage";
import { createSyntheticMontageFixtures } from "@/lib/system-tests/fixtures";
import { hashSystemTestToken } from "@/lib/system-tests/tokens";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function step(name: string, message: string) {
  return { name, status: "SUCCEEDED", at: new Date().toISOString(), message };
}

export function systemTestsEnabled() {
  return process.env.E2E_MONTAGE_TEST_ENABLED === "true";
}

export async function startSystemMontageTest(admin: AdminIdentity, scenario: SystemTestScenario) {
  if (!systemTestsEnabled()) throw new Error("SYSTEM_TEST_DISABLED");
  const worker = await getMontageServiceStatus();
  if (!worker.available) throw new Error("WORKER_OFFLINE");
  const user = await prisma.user.findUnique({ where: { email: admin.email }, select: { id: true, creditsRemaining: true } });
  if (!user) throw new Error("ADMIN_USER_REQUIRED");

  const runId = randomUUID();
  const retentionHours = positiveInteger(process.env.E2E_TEST_RETENTION_HOURS, 24);
  const expiresAt = new Date(Date.now() + retentionHours * 60 * 60_000);
  const token = randomBytes(32).toString("base64url");
  await prisma.systemTestRun.create({
    data: {
      id: runId,
      adminSubject: admin.subject,
      userId: user.id,
      scenario,
      balanceBefore: user.creditsRemaining,
      expiresAt,
      downloadTokenHash: hashSystemTestToken(token),
      downloadExpiresAt: new Date(Date.now() + 30 * 60_000),
      steps: [step("PREPARING_FIXTURES", "Préparation des fixtures synthétiques")],
    },
  });

  const uploadedKeys: string[] = [];
  let projectId: string | null = null;
  try {
    const fixtures = await createSyntheticMontageFixtures();
    const prefix = `system-tests/${runId}`;
    const imageKey = `${prefix}/fixtures/artist.png`;
    const audioKey = `${prefix}/fixtures/music.wav`;
    const videoKeys = fixtures.videos.map((_, index) => `${prefix}/fixtures/scene-${index + 1}.mp4`);
    await Promise.all([
      putStorageBuffer(imageKey, fixtures.image.buffer, { contentType: fixtures.image.mimeType, access: "private" }),
      putStorageBuffer(audioKey, fixtures.audio.buffer, { contentType: fixtures.audio.mimeType, access: "private" }),
      ...fixtures.videos.map((fixture, index) => putStorageBuffer(
        videoKeys[index],
        scenario === SystemTestScenario.INVALID_VIDEO && index === 0 ? Buffer.from("invalid-video-fixture") : fixture.buffer,
        { contentType: fixture.mimeType, access: "private" },
      )),
    ]);
    uploadedKeys.push(imageKey, audioKey, ...videoKeys);

    const project = await prisma.videoProject.create({
      data: {
        userId: user.id,
        title: `SYSTEM TEST ${runId.slice(0, 8)}`,
        artistName: "Synthetic Fixture",
        durationSeconds: 3,
        finalFormat: "16:9",
        status: "RENDERING",
        source: "SYSTEM_TEST",
        billingMode: "NON_BILLABLE",
        demoMode: true,
      },
    });
    projectId = project.id;
    await prisma.systemTestRun.update({
      where: { id: runId },
      data: {
        projectId,
        steps: [
          step("PREPARING_FIXTURES", "Fixtures synthétiques créées"),
          step("UPLOADING_FIXTURES", "Fixtures envoyées dans le stockage privé"),
        ],
      },
    });

    const imageId = randomUUID();
    const audioId = randomUUID();
    await prisma.mediaAsset.createMany({ data: [
      { id: imageId, userId: user.id, projectId, type: "ARTIST_PORTRAIT", fileName: fixtures.image.fileName, storageKey: imageKey, url: toClientFileRef(imageKey), mimeType: fixtures.image.mimeType, sizeBytes: fixtures.image.buffer.length, metadata: { source: "SYSTEM_TEST", billingMode: "NON_BILLABLE", testRunId: runId } },
      { id: audioId, userId: user.id, projectId, type: "AUDIO", fileName: fixtures.audio.fileName, storageKey: audioKey, url: toClientFileRef(audioKey), mimeType: fixtures.audio.mimeType, sizeBytes: fixtures.audio.buffer.length, metadata: { source: "SYSTEM_TEST", billingMode: "NON_BILLABLE", testRunId: runId } },
    ] });

    for (let index = 0; index < videoKeys.length; index += 1) {
      const scene = await prisma.storyboardScene.create({ data: {
        projectId, order: index, title: `Fixture ${index + 1}`, startTimeSeconds: index,
        endTimeSeconds: index + 1, durationSeconds: 1, prompt: "Synthetic system fixture",
        resolution: "720p", ratio: "16:9", status: "COMPLETED",
      } });
      const task = await prisma.generationTask.create({ data: {
        userId: user.id, projectId, sceneId: scene.id,
        idempotencyKey: `system-test:${runId}:scene:${index + 1}`,
        provider: "TEST_FIXTURE", source: "SYSTEM_TEST", billingMode: "NON_BILLABLE",
        modelId: "synthetic-fixture-v1", status: "SUCCEEDED", estimatedCredits: 0,
        requestPayload: { source: "SYSTEM_TEST", billingMode: "NON_BILLABLE", testRunId: runId },
        permanentVideoUrl: toClientFileRef(videoKeys[index]), completedAt: new Date(),
      } });
      await prisma.generationVariant.create({ data: {
        taskId: task.id, sceneId: scene.id, variantNumber: 1,
        videoUrl: toClientFileRef(videoKeys[index]), durationSeconds: 1, selected: true,
      } });
    }

    const job = await enqueueMontageJob({
      projectId,
      userId: user.id,
      resolution: "720p",
      format: "16:9",
      transition: "cut",
      subtitles: false,
      systemTestRunId: runId,
      systemTestScenario: scenario,
    });
    if (scenario === SystemTestScenario.IDEMPOTENCY_REPLAY) {
      const replay = await enqueueMontageJob({
        projectId, userId: user.id, resolution: "720p", format: "16:9", transition: "cut",
        subtitles: false, systemTestRunId: runId, systemTestScenario: scenario,
      });
      if (replay.id !== job.id) throw new Error("IDEMPOTENCY_REPLAY_FAILED");
    }

    if (scenario === SystemTestScenario.MISSING_AUDIO) await deleteStorage(audioKey);
    if (scenario === SystemTestScenario.EXPIRED_LEASE) {
      await prisma.montageJob.update({ where: { id: job.id }, data: {
        status: "CLAIMED", lockedBy: "expired-system-test-worker",
        lockedAt: new Date(Date.now() - 120_000), leaseExpiresAt: new Date(Date.now() - 60_000),
      } });
    }
    return { runId, status: "QUEUED" as const, downloadToken: token };
  } catch (error) {
    await Promise.all(uploadedKeys.map((key) => deleteStorage(key).catch(() => false)));
    if (projectId) await prisma.videoProject.delete({ where: { id: projectId } }).catch(() => undefined);
    const code = error instanceof Error ? error.message.split(":", 1)[0].replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 80) : "SYSTEM_TEST_FAILED";
    await prisma.systemTestRun.update({ where: { id: runId }, data: {
      status: "FAILED", errorCode: code, errorMessage: `Le test système a échoué (${code}).`, completedAt: new Date(),
    } });
    throw error;
  }
}

export async function issueSystemTestDownloadToken(runId: string, adminSubject: string) {
  const token = randomBytes(32).toString("base64url");
  const updated = await prisma.systemTestRun.updateMany({
    where: { id: runId, adminSubject, status: "SUCCEEDED", cleanedAt: null },
    data: { downloadTokenHash: hashSystemTestToken(token), downloadExpiresAt: new Date(Date.now() + 15 * 60_000) },
  });
  return updated.count === 1 ? token : null;
}
