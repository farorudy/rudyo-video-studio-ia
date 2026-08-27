import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const output = path.resolve("media", "local-test-fixtures");
await mkdir(output, { recursive: true });

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegInstaller.path, ["-hide_banner", "-nostdin", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let error = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { error = (error + chunk).slice(-4000); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg ${code}: ${error}`)));
  });
}

await ffmpeg(["-f", "lavfi", "-i", "color=c=0x164e63:s=1080x1920", "-frames:v", "1", path.join(output, "portrait-synthetique.png")]);
for (const [name, duration] of [["audio-15s.m4a", 15], ["audio-3m30.m4a", 210], ["audio-5m.m4a", 300], ["audio-7m.m4a", 420], ["audio-7m01.m4a", 421]]) {
  await ffmpeg(["-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${duration}`, "-c:a", "aac", "-b:a", "64k", path.join(output, name)]);
}
console.log(output);
