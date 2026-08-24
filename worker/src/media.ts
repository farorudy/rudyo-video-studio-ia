import { writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { run } from "./process.js";
import type { MontageManifest } from "./types.js";

type ProbeStream = { codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string; pix_fmt?: string };
type ProbeResult = { format?: { duration?: string; size?: string }; streams?: ProbeStream[] };

export async function probeMedia(file: string): Promise<ProbeResult> {
  const { stdout } = await run(config.ffprobePath, ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { timeoutMs: 60_000 });
  const parsed = JSON.parse(stdout) as ProbeResult;
  if (!parsed.format || !Array.isArray(parsed.streams)) throw new Error("FFPROBE_INVALID_OUTPUT");
  return parsed;
}

function durationOf(probe: ProbeResult) {
  const duration = Number.parseFloat(probe.format?.duration || "0");
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("MEDIA_DURATION_INVALID");
  return duration;
}

export function dimensions(format: MontageManifest["output"]["format"], resolution: MontageManifest["output"]["resolution"]) {
  const long = resolution === "1080p" ? 1920 : 1280;
  const short = resolution === "1080p" ? 1080 : 720;
  if (format === "9:16") return { width: short, height: long };
  if (format === "1:1") return { width: short, height: short };
  return { width: long, height: short };
}

export async function validateVideo(file: string) {
  const probe = await probeMedia(file);
  const stream = probe.streams?.find((item) => item.codec_type === "video");
  if (!stream || !stream.width || !stream.height) throw new Error("VIDEO_STREAM_MISSING");
  return { probe, duration: durationOf(probe) };
}

export async function validateAudio(file: string) {
  const probe = await probeMedia(file);
  if (!probe.streams?.some((item) => item.codec_type === "audio")) throw new Error("AUDIO_STREAM_MISSING");
  const duration = durationOf(probe);
  if (duration > 7_200) throw new Error("AUDIO_DURATION_LIMIT");
  return { probe, duration };
}

export async function normalizeVideo(input: string, output: string, manifest: MontageManifest) {
  const { width, height } = dimensions(manifest.output.format, manifest.output.resolution);
  await run(config.ffmpegPath, [
    "-hide_banner", "-nostdin", "-y", "-i", input,
    "-map", "0:v:0", "-an",
    "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=30`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
  ]);
}

async function concatenateCut(inputs: string[], output: string, directory: string) {
  const concatFile = path.join(directory, "concat.txt");
  const lines = inputs.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(concatFile, lines, { encoding: "utf8", mode: 0o600 });
  await run(config.ffmpegPath, ["-hide_banner", "-nostdin", "-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-an", "-c:v", "copy", output]);
}

async function concatenateCrossfade(inputs: string[], durations: number[], output: string) {
  if (inputs.length === 1) {
    await run(config.ffmpegPath, ["-hide_banner", "-nostdin", "-y", "-i", inputs[0], "-an", "-c:v", "copy", output]);
    return;
  }
  const fade = 0.35;
  const args = inputs.flatMap((input) => ["-i", input]);
  let elapsed = durations[0];
  const filters: string[] = [];
  let previous = "0:v";
  for (let index = 1; index < inputs.length; index += 1) {
    const outputLabel = `v${index}`;
    const offset = Math.max(0.05, elapsed - (fade * index));
    filters.push(`[${previous}][${index}:v]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[${outputLabel}]`);
    previous = outputLabel;
    elapsed += durations[index];
  }
  await run(config.ffmpegPath, ["-hide_banner", "-nostdin", "-y", ...args, "-filter_complex", filters.join(";"), "-map", `[${previous}]`, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", output]);
}

export async function renderMontage(options: {
  manifest: MontageManifest;
  videos: string[];
  audio: string;
  directory: string;
  output: string;
  onProgress?: (percent: number) => void;
}) {
  const normalized: string[] = [];
  const durations: number[] = [];
  for (let index = 0; index < options.videos.length; index += 1) {
    const output = path.join(options.directory, `normalized-${index}.mp4`);
    await normalizeVideo(options.videos[index], output, options.manifest);
    normalized.push(output);
    durations.push((await validateVideo(output)).duration);
    options.onProgress?.(10 + Math.round(((index + 1) / options.videos.length) * 25));
  }

  const assembled = path.join(options.directory, "assembled.mp4");
  if (options.manifest.output.transition === "crossfade") await concatenateCrossfade(normalized, durations, assembled);
  else await concatenateCut(normalized, assembled, options.directory);
  const sourceAudioDuration = (await validateAudio(options.audio)).duration;
  const audioStart = options.manifest.audio.startSeconds || 0;
  const audioDuration = Math.min(options.manifest.audio.durationSeconds || (sourceAudioDuration - audioStart), sourceAudioDuration - audioStart);
  if (audioDuration <= 0 || audioDuration > 420) throw new Error("AUDIO_EXCERPT_INVALID");
  const expectedMs = Math.max(1, audioDuration * 1000);
  await run(config.ffmpegPath, [
    "-hide_banner", "-nostdin", "-y", "-stream_loop", "-1", "-i", assembled, "-ss", audioStart.toFixed(3), "-i", options.audio,
    "-map", "0:v:0", "-map", "1:a:0", "-t", audioDuration.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-map_metadata", "-1",
    "-progress", "pipe:2", "-nostats", options.output,
  ], {
    onStderr(line) {
      const match = /^out_time_ms=(\d+)$/.exec(line);
      if (match) options.onProgress?.(40 + Math.min(58, Math.round((Number(match[1]) / 1000 / expectedMs) * 58)));
    },
  });
  const finalProbe = await validateVideo(options.output);
  const outputAudio = finalProbe.probe.streams?.find((stream) => stream.codec_type === "audio");
  const outputVideo = finalProbe.probe.streams?.find((stream) => stream.codec_type === "video");
  if (!outputAudio) throw new Error("OUTPUT_AUDIO_MISSING");
  if (outputAudio.codec_name !== "aac") throw new Error("OUTPUT_AUDIO_CODEC_INVALID");
  if (!outputVideo || outputVideo.codec_name !== "h264" || outputVideo.pix_fmt !== "yuv420p") {
    throw new Error("OUTPUT_CODEC_INVALID");
  }
  const expected = dimensions(options.manifest.output.format, options.manifest.output.resolution);
  if (outputVideo.width !== expected.width || outputVideo.height !== expected.height) throw new Error("OUTPUT_RESOLUTION_INVALID");
  if (Math.abs(finalProbe.duration - audioDuration) > 0.5) throw new Error("OUTPUT_DURATION_INVALID");
  return { duration: finalProbe.duration, probe: finalProbe.probe };
}

export async function checkFfmpeg() {
  await Promise.all([
    run(config.ffmpegPath, ["-version"], { timeoutMs: 10_000 }),
    run(config.ffprobePath, ["-version"], { timeoutMs: 10_000 }),
  ]);
}
