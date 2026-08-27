// Mesure la durée réelle des deux MP4 facturés, depuis le stockage privé.
import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { get } from "@vercel/blob";
import ffprobe from "@ffprobe-installer/ffprobe";

const run = promisify(execFile);
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error("BLOB_READ_WRITE_TOKEN requis");

const targets = [
  { label: "Clip 5:00 · 276 s · 4 600 credits", attendu: 276, pathname: process.env.MP4_A },
  { label: "Clip 3:30 ·  15 s ·   250 credits", attendu: 15, pathname: process.env.MP4_B },
];

const dir = await mkdtemp(path.join(os.tmpdir(), "rudyo-incident-"));
try {
  for (const target of targets) {
    const file = path.join(dir, `${target.attendu}.mp4`);
    try {
      const result = await get(target.pathname, { access: "private", useCache: false, token });
      if (!result || result.statusCode !== 200) throw new Error(`statut ${result?.statusCode}`);
      await pipeline(Readable.fromWeb(result.stream), createWriteStream(file));

      const { stdout } = await run(ffprobe.path, ["-v", "error", "-show_entries",
        "format=duration:stream=codec_name,codec_type,width,height", "-of", "json", file],
        { timeout: 60_000, windowsHide: true });
      const probe = JSON.parse(stdout);
      const duree = Number(probe.format?.duration || 0);
      const video = probe.streams?.find((s) => s.codec_type === "video");
      const audio = probe.streams?.find((s) => s.codec_type === "audio");
      const ecart = Math.abs(duree - target.attendu);

      console.log(`${target.label}
  taille        : ${(await stat(file)).size} octets
  duree reelle  : ${duree.toFixed(2)} s
  duree attendue: ${target.attendu} s
  ECART         : ${ecart.toFixed(2)} s  -> ${ecart <= 2 ? "CONFORME" : "NON CONFORME"}
  video         : ${video?.codec_name} ${video?.width}x${video?.height}
  audio         : ${audio?.codec_name ?? "ABSENT"}
`);
    } catch (error) {
      console.log(`${target.label}\n  ECHEC: ${error instanceof Error ? error.message : error}\n`);
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
