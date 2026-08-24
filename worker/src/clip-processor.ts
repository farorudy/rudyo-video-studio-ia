import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { completeClipJob, heartbeatClipJob, retryOrFailClipJob, setClipStage } from "./db.js";
import { dimensions, probeMedia, validateAudio, validateVideo } from "./media.js";
import { run } from "./process.js";
import { downloadPrivateBlob, uploadPrivateVideo } from "./storage.js";
import { clipWorkerManifestSchema, type ClipWorkerJob } from "./types.js";

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
  await run(config.ffmpegPath, [
    "-hide_banner", "-nostdin", "-y", "-loop", "1", "-i", options.photo,
    "-ss", options.audioStartSeconds.toFixed(3), "-i", options.audio, "-t", demoDuration.toFixed(3),
    "-map", "0:v:0", "-map", "1:a:0",
    "-vf", `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height},setsar=1,fps=30`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart", options.output,
  ], { timeoutMs: 180_000 });
  return validateVideo(options.output);
}

export async function processClipJob(job: ClipWorkerJob) {
  const manifest = clipWorkerManifestSchema.parse(job.inputManifest);
  if (manifest.jobId !== job.id || manifest.projectId !== job.projectId || manifest.finalExportId !== job.finalExportId || manifest.outputStorageKey !== job.outputPath) throw new Error("MANIFEST_IDENTITY_MISMATCH");
  if (!config.mockMode) {
    // Le mode fournisseur reste verrouillé jusqu’à une approbation distincte du coût Seedance.
    throw new Error("REAL_SEEDANCE_APPROVAL_REQUIRED");
  }

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
    await setClipStage(job.id, "RENDERING", 40, "Création du clip simulé avec FFmpeg");
    const rendered = await renderMockClip({ photo, audio, output, audioStartSeconds: manifest.audioStartSeconds, durationSeconds: manifest.durationSeconds });
    if (!rendered.probe.streams?.some((stream) => stream.codec_type === "audio")) throw new Error("OUTPUT_AUDIO_MISSING");
    const outputStats = await stat(output);
    if (outputStats.size < config.minOutputBytes || outputStats.size > config.maxOutputBytes) throw new Error("OUTPUT_SIZE_INVALID");
    await setClipStage(job.id, "UPLOADING", 95, "Enregistrement du MP4 privé");
    const blob = await uploadPrivateVideo(manifest.outputStorageKey, output);
    await completeClipJob(job, manifest, blob.url);
    console.log(JSON.stringify({ event: "clip_mock_completed", jobId: job.id, durationSeconds: Number((await probeMedia(output)).format?.duration || 0), sizeBytes: outputStats.size }));
  } finally {
    clearInterval(heartbeatTimer);
    await rm(directory, { recursive: true, force: true });
  }
}

export async function processClaimedClipJob(job: ClipWorkerJob) {
  try {
    await processClipJob(job);
  } catch (error) {
    const details = publicError(error);
    console.error(JSON.stringify({ event: "clip_worker_failed", jobId: job.id, attempt: job.attemptCount, code: details.code }));
    const manifest = clipWorkerManifestSchema.safeParse(job.inputManifest);
    if (details.code !== "LEASE_LOST" && manifest.success) await retryOrFailClipJob(job, manifest.data, details.code, details.message);
  }
}
