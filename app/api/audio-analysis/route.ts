import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { putStorageBuffer, putStorageText, toClientFileRef } from "@/lib/storage";
import {
  beginIdempotentRequest,
  enforceApiRateLimit,
  finishIdempotentRequest,
  readFormDataWithLimit,
  requireIdempotencyKey,
  sniffMime,
} from "@/lib/request-security";

const execFileAsync = promisify(execFile);
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

function safeName(value: string) {
  return path.basename(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
}

function sections(duration: number) {
  const points = [0, 0.12, 0.42, 0.68, 0.84, 1].map((ratio) => Math.round(duration * ratio * 100) / 100);
  return ["Intro", "Couplet", "Refrain", "Pont", "Outro"].map((label, index) => ({
    id: label.toLowerCase(), label, startSec: points[index], endSec: points[index + 1],
    energy: (["low", "medium", "high", "medium", "low"] as const)[index],
  }));
}

export async function POST(request: NextRequest) {
  let taskDir = "";
  let idempotencyId: string | null = null;
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ error: "Authentification vérifiée requise." }, { status: 401 });
    await enforceApiRateLimit(request, "audio-analysis", user.id, 3, 60_000);
    const key = requireIdempotencyKey(request);
    const idempotency = await beginIdempotentRequest("audio-analysis", user.id, key);
    idempotencyId = idempotency.record.id;
    if (!idempotency.fresh) {
      if (idempotency.record.responseCode && idempotency.record.response) return NextResponse.json(idempotency.record.response, { status: idempotency.record.responseCode });
      return NextResponse.json({ error: "Cette analyse est déjà en cours." }, { status: 409 });
    }

    const form = await readFormDataWithLimit(request, MAX_AUDIO_BYTES + 1024 * 1024);
    const projectId = String(form.get("projectId") || "");
    const input = form.get("audio");
    if (!(input instanceof File) || !projectId) throw new Error("Fichier audio ou projet manquant.");
    const project = await prisma.videoProject.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    if (input.size <= 0 || input.size > MAX_AUDIO_BYTES) throw new Error("Fichier audio trop volumineux.");

    const buffer = Buffer.from(await input.arrayBuffer());
    const actualMime = sniffMime(buffer);
    if (!actualMime || !["audio/mpeg", "audio/wav"].includes(actualMime)) throw new Error("Le contenu réel du fichier audio n’est pas autorisé.");

    const assetId = crypto.randomUUID();
    const fileName = safeName(input.name || `audio-${assetId}`);
    taskDir = path.join(os.tmpdir(), "rudyo-ai", user.id, projectId, idempotency.record.id);
    const resolvedRoot = path.resolve(os.tmpdir(), "rudyo-ai", user.id, projectId);
    const resolvedTask = path.resolve(taskDir);
    if (!resolvedTask.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Chemin de tâche invalide.");
    await fs.mkdir(taskDir, { recursive: true });
    const tempPath = path.join(taskDir, fileName);
    await fs.writeFile(tempPath, buffer);
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", tempPath], {
      timeout: 20_000, windowsHide: true, maxBuffer: 1024 * 1024,
    });
    const durationSec = Math.round(Number.parseFloat(stdout.trim()) * 100) / 100;
    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 3_600) throw new Error("Durée audio invalide.");
    const storageBase = `users/${user.id}/projects/${projectId}/${assetId}`;
    const storedAudio = await putStorageBuffer(`${storageBase}/audio`, buffer, { contentType: actualMime, access: "private" });
    const analysis = { provider: "local-ffprobe", fileName, durationSec, bpm: durationSec <= 90 ? 124 : durationSec <= 180 ? 112 : 98, sections: sections(durationSec), analyzedAt: new Date().toISOString() };
    const storedAnalysis = await putStorageText(`${storageBase}/analysis.json`, JSON.stringify(analysis), { contentType: "application/json", access: "private" });
    const response = { success: true, result: { ...analysis, audioRef: toClientFileRef(`${storageBase}/audio`, storedAudio.url), analysisRef: toClientFileRef(`${storageBase}/analysis.json`, storedAnalysis.url) } };
    await finishIdempotentRequest(idempotency.record.id, 200, response);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error && /^(Fichier|Le contenu|Durée|Chemin|En-tête)/.test(error.message)
      ? error.message : "L’analyse audio a échoué.";
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 400, { error: message }).catch(() => undefined);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    if (taskDir) await fs.rm(taskDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
