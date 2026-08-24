import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import sharp from "sharp";

export type SyntheticFixture = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegInstaller.path, ["-hide_banner", "-nostdin", "-y", ...args], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let errorOutput = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { errorOutput = (errorOutput + chunk).slice(-2000); });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(`FIXTURE_FFMPEG_FAILED_${code}: ${errorOutput}`));
    });
  });
}

export async function createSyntheticMontageFixtures() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rudyo-system-fixtures-"));
  try {
    const videos = ["red", "green", "blue"].map((color, index) => ({
      color,
      path: path.join(directory, `scene-${index + 1}.mp4`),
    }));
    const audioPath = path.join(directory, "music.wav");
    await Promise.all(videos.map((video, index) => runFfmpeg([
      "-f", "lavfi", "-i", `color=c=${video.color}:s=${index === 1 ? "360x640" : index === 2 ? "480x480" : "640x360"}:d=1.2:r=30`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", video.path,
    ])));
    await runFfmpeg(["-f", "lavfi", "-i", "sine=frequency=440:duration=3.2", "-c:a", "pcm_s16le", audioPath]);
    const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#22d3ee" } }).png().toBuffer();
    return {
      image: { fileName: "synthetic-artist.png", mimeType: "image/png", buffer: image } satisfies SyntheticFixture,
      audio: { fileName: "synthetic-music.wav", mimeType: "audio/wav", buffer: await readFile(/* turbopackIgnore: true */ audioPath) } satisfies SyntheticFixture,
      videos: await Promise.all(videos.map(async (video, index) => ({
        fileName: `synthetic-scene-${index + 1}.mp4`,
        mimeType: "video/mp4",
        buffer: await readFile(/* turbopackIgnore: true */ video.path),
      } satisfies SyntheticFixture))),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
