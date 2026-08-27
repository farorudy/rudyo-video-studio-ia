import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { attachClipProviderTask, completeClipGenerationTask, completeClipJob, ensureClipGenerationTask, failClipTerminal, failClipValidation, heartbeatClipJob, markClipSubmissionUnknown, retryOrFailClipJob, setClipStage, updateClipProviderProgress } from "./db.js";
import { dimensions, probeMedia, renderMontage, validateAudio, validateVideo } from "./media.js";
import { run } from "./process.js";
import { downloadPrivateBlob, uploadPrivateVideo } from "./storage.js";
import { createSeedanceTask, downloadSeedanceVideo, getSeedanceTask, SeedanceApiError } from "./seedance.js";
import { clipWorkerManifestSchema, type ClipWorkerJob, type ClipWorkerManifest, type MontageManifest } from "./types.js";

/** Écart maximal toléré entre le MP4 livré et la musique commandée. */
export const MAX_DURATION_DRIFT_SECONDS = 2;

/** Résultat non conforme : terminal, remboursé, jamais réessayé. */
export class ClipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClipValidationError";
  }
}

class ClipTerminalError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "ClipTerminalError"; }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function safeDirectory(jobId: string) {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const directory = path.resolve(config.tempDir, `job-${safeId}`);
  if (!directory.startsWith(`${config.tempDir}${path.sep}`)) throw new Error("TEMP_PATH_INVALID");
  return directory;
}

function publicError(error: unknown) {
  const raw = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const code = raw.split(":", 1)[0].replace(/[^A-Z0-9_]/gi, "_").slice(0, 80).toUpperCase() || "CLIP_FAILED";
  return { code, message: `La création a échoué (${code}).` };
}

