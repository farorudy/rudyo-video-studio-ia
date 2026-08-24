import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
process.env.BLOB_READ_WRITE_TOKEN ||= "test_blob_token";
process.env.MONTAGE_WORKER_SECRET ||= "0123456789abcdef0123456789abcdef";
process.env.MONTAGE_MAX_DURATION_SECONDS ||= "30";
if (process.platform === "win32") {
  process.env.FFMPEG_PATH ||= path.resolve(process.cwd(), "..", "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe");
  process.env.FFPROBE_PATH ||= path.resolve(process.cwd(), "..", "node_modules", "@ffprobe-installer", "win32-x64", "ffprobe.exe");
}

test("synthetic scenes and original music produce a valid H.264/AAC MP4", { timeout: 120_000 }, async (context) => {
  const { run } = await import("../src/process.js");
  try {
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-version"], { timeoutMs: 10_000 });
  } catch {
    context.skip("FFmpeg is not installed on this test host");
    return;
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), "rudyo-worker-test-"));
  try {
    const first = path.join(directory, "first.mp4");
    const second = path.join(directory, "second.mp4");
    const third = path.join(directory, "third.mp4");
    const image = path.join(directory, "artist.png");
    const audio = path.join(directory, "music.wav");
    const output = path.join(directory, "result.mp4");
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=red:s=320x180:d=1.2:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", first]);
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=blue:s=180x320:d=1.2:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", second]);
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=green:s=240x240:d=1.2:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", third]);
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=yellow:s=128x128", "-frames:v", "1", image]);
    assert.ok((await stat(image)).size > 0);
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3.2", "-c:a", "pcm_s16le", audio]);
    const { renderMontage, probeMedia } = await import("../src/media.js");
    await renderMontage({
      manifest: {
        version: 1, jobId: "job", userId: "user", projectId: "project", finalExportId: "export", generationId: "generation", expectedDurationSeconds: 3.2,
        scenes: [
          { order: 0, storageKey: "scene-0.mp4", durationSeconds: 1.2 },
          { order: 1, storageKey: "scene-1.mp4", durationSeconds: 1.2 },
          { order: 2, storageKey: "scene-2.mp4", durationSeconds: 1.2 },
        ],
        audio: { storageKey: "music.wav", startSeconds: 0.4, durationSeconds: 2.4 },
        output: { storageKey: "final.mp4", format: "9:16", resolution: "1080p", transition: "cut", subtitles: false },
        creditReservationIds: [],
      },
      videos: [first, second, third], audio, directory, output,
    });
    const probe = await probeMedia(output);
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const renderedAudio = probe.streams?.find((stream) => stream.codec_type === "audio");
    assert.equal(video?.codec_name, "h264");
    assert.equal(video?.pix_fmt, "yuv420p");
    assert.equal(video?.width, 1080);
    assert.equal(video?.height, 1920);
    assert.equal(renderedAudio?.codec_name, "aac");
    assert.ok(Number(probe.format?.duration) >= 2.2 && Number(probe.format?.duration) <= 2.6);
    context.diagnostic(JSON.stringify({ videoCodec: video?.codec_name, audioCodec: renderedAudio?.codec_name, pixelFormat: video?.pix_fmt, width: video?.width, height: video?.height, durationSeconds: Number(probe.format?.duration), videoTrack: Boolean(video), audioTrack: Boolean(renderedAudio) }));
    const invalid = path.join(directory, "invalid.mp4");
    await writeFile(invalid, "not-a-video");
    await assert.rejects(() => probeMedia(invalid));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("WORKER_MOCK_MODE produit un MP4 vertical depuis la photo et la musique", { timeout: 120_000 }, async (context) => {
  const { run } = await import("../src/process.js");
  try { await run(process.env.FFMPEG_PATH || "ffmpeg", ["-version"], { timeoutMs: 10_000 }); } catch { context.skip("FFmpeg is not installed on this test host"); return; }
  const directory = await mkdtemp(path.join(os.tmpdir(), "rudyo-worker-mock-test-"));
  try {
    const photo = path.join(directory, "photo.png");
    const audio = path.join(directory, "music.wav");
    const output = path.join(directory, "rudyo-clip-simule.mp4");
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "color=c=purple:s=640x640", "-frames:v", "1", photo]);
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-nostdin", "-y", "-f", "lavfi", "-i", "sine=frequency=523:duration=3", "-c:a", "pcm_s16le", audio]);
    const { renderMockClip } = await import("../src/clip-processor.js");
    const result = await renderMockClip({ photo, audio, output, audioStartSeconds: 0, durationSeconds: 210 });
    const video = result.probe.streams?.find((stream) => stream.codec_type === "video");
    const renderedAudio = result.probe.streams?.find((stream) => stream.codec_type === "audio");
    assert.equal(video?.codec_name, "h264");
    assert.equal(video?.pix_fmt, "yuv420p");
    assert.equal(video?.width, 720);
    assert.equal(video?.height, 1280);
    assert.equal(renderedAudio?.codec_name, "aac");
    assert.ok((await stat(output)).size > 1024);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
