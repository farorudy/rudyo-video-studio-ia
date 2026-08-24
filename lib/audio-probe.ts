import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);
const BPM_ANALYSIS_SECONDS = 60;

function estimateBpm(pcm: Buffer, sampleRate = 400) {
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const window = 20, envelope: number[] = [];
  for (let offset = 0; offset + window <= samples.length; offset += window) { let energy = 0; for (let index = offset; index < offset + window; index += 1) energy += Math.abs(samples[index]); envelope.push(energy / window); }
  const envelopeRate = sampleRate / window;
  let bestBpm = 120, bestScore = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm += 1) { const lag = Math.max(1, Math.round((envelopeRate * 60) / bpm)); let score = 0; for (let index = lag; index < envelope.length; index += 1) score += envelope[index] * envelope[index - lag]; if (score > bestScore) { bestScore = score; bestBpm = bpm; } }
  return bestBpm;
}

export async function probeAudioBuffer(buffer: Buffer, extension = "audio") {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rudyo-audio-"));
  const file = path.join(directory, `input.${extension.replace(/[^a-z0-9]/gi, "").slice(0, 5) || "audio"}`);
  try {
    await fs.writeFile(file, buffer, { mode: 0o600 });
    const { stdout } = await execFileAsync(ffprobeInstaller.path, ["-v", "error", "-select_streams", "a:0", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", file], { timeout: 20_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_name?: string; sample_rate?: string; channels?: number }> };
    const durationSeconds = Number(parsed.format?.duration);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !parsed.streams?.length) throw new Error("AUDIO_INVALID");
    // Only the BPM sample is shortened. The trusted duration and final montage always use the complete audio.
    const decoded = await execFileAsync(ffmpegInstaller.path, ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", file, "-t", String(BPM_ANALYSIS_SECONDS), "-ac", "1", "-ar", "400", "-f", "s16le", "pipe:1"], { timeout: 30_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024, encoding: "buffer" as never });
    const pcm = Buffer.isBuffer(decoded.stdout) ? decoded.stdout : Buffer.from(decoded.stdout);
    return { durationSeconds: Number(durationSeconds.toFixed(3)), bpm: estimateBpm(pcm), codec: parsed.streams[0].codec_name || null, sampleRate: Number(parsed.streams[0].sample_rate || 0) || null, channels: parsed.streams[0].channels || null };
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
