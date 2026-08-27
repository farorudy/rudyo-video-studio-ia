import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import ffprobe from "@ffprobe-installer/ffprobe";
import { prisma } from "../lib/prisma";
import { refundCreditUsage } from "../lib/credit-utils";
import { openStorageStream, storageKeyFromClientRef } from "../lib/storage";
import { validateClipScenario } from "../lib/tiktok-offer";

const execute = promisify(execFile);
const apply = process.argv.includes("--apply");
const temp = await mkdtemp(path.join(os.tmpdir(), "rudyo-invalid-clips-"));

async function measuredDuration(key: string, id: string) {
  const stored = await openStorageStream(key);
  if (!stored) return null;
  const target = path.join(temp, `${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`);
  await pipeline(Readable.fromWeb(stored.stream as never), createWriteStream(target, { mode: 0o600 }));
  const { stdout } = await execute(ffprobe.path, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", target], { timeout: 120_000 });
  const duration = Number(stdout.trim());
  return Number.isFinite(duration) ? duration : null;
}

try {
  const projects = await prisma.videoProject.findMany({
    where: { clipPlan: { not: null }, finalExports: { some: { status: "COMPLETED" } } },
    include: { scenes: { orderBy: { order: "asc" } }, finalExports: { where: { status: "COMPLETED" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const invalid: Array<{ projectId: string; exportId: string; reason: string; reservationId: string | null }> = [];
  for (const project of projects) {
    const expected = project.billedDurationSeconds || project.durationSeconds || 0;
    let reason = "";
    try { validateClipScenario(project.scenes, expected); } catch (error) { reason = error instanceof Error ? error.message : "SCENARIO_INVALID"; }
    const exported = project.finalExports[0];
    if (!reason && exported) {
      const key = exported.storageKey || storageKeyFromClientRef(exported.url);
      const actual = key ? await measuredDuration(key, exported.id).catch(() => null) : null;
      if (actual === null) reason = "FINAL_FILE_MISSING_OR_UNREADABLE";
      else if (Math.abs(actual - expected) > 2) reason = `FINAL_DURATION_MISMATCH:${actual.toFixed(3)}:${expected}`;
    }
    if (reason && exported) invalid.push({ projectId: project.id, exportId: exported.id, reason, reservationId: project.creditReservationId });
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", inspected: projects.length, invalid: invalid.length, projects: invalid }, null, 2));
  if (apply) {
    for (const item of invalid) {
      await prisma.$transaction([
        prisma.finalExport.updateMany({ where: { id: item.exportId, status: "COMPLETED" }, data: { status: "FAILED", errorMessage: `Migration de conformité: ${item.reason}` } }),
        prisma.videoProject.updateMany({ where: { id: item.projectId }, data: { status: "DRAFT", creditReservationId: null } }),
      ]);
      if (item.reservationId) await refundCreditUsage(item.reservationId);
    }
  }
} finally {
  await prisma.$disconnect();
  await rm(temp, { recursive: true, force: true });
}
