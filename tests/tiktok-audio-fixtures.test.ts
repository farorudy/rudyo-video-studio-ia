import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import test from "node:test";
import { probeAudioBuffer } from "../lib/audio-probe";
import { quoteTikTokClip } from "../lib/tiktok-offer";

const run = promisify(execFile);

test("les huit musiques synthétiques sont mesurées et facturées côté serveur", { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rudyo-tiktok-audio-test-"));
  try {
    const fixtures = [[15,3500],[30,3500],[60,3500],[90,3500],[120,3500],[180,3500],[210,3500],[211,5000]] as const;
    for (const [seconds, credits] of fixtures) {
      const file = path.join(directory, `${seconds}.wav`);
      await run(ffmpegInstaller.path, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=8000:duration=${seconds}`, "-c:a", "pcm_s16le", file], { timeout: 30_000, windowsHide: true });
      const probe = await probeAudioBuffer(await readFile(file), "wav");
      assert.ok(Math.abs(probe.durationSeconds - seconds) < 0.02);
      assert.equal(quoteTikTokClip(probe.durationSeconds).totalCredits, credits);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
