// Interroge /api/simple-clips/quote avec une vraie musique synthétique.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const run = promisify(execFile);
const seconds = Number(process.argv[2] || 180);
const base = process.env.APP_URL || "http://localhost:3000";

const dir = await mkdtemp(path.join(os.tmpdir(), "rudyo-quote-probe-"));
try {
  const file = path.join(dir, "song.wav");
  await run(ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", `sine=frequency=440:sample_rate=44100:duration=${seconds}`, "-c:a", "pcm_s16le", file],
    { timeout: 60_000, windowsHide: true });

  const form = new FormData();
  form.set("audio", new File([await readFile(file)], "song.wav", { type: "audio/wav" }));
  form.set("audioStartSeconds", "0");
  form.set("plan", "TIKTOK");

  const response = await fetch(`${base}/api/simple-clips/quote`, { method: "POST", body: form });
  const text = await response.text();
  console.log("status:", response.status);
  try {
    const body = JSON.parse(text);
    console.log(JSON.stringify({
      error: body.error, plan: body.plan, normalizedSeconds: body.normalizedSeconds,
      totalCredits: body.totalCredits, priceEur: body.priceEur,
      allowed: body.allowed, workerAvailable: body.workerAvailable,
      workerState: body.workerState, refusalCode: body.refusalCode, balance: body.balance,
    }, null, 2));
  } catch {
    console.log(text.slice(0, 300));
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
