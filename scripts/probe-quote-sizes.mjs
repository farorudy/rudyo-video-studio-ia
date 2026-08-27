// Cherche le seuil de taille accepté par /api/simple-clips/quote.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const run = promisify(execFile);
const base = process.env.APP_URL || "http://localhost:3000";
// Durées choisies pour couvrir 1 Mo à ~74 Mo en WAV stéréo 44,1 kHz.
const durations = [10, 60, 180, 300, 420];

const dir = await mkdtemp(path.join(os.tmpdir(), "rudyo-size-probe-"));
try {
  for (const seconds of durations) {
    const file = path.join(dir, `${seconds}.wav`);
    await run(ffmpeg.path, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
      "-i", `sine=frequency=440:sample_rate=44100:duration=${seconds}`,
      "-ac", "2", "-c:a", "pcm_s16le", file], { timeout: 120_000, windowsHide: true });
    const bytes = (await stat(file)).size;

    const form = new FormData();
    form.set("audio", new File([await readFile(file)], `${seconds}.wav`, { type: "audio/wav" }));
    form.set("audioStartSeconds", "0");
    form.set("plan", "TIKTOK");

    let line = `${String(seconds).padStart(3)} s | ${(bytes / 1048576).toFixed(1).padStart(5)} Mo | `;
    try {
      const response = await fetch(`${base}/api/simple-clips/quote`, { method: "POST", body: form });
      const text = await response.text();
      let detail;
      try {
        const body = JSON.parse(text);
        detail = body.error ? `error=${body.error}` : `credits=${body.totalCredits} prix=${body.priceEur}`;
      } catch {
        detail = `NON-JSON: ${text.slice(0, 60).replace(/\s+/g, " ")}`;
      }
      line += `HTTP ${response.status} | ${detail}`;
    } catch (error) {
      line += `RESEAU: ${error instanceof Error ? error.message : error}`;
    }
    console.log(line);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
