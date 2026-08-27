import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.includes("127.0.0.1:55432/rudyo_worker_local")) throw new Error("Base locale isolée requise.");
const prisma = new PrismaClient();
const userId = "worker-failure-local";
const email = "worker-failure@rudyo.test";
const fixtureDirectory = path.resolve("media", "local-failure-fixtures");
await mkdir(fixtureDirectory, { recursive: true });
await writeFile(path.join(fixtureDirectory, "invalid-audio.bin"), "not-an-audio-file", "utf8");

try {
  await prisma.videoProject.deleteMany({ where: { userId } });
  await prisma.creditUsage.deleteMany({ where: { userId } });
  await prisma.creditTransaction.deleteMany({ where: { userId } });
  await prisma.user.upsert({
    where: { email },
    create: { id: userId, email, name: "Échec worker local", emailVerifiedAt: new Date(), credits: 0, creditsTotal: 3_500, creditsRemaining: 0, monthlyLimit: 3_500 },
    update: { credits: 0, creditsTotal: 3_500, creditsUsed: 0, creditsRemaining: 0, monthlyLimit: 3_500 },
  });
  const reservation = await prisma.creditTransaction.create({ data: { userId, type: "RESERVATION", action: "CLIP_PACK", creditsAmount: -3_500, description: "Réservation test échec FFmpeg", idempotencyKey: `failure:${randomUUID()}`, status: "RESERVED" } });
  const project = await prisma.videoProject.create({ data: { userId, title: "Test échec FFmpeg", artistName: "Artiste synthétique", durationSeconds: 15, billedDurationSeconds: 15, status: "GENERATING", clipPlan: "TIKTOK", summary: "Test local contrôlé", creditReservationId: reservation.id } });
  const finalExportId = randomUUID();
  const jobId = randomUUID();
  const outputStorageKey = `users/${userId}/projects/${project.id}/failure/final.mp4`;
  await prisma.finalExport.create({ data: { id: finalExportId, projectId: project.id, status: "QUEUED", format: "9:16", resolution: "1080p", settings: { localFailureTest: true } } });
  await prisma.clipWorkerJob.create({
    data: {
      id: jobId, userId, projectId: project.id, finalExportId, maxAttempts: 1,
      idempotencyKey: `clip-worker:${project.id}`, outputPath: outputStorageKey,
      inputManifest: {
        version: 1, jobId, userId, projectId: project.id, finalExportId,
        photoStorageKey: "local-test-fixtures/portrait-synthetique.png",
        audioStorageKey: "local-failure-fixtures/invalid-audio.bin",
        audioStartSeconds: 0, durationSeconds: 15, outputStorageKey,
        plan: "TIKTOK", creditReservationId: reservation.id,
      },
      events: { create: { status: "QUEUED", progress: 0, message: "Test local d’échec contrôlé" } },
    },
  });

  let job;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    job = await prisma.clipWorkerJob.findUniqueOrThrow({ where: { id: jobId } });
    if (["FAILED", "REFUNDED"].includes(job.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(job?.status, "REFUNDED");
  assert.match(job?.errorCode || "", /FFPROBE|AUDIO|EXIT/);
  const once = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { creditsRemaining: true } });
  assert.equal(once.creditsRemaining, 3_500);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const twice = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { creditsRemaining: true } });
  assert.equal(twice.creditsRemaining, 3_500);
  assert.equal(await prisma.creditTransaction.count({ where: { userId, status: "REFUNDED" } }), 1);
  console.log(JSON.stringify({ jobStatus: job.status, errorCode: job.errorCode, balanceAfterFailure: twice.creditsRemaining, refunds: 1, projectPreserved: true }));
} finally {
  await prisma.$disconnect();
}
