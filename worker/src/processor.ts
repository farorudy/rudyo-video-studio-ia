import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { completeJob, failAndRefund, heartbeat, retryJob, setStage } from "./db.js";
import { renderMontage, validateAudio, validateVideo } from "./media.js";
import { downloadPrivateBlob, uploadPrivateVideo } from "./storage.js";
import { montageManifestSchema, type MontageJob } from "./types.js";

function safeJobDirectory(jobId: string) {
  const safeId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const directory = path.resolve(config.tempDir, `job-${safeId}`);
  if (!directory.startsWith(`${config.tempDir}${path.sep}`)) throw new Error("TEMP_PATH_INVALID");
  return directory;
}

function publicError(error: unknown) {
  const raw = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const code = raw.split(":", 1)[0].replace(/[^A-Z0-9_]/gi, "_").slice(0, 80).toUpperCase() || "MONTAGE_FAILED";
  return { code, message: `Le montage a échoué (${code}).` };
}

function isRetryable(code: string) {
  return !new Set([
    "AUDIO_DURATION_LIMIT", "AUDIO_STREAM_MISSING", "VIDEO_STREAM_MISSING", "MEDIA_DURATION_INVALID",
    "INPUT_TOO_LARGE", "OUTPUT_SIZE_INVALID", "OUTPUT_CODEC_INVALID", "OUTPUT_AUDIO_MISSING",
    "STORAGE_KEY_INVALID", "TEMP_PATH_INVALID", "ZODERROR",
  ]).has(code);
}

export async function processJob(job: MontageJob) {
  const manifest = montageManifestSchema.parse(job.inputManifest);
  if (manifest.jobId !== job.id || manifest.projectId !== job.projectId || manifest.finalExportId !== job.finalExportId || manifest.output.storageKey !== job.outputPath) {
    throw new Error("MANIFEST_IDENTITY_MISMATCH");
  }
  if (manifest.scenes.length > config.maxScenes) throw new Error("SCENE_COUNT_LIMIT");

  const directory = safeJobDirectory(job.id);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let heartbeatFailure: Error | null = null;
  const timer = setInterval(() => {
    void heartbeat(job.id).catch((error) => { heartbeatFailure = error instanceof Error ? error : new Error("LEASE_LOST"); });
  }, config.heartbeatSeconds * 1000);
  timer.unref();

  try {
    await setStage(job.id, "DOWNLOADING", 5);
    const videos: string[] = [];
    let downloadedBytes = 0;
    const scenes = [...manifest.scenes].sort((a, b) => a.order - b.order);
    for (let index = 0; index < scenes.length; index += 1) {
      if (heartbeatFailure) throw heartbeatFailure;
      const target = path.join(directory, `scene-${index}.mp4`);
      downloadedBytes += await downloadPrivateBlob(scenes[index].storageKey, target);
      if (downloadedBytes > config.maxInputBytes) throw new Error("INPUT_TOO_LARGE");
      await validateVideo(target);
      videos.push(target);
      await setStage(job.id, "DOWNLOADING", 5 + Math.round(((index + 1) / (scenes.length + 1)) * 15));
    }
    const audio = path.join(directory, "music-input");
    downloadedBytes += await downloadPrivateBlob(manifest.audio.storageKey, audio);
    if (downloadedBytes > config.maxInputBytes) throw new Error("INPUT_TOO_LARGE");
    await validateAudio(audio);

    await setStage(job.id, "PREPARING", 25);
    const output = path.join(directory, "final.mp4");
    await setStage(job.id, "RENDERING", 35);
    if (manifest.systemTestScenario === "INTERRUPTED_WORKER" && job.attemptCount === 1) {
      throw new Error("WORKER_INTERRUPTED_SIMULATION");
    }
    let lastProgress = 35;
    const rendered = await renderMontage({
      manifest,
      videos,
      audio,
      directory,
      output,
      onProgress(percent) {
        const progress = Math.max(35, Math.min(93, percent));
        if (progress >= lastProgress + 3) {
          lastProgress = progress;
          void setStage(job.id, "RENDERING", progress).catch((error) => { heartbeatFailure = error instanceof Error ? error : new Error("LEASE_LOST"); });
        }
      },
    });
    if (heartbeatFailure) throw heartbeatFailure;
    const outputStats = await stat(output);
    if (outputStats.size < config.minOutputBytes) throw new Error("OUTPUT_TOO_SMALL");
    const videoStream = rendered.probe.streams?.find((stream) => stream.codec_type === "video");
    const audioStream = rendered.probe.streams?.find((stream) => stream.codec_type === "audio");
    const diagnostics = {
      sizeBytes: outputStats.size,
      durationSeconds: rendered.duration,
      videoCodec: videoStream?.codec_name || null,
      audioCodec: audioStream?.codec_name || null,
      pixelFormat: videoStream?.pix_fmt || null,
      width: videoStream?.width || null,
      height: videoStream?.height || null,
      videoTrack: Boolean(videoStream),
      audioTrack: Boolean(audioStream),
    };
    await setStage(job.id, "UPLOADING", 95);
    if (manifest.systemTestScenario === "STORAGE_FAILURE" && job.attemptCount === 1) {
      throw new Error("STORAGE_FAILURE_SIMULATED");
    }
    const blob = await uploadPrivateVideo(job.outputPath, output);
    await completeJob(job, blob.url, diagnostics);
  } finally {
    clearInterval(timer);
    await rm(directory, { recursive: true, force: true });
  }
}

export async function processClaimedJob(job: MontageJob) {
  try {
    await processJob(job);
  } catch (error) {
    const details = publicError(error);
    console.error(JSON.stringify({ event: "montage_failed", jobId: job.id, attempt: job.attemptCount, code: details.code }));
    if (details.code === "LEASE_LOST") return;
    const manifestResult = montageManifestSchema.safeParse(job.inputManifest);
    if (job.attemptCount < job.maxAttempts && isRetryable(details.code)) {
      await retryJob(job, details.code, details.message).catch((retryError) => console.error("retry_update_failed", retryError));
    } else if (manifestResult.success) {
      await failAndRefund(job, manifestResult.data, details.code, details.message).catch((failureError) => console.error("failure_update_failed", failureError));
    } else {
      await failAndRefund(job, {
        version: 1, jobId: job.id, userId: job.userId, projectId: job.projectId,
        expectedDurationSeconds: 1,
        finalExportId: job.finalExportId, generationId: job.generationId, scenes: [],
        audio: { storageKey: "invalid" }, output: { storageKey: job.outputPath, format: "16:9", resolution: "720p", transition: "cut", subtitles: false },
        creditReservationIds: [],
      }, details.code, details.message).catch((failureError) => console.error("failure_update_failed", failureError));
    }
  }
}