export async function renderMockClip(options: { photo: string; audio: string; output: string; audioStartSeconds: number; durationSeconds: number }) {
  const audioInfo = await validateAudio(options.audio);
  const availableAudio = Math.max(0.5, audioInfo.duration - options.audioStartSeconds);
  const demoDuration = Math.min(6, options.durationSeconds, availableAudio);
  const size = dimensions("9:16", "720p");
  const directory = path.dirname(options.output);
  const sceneCount = 3;
  const sceneDuration = demoDuration / sceneCount;
  const scenes: string[] = [];
  for (let index = 0; index < sceneCount; index += 1) {
    const scene = path.join(directory, `mock-scene-${index + 1}.mp4`);
    const brightness = (-0.03 + index * 0.03).toFixed(2);
    await run(config.ffmpegPath, [
      "-hide_banner", "-nostdin", "-y", "-loop", "1", "-i", options.photo,
      "-t", sceneDuration.toFixed(3),
      "-vf", `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height},setsar=1,eq=brightness=${brightness},fps=30`,
      "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", scene,
    ], { timeoutMs: 180_000 });
    scenes.push(scene);
  }
  const concatFile = path.join(directory, "mock-scenes.txt");
  await writeFile(concatFile, scenes.map((scene) => `file '${scene.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"), { encoding: "utf8", mode: 0o600 });
  await run(config.ffmpegPath, [
    "-hide_banner", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
    "-ss", options.audioStartSeconds.toFixed(3), "-i", options.audio, "-t", demoDuration.toFixed(3),
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart", options.output,
  ], { timeoutMs: 180_000 });
  return validateVideo(options.output);
}

function assertRealManifest(manifest: ClipWorkerManifest) {
  if (!manifest.referenceAssetUri) throw new ClipTerminalError("BYTEPLUS_REFERENCE_ASSET_REQUIRED", "Le portrait doit être autorisé dans la bibliothèque privée BytePlus.");
  if (manifest.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) !== manifest.durationSeconds) throw new ClipValidationError("Le scénario ne couvre pas exactement la durée commandée.");
  let cursor = 0;
  for (const scene of manifest.scenes) {
    if (scene.order !== cursor) throw new ClipValidationError("L’ordre des scènes est invalide.");
    if (scene.modelId !== config.bytePlusVideoModel) throw new ClipTerminalError("BYTEPLUS_MODEL_MISMATCH", "Le scénario n’utilise pas le modèle Seedance autorisé.");
    cursor += 1;
  }
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, callback: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await callback(items[index], index);
    }
  }));
  return results;
}

async function renderRealClip(job: ClipWorkerJob, manifest: ClipWorkerManifest, directory: string, audio: string, output: string) {
  assertRealManifest(manifest);
  let completed = 0;
  const videos = await mapConcurrent(manifest.scenes, config.seedanceConcurrency, async (scene) => {
    const stored = await ensureClipGenerationTask(job, manifest, scene);
    const sceneStorageKey = `users/${job.userId}/projects/${job.projectId}/generations/${job.id}/scene-${String(scene.order + 1).padStart(2, "0")}.mp4`;
    const localVideo = path.join(directory, `seedance-scene-${String(scene.order + 1).padStart(2, "0")}.mp4`);
    if (stored.status === "SUCCEEDED" && stored.permanentVideoUrl) {
      await downloadPrivateBlob(sceneStorageKey, localVideo);
      completed += 1;
      return localVideo;
    }
    if (stored.errorCode === "SUBMISSION_UNKNOWN" && !stored.bytePlusTaskId) throw new ClipTerminalError("SEEDANCE_SUBMISSION_UNKNOWN", "Une soumission BytePlus est incertaine ; elle ne sera pas dupliquée.");
    let providerTaskId = stored.bytePlusTaskId;
    if (!providerTaskId) {
      let created;
      try { created = await createSeedanceTask({ prompt: scene.prompt, durationSeconds: scene.durationSeconds, referenceAssetUri: manifest.referenceAssetUri! }); }
      catch (error) {
        if (error instanceof SeedanceApiError && error.code === "SUBMISSION_UNKNOWN") {
          await markClipSubmissionUnknown(stored.id);
          throw new ClipTerminalError("SEEDANCE_SUBMISSION_UNKNOWN", "Une soumission BytePlus est incertaine ; elle ne sera pas dupliquée.");
        }
        if (error instanceof SeedanceApiError && !error.retryable) throw new ClipTerminalError(error.code, error.message);
        throw error;
      }
      if (!created.id) throw new ClipTerminalError("BYTEPLUS_TASK_ID_MISSING", "BytePlus n’a pas renvoyé d’identifiant de tâche.");
      providerTaskId = created.id;
      await attachClipProviderTask(stored.id, providerTaskId, created);
    }
    const deadline = Date.now() + config.seedanceTaskTimeoutSeconds * 1000;
    let remote;
    while (Date.now() < deadline) {
      remote = await getSeedanceTask(providerTaskId);
      if (remote.status === "succeeded" || remote.status === "failed" || remote.status === "cancelled" || remote.status === "expired") break;
      await updateClipProviderProgress(stored.id, remote);
      await wait(config.seedancePollIntervalMs);
    }
    if (!remote || !remote.status || !["succeeded", "failed", "cancelled", "expired"].includes(remote.status)) throw new Error("BYTEPLUS_TASK_TIMEOUT");
    if (remote.status !== "succeeded" || !remote.content?.video_url) {
      await updateClipProviderProgress(stored.id, remote);
      throw new ClipTerminalError(remote.error?.code || "BYTEPLUS_TASK_FAILED", remote.error?.message || "Une scène Seedance a échoué.");
    }
    await downloadSeedanceVideo(remote.content.video_url, localVideo);
    const checked = await validateVideo(localVideo);
    if (Math.abs(checked.duration - scene.durationSeconds) > MAX_DURATION_DRIFT_SECONDS) throw new ClipValidationError(`La scène ${scene.order + 1} dure ${checked.duration.toFixed(1)} s au lieu de ${scene.durationSeconds} s.`);
    const uploaded = await uploadPrivateVideo(sceneStorageKey, localVideo);
    await completeClipGenerationTask({ job, taskId: stored.id, sceneId: scene.id, remote, providerVideoUrl: remote.content.video_url, permanentVideoUrl: uploaded.url, tokens: remote.usage?.completion_tokens || remote.usage?.total_tokens || 0 });
    completed += 1;
    await setClipStage(job.id, "RENDERING", 20 + Math.round((completed / manifest.scenes.length) * 55), `Scène ${completed}/${manifest.scenes.length} terminée`);
    return localVideo;
  });
  const montageManifest: MontageManifest = {
    version: 1, jobId: job.id, userId: job.userId, projectId: job.projectId, finalExportId: job.finalExportId, generationId: job.id,
    expectedDurationSeconds: manifest.durationSeconds,
    scenes: manifest.scenes.map((scene, index) => ({ order: scene.order, storageKey: `local-scene-${index}`, durationSeconds: scene.durationSeconds })),
    audio: { storageKey: manifest.audioStorageKey, startSeconds: manifest.audioStartSeconds, durationSeconds: manifest.durationSeconds },
    output: { storageKey: manifest.outputStorageKey, format: "9:16", resolution: "1080p", transition: "cut", subtitles: false },
    creditReservationIds: [manifest.creditReservationId],
  };
  await setClipStage(job.id, "RENDERING", 78, "Montage FFmpeg sur la musique complète");
  return renderMontage({ manifest: montageManifest, videos, audio, directory, output, onProgress: (percent) => { void heartbeatClipJob(job.id).catch(() => undefined); void setClipStage(job.id, "RENDERING", Math.min(94, 78 + Math.round(percent * 0.16)), "Montage FFmpeg en cours").catch(() => undefined); } });
}

export async function processClipJob(job: ClipWorkerJob) {
  const manifest = clipWorkerManifestSchema.parse(job.inputManifest);
  if (manifest.jobId !== job.id || manifest.projectId !== job.projectId || manifest.finalExportId !== job.finalExportId || manifest.outputStorageKey !== job.outputPath) throw new Error("MANIFEST_IDENTITY_MISMATCH");

  const directory = safeDirectory(job.id);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const heartbeatTimer = setInterval(() => { void heartbeatClipJob(job.id).catch(() => undefined); }, config.heartbeatSeconds * 1000);
  heartbeatTimer.unref();
  try {
    await setClipStage(job.id, "PREPARING", 15, "Téléchargement de la photo et de la musique");
    const photo = path.join(directory, "photo-input");
    const audio = path.join(directory, "audio-input");
    await Promise.all([
      downloadPrivateBlob(manifest.photoStorageKey, photo),
      downloadPrivateBlob(manifest.audioStorageKey, audio),
    ]);
    const output = path.join(directory, "clip.mp4");
    await setClipStage(job.id, "RENDERING", 20, config.mockMode ? "Création du clip simulé avec FFmpeg" : "Création des scènes Seedance");
    const rendered = config.mockMode
      ? await renderMockClip({ photo, audio, output, audioStartSeconds: manifest.audioStartSeconds, durationSeconds: manifest.durationSeconds })
      : await renderRealClip(job, manifest, directory, audio, output);
    if (!rendered.probe.streams?.some((stream) => stream.codec_type === "audio")) throw new Error("OUTPUT_AUDIO_MISSING");
    if (!rendered.probe.streams?.some((stream) => stream.codec_type === "video")) throw new Error("OUTPUT_VIDEO_MISSING");
    const outputStats = await stat(output);
    if (outputStats.size < config.minOutputBytes || outputStats.size > config.maxOutputBytes) throw new Error("OUTPUT_SIZE_INVALID");

    // Le client a payé une durée précise : un rendu de démonstration ne doit
    // jamais être livré ni facturé à sa place.
    const finalDuration = Number((await probeMedia(output)).format?.duration || 0);
    const drift = Math.abs(finalDuration - manifest.durationSeconds);
    if (!Number.isFinite(finalDuration) || drift > MAX_DURATION_DRIFT_SECONDS) {
      throw new ClipValidationError(
        `Durée finale de ${finalDuration.toFixed(1)} s pour une musique de ${manifest.durationSeconds} s (écart ${drift.toFixed(1)} s).`,
      );
    }
    await setClipStage(job.id, "UPLOADING", 95, "Enregistrement du MP4 privé");
    const blob = await uploadPrivateVideo(manifest.outputStorageKey, output);
    await completeClipJob(job, manifest, blob.url);
    console.log(JSON.stringify({ event: config.mockMode ? "clip_mock_completed" : "clip_seedance_completed", jobId: job.id, durationSeconds: Number((await probeMedia(output)).format?.duration || 0), sizeBytes: outputStats.size }));
  } finally {
    clearInterval(heartbeatTimer);
    await rm(directory, { recursive: true, force: true });
  }
}

export async function processClaimedClipJob(job: ClipWorkerJob) {
  try {
    await processClipJob(job);
  } catch (error) {
    const manifest = clipWorkerManifestSchema.safeParse(job.inputManifest);
    // Non-conformité : terminal et remboursé, sans réessai.
    if (error instanceof ClipValidationError) {
      console.error(JSON.stringify({ event: "clip_validation_failed", jobId: job.id, reason: error.message }));
      if (manifest.success) await failClipValidation(job, manifest.data, error.message);
      return;
    }
    if (error instanceof ClipTerminalError) {
      console.error(JSON.stringify({ event: "clip_terminal_failed", jobId: job.id, code: error.code }));
      if (manifest.success) await failClipTerminal(job, manifest.data, error.code, `La création a échoué (${error.code}).`);
      return;
    }
    const details = publicError(error);
    console.error(JSON.stringify({ event: "clip_worker_failed", jobId: job.id, attempt: job.attemptCount, code: details.code }));
    if (details.code !== "LEASE_LOST" && manifest.success) await retryOrFailClipJob(job, manifest.data, details.code, details.message);
  }
}
