import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const OUT_DIR = path.join(ROOT, "media", "generated", "rudy-mobilisation-politique");
const EXPORT_DIR = path.join(ROOT, "media", "export");
const FINAL_MP4 = path.join(EXPORT_DIR, "rudy-mobilisation-politique-vertical.mp4");

type Scene = {
  id: number;
  start: number;
  end: number;
  variant: "camera" | "terrain" | "walk" | "team" | "energy" | "direct" | "phone" | "final";
  voice: string;
  title?: string;
  bullets?: string[];
};

const scenes: Scene[] = [
  {
    id: 1,
    start: 0,
    end: 10,
    variant: "camera",
    title: "La Guadeloupe ne peut plus rester spectatrice.",
    voice:
      "La Guadeloupe ne peut plus rester spectatrice. Aux Abymes comme dans toute la Guadeloupe, il est temps de construire une nouvelle dynamique.",
  },
  {
    id: 2,
    start: 10,
    end: 19,
    variant: "terrain",
    title: "Mobilisation • Action • Engagement",
    voice:
      "Une troisième voie. Une voie forte. Structurée. Crédible. Une voie qui rassemble, et qui agit.",
  },
  {
    id: 3,
    start: 19,
    end: 30,
    variant: "walk",
    title: "Candidat à la présidence de la fédération",
    voice:
      "Aujourd'hui, j'ai décidé de m'engager pleinement en étant candidat à la présidence de la fédération des Les Républicains de Guadeloupe.",
  },
  {
    id: 4,
    start: 30,
    end: 41,
    variant: "team",
    title: "Construire une équipe forte",
    bullets: ["QG locaux", "Référents terrain", "Organisation", "Mobilisation"],
    voice:
      "Mais ce combat ne peut pas être individuel. Nous devons construire une équipe forte dans chaque commune, dans chaque circonscription.",
  },
  {
    id: 5,
    start: 41,
    end: 52,
    variant: "energy",
    title: "Notre objectif est clair",
    voice:
      "Notre objectif est clair : créer une fédération solide. Donner la parole au terrain. Faire émerger une alternative crédible pour demain.",
  },
  {
    id: 6,
    start: 52,
    end: 59,
    variant: "direct",
    title: "5 référents par circonscription",
    voice: "J'ai besoin de vous. Pas demain. Maintenant.",
  },
  {
    id: 7,
    start: 59,
    end: 67,
    variant: "phone",
    title: "membres.republicains.fr",
    voice:
      "Les adhésions sont ouvertes jusqu'au 26 mai 2026. Seuls les adhérents à jour pourront voter.",
  },
  {
    id: 8,
    start: 67,
    end: 75,
    variant: "final",
    title: "Mobilisons-nous.",
    voice:
      "Nous ne devons plus subir. Nous devons agir. La Guadeloupe mérite une nouvelle énergie. Et cette énergie, c'est ensemble que nous allons la construire.",
  },
];

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defs() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="50%" stop-color="#1D4ED8"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
    <linearGradient id="deep" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="56%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="blueRed" x1="0" x2="1">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#DC2626"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#020617" flood-opacity="0.28"/>
    </filter>
  </defs>`;
}

function text(
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#FFFFFF",
  weight = 800,
  anchor = "middle",
) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${xmlEscape(value)}</text>`;
}

function wrappedText(x: number, y: number, value: string, size: number, color = "#FFFFFF", max = 22) {
  const words = value.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines
    .slice(0, 5)
    .map((item, idx) => text(x, y + idx * size * 1.18, item, size, color, 900))
    .join("");
}

function person(cx: number, cy: number, scale = 1, color = "#FFFFFF") {
  return `
  <g transform="translate(${cx} ${cy}) scale(${scale})">
    <circle cx="0" cy="-128" r="72" fill="${color}" opacity="0.96"/>
    <path d="M-135 125c16-123 77-190 135-190s119 67 135 190c-91 54-179 54-270 0Z" fill="${color}" opacity="0.94"/>
    <path d="M-52 -112c28 24 73 24 104 0" stroke="#1E293B" stroke-width="12" stroke-linecap="round" opacity="0.25"/>
  </g>`;
}

function guadeloupeMap() {
  return `
  <g opacity="0.18" transform="translate(540 790) scale(1.55)">
    <path d="M-205-28c63-77 148-88 216-42 58 39 51 122-20 151-67 28-158 3-204-57-14-18-9-35 8-52Z" fill="#FFFFFF"/>
    <path d="M40-80c88-34 174-7 207 57 31 59-2 124-80 155-62 24-139 14-191-25 44-50 68-110 64-187Z" fill="#FFFFFF"/>
  </g>`;
}

function lowerThird(label: string) {
  return `
  <rect x="90" y="1435" width="900" height="210" rx="34" fill="#FFFFFF" opacity="0.94" filter="url(#shadow)"/>
  ${wrappedText(540, 1515, label, 50, "#111827", 24)}`;
}

function phone() {
  return `
  <rect x="280" y="360" width="520" height="980" rx="74" fill="#111827" filter="url(#shadow)"/>
  <rect x="318" y="425" width="444" height="835" rx="42" fill="#FFFFFF"/>
  <rect x="380" y="510" width="320" height="64" rx="32" fill="#EFF6FF"/>
  ${text(540, 553, "Adhésion en ligne", 30, "#1D4ED8", 850)}
  <rect x="380" y="650" width="320" height="55" rx="18" fill="#E5E7EB"/>
  <rect x="380" y="740" width="320" height="55" rx="18" fill="#E5E7EB"/>
  <rect x="380" y="860" width="320" height="86" rx="28" fill="url(#blueRed)"/>
  ${text(540, 915, "Adhérer", 36, "#FFFFFF", 900)}
  ${text(540, 1060, "26 mai 2026", 42, "#DC2626", 900)}
  ${text(540, 1130, "à jour pour voter", 32, "#334155", 800)}
  `;
}

function renderSvg(scene: Scene) {
  const title = scene.title ?? "";
  let body = "";
  const base = scene.variant === "final" || scene.variant === "direct" ? "url(#deep)" : "url(#bg)";

  if (scene.variant === "camera") {
    body = `${guadeloupeMap()}${person(540, 770, 2.05)}${lowerThird(title)}${text(540, 1705, "Rudy FARO", 46, "#E0F2FE", 900)}`;
  }

  if (scene.variant === "terrain") {
    body = `
      ${guadeloupeMap()}
      <rect x="90" y="330" width="900" height="1050" rx="48" fill="#FFFFFF" opacity="0.12"/>
      ${[0, 1, 2, 3, 4].map((i) => person(190 + i * 175, 925 + (i % 2) * 45, 0.8, "#FFFFFF")).join("")}
      <rect x="110" y="1375" width="860" height="150" rx="44" fill="#FFFFFF" opacity="0.94"/>
      ${text(540, 1465, "Mobilisation • Action • Engagement", 42, "#111827", 900)}
    `;
  }

  if (scene.variant === "walk") {
    body = `
      ${guadeloupeMap()}
      <path d="M120 1260c180-92 340-111 500-58s258 56 340-12" fill="none" stroke="#FFFFFF" stroke-width="16" opacity="0.35"/>
      ${person(405, 790, 1.45)}
      ${person(725, 860, 1.0, "#E0F2FE")}
      ${lowerThird(title)}
    `;
  }

  if (scene.variant === "team") {
    const rows = (scene.bullets ?? [])
      .map(
        (item, idx) => `
        <rect x="130" y="${500 + idx * 170}" width="820" height="112" rx="32" fill="#FFFFFF" opacity="0.95"/>
        <circle cx="190" cy="${557 + idx * 170}" r="26" fill="#16A34A"/>
        <path d="M178 ${557 + idx * 170}l9 10 20-27" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        ${text(555, 573 + idx * 170, item, 45, "#111827", 850)}
      `,
      )
      .join("");
    body = `${text(540, 330, "Une équipe dans chaque commune", 54, "#FFFFFF", 900)}${rows}`;
  }

  if (scene.variant === "energy") {
    body = `
      ${guadeloupeMap()}
      <circle cx="540" cy="720" r="300" fill="#FFFFFF" opacity="0.13"/>
      <circle cx="540" cy="720" r="205" fill="#FFFFFF" opacity="0.18"/>
      ${wrappedText(540, 610, title, 72, "#FFFFFF", 18)}
      ${text(540, 1050, "Fédération solide", 48)}
      ${text(540, 1130, "Parole au terrain", 48)}
      ${text(540, 1210, "Alternative crédible", 48)}
    `;
  }

  if (scene.variant === "direct") {
    body = `
      ${person(540, 740, 1.75)}
      ${text(540, 1250, "J'ai besoin de vous.", 68, "#FFFFFF", 950)}
      ${text(540, 1340, "Pas demain. Maintenant.", 56, "#FCA5A5", 950)}
      <rect x="150" y="1480" width="780" height="110" rx="55" fill="url(#blueRed)" filter="url(#shadow)"/>
      ${text(540, 1550, "5 référents par circonscription", 39, "#FFFFFF", 900)}
    `;
  }

  if (scene.variant === "phone") {
    body = `${phone()}${text(540, 1475, "membres.republicains.fr", 42, "#FFFFFF", 900)}${text(540, 1550, "Adhésions jusqu'au 26 mai 2026", 36, "#FDE68A", 900)}`;
  }

  if (scene.variant === "final") {
    body = `
      ${guadeloupeMap()}
      ${person(540, 590, 1.35)}
      ${text(540, 1080, "Mobilisons-nous.", 78, "#FFFFFF", 950)}
      ${text(540, 1215, "Rudy FARO", 58, "#BFDBFE", 950)}
      ${text(540, 1295, "Présidence", 42, "#FFFFFF", 850)}
      ${text(540, 1360, "Les Républicains Guadeloupe", 42, "#FFFFFF", 850)}
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${defs()}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${base}"/>
    <circle cx="1020" cy="130" r="280" fill="#FFFFFF" opacity="0.10"/>
    <circle cx="50" cy="1780" r="330" fill="#FFFFFF" opacity="0.08"/>
    ${body}
  </svg>`;
}

function assTime(seconds: number) {
  const cs = Math.round(seconds * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

function wrapSubtitle(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 31 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2).join("\\N");
}

function splitSubtitleText(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let chunk: string[] = [];
  for (const word of words) {
    chunk.push(word);
    const endsSentence = /[.!?:]$/.test(word);
    if (chunk.length >= 7 || (chunk.length >= 4 && endsSentence)) {
      chunks.push(chunk.join(" "));
      chunk = [];
    }
  }
  if (chunk.length) chunks.push(chunk.join(" "));
  return chunks;
}

async function renderSlides() {
  const pngPaths: string[] = [];
  for (const scene of scenes) {
    const svg = renderSvg(scene);
    const svgPath = path.join(OUT_DIR, `scene-${String(scene.id).padStart(2, "0")}.svg`);
    const pngPath = path.join(OUT_DIR, `scene-${String(scene.id).padStart(2, "0")}.png`);
    await writeFile(svgPath, svg, "utf8");
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
    pngPaths.push(pngPath);
  }
  return pngPaths;
}

async function synthVoice(scene: Scene) {
  const rawPath = path.join(OUT_DIR, `voice-${String(scene.id).padStart(2, "0")}-raw.wav`);
  const psPath = path.join(OUT_DIR, `voice-${String(scene.id).padStart(2, "0")}.ps1`);
  await writeFile(
    psPath,
    `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'fr-*' } | Select-Object -First 1
if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }
$synth.Rate = 0
$synth.Volume = 100
$synth.SetOutputToWaveFile('${rawPath.replace(/'/g, "''")}')
$synth.Speak('${scene.voice.replace(/'/g, "''")}')
$synth.Dispose()
`,
    "utf8",
  );
  await execFileAsync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psPath], {
    windowsHide: true,
  });
  return rawPath;
}

async function probeDuration(file: string) {
  const { stdout } = await execFileAsync(ffprobeInstaller.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  return Number.parseFloat(stdout.trim());
}

function atempoFilter(factor: number) {
  const parts: number[] = [];
  let remaining = factor;
  while (remaining > 2) {
    parts.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    parts.push(0.5);
    remaining /= 0.5;
  }
  parts.push(Number(remaining.toFixed(4)));
  return parts.map((part) => `atempo=${part}`).join(",");
}

async function buildVoiceTrack() {
  const segmentPaths: string[] = [];
  for (const scene of scenes) {
    const targetDuration = scene.end - scene.start;
    const rawPath = await synthVoice(scene);
    const duration = await probeDuration(rawPath);
    const speed = Math.max(0.5, Math.min(2.2, duration / Math.max(0.5, targetDuration - 0.35)));
    const segmentPath = path.join(OUT_DIR, `voice-${String(scene.id).padStart(2, "0")}.wav`);
    await execFileAsync(ffmpegInstaller.path, [
      "-y",
      "-i",
      rawPath,
      "-af",
      `aformat=sample_rates=48000:channel_layouts=stereo,${atempoFilter(speed)},apad,atrim=0:${targetDuration},afade=t=in:st=0:d=0.08,afade=t=out:st=${Math.max(0, targetDuration - 0.16)}:d=0.16`,
      segmentPath,
    ]);
    segmentPaths.push(segmentPath);
  }

  const listPath = path.join(OUT_DIR, "voice-list.txt");
  await writeFile(listPath, segmentPaths.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const voicePath = path.join(OUT_DIR, "voice-track.wav");
  await execFileAsync(ffmpegInstaller.path, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", voicePath]);
  return voicePath;
}

async function buildMusic() {
  const musicPath = path.join(OUT_DIR, "music-bed.wav");
  const lavfi =
    "sine=frequency=146.83:sample_rate=48000:duration=75[a0];" +
    "sine=frequency=220:sample_rate=48000:duration=75[a1];" +
    "sine=frequency=293.66:sample_rate=48000:duration=75[a2];" +
    "sine=frequency=440:sample_rate=48000:duration=75[a3];" +
    "[a0]volume=0.035,afade=t=in:st=0:d=2,afade=t=out:st=71:d=4[b0];" +
    "[a1]volume=0.028,afade=t=in:st=3:d=3,afade=t=out:st=71:d=4[b1];" +
    "[a2]volume=0.022,afade=t=in:st=15:d=4,afade=t=out:st=71:d=4[b2];" +
    "[a3]volume=0.014,afade=t=in:st=40:d=5,afade=t=out:st=71:d=4[b3];" +
    "[b0][b1][b2][b3]amix=inputs=4:duration=longest,apulsator=hz=0.22,volume=0.8[m]";
  await execFileAsync(ffmpegInstaller.path, ["-y", "-filter_complex", lavfi, "-map", "[m]", musicPath]);
  return musicPath;
}

async function mixAudio(voicePath: string, musicPath: string) {
  const audioPath = path.join(OUT_DIR, "final-audio.m4a");
  const filter =
    "[1:a]volume=0.20,afade=t=in:st=0:d=2,afade=t=out:st=71:d=4[music];" +
    "[0:a]volume=1.30[voice];" +
    "[voice][music]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.707[aout]";
  await execFileAsync(ffmpegInstaller.path, [
    "-y",
    "-i",
    voicePath,
    "-i",
    musicPath,
    "-filter_complex",
    filter,
    "-map",
    "[aout]",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    audioPath,
  ]);
  return audioPath;
}

async function buildVideo(pngPaths: string[]) {
  const segmentPaths: string[] = [];
  for (const [idx, pngPath] of pngPaths.entries()) {
    const scene = scenes[idx];
    const segmentPath = path.join(OUT_DIR, `video-${String(scene.id).padStart(2, "0")}.mp4`);
    await execFileAsync(ffmpegInstaller.path, [
      "-y",
      "-loop",
      "1",
      "-i",
      pngPath,
      "-t",
      String(scene.end - scene.start),
      "-vf",
      `scale=${WIDTH}:${HEIGHT},fps=${FPS},format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "stillimage",
      "-x264-params",
      "bframes=0:rc-lookahead=0:ref=1:sync-lookahead=0",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(FPS),
      segmentPath,
    ]);
    segmentPaths.push(segmentPath);
  }
  const listPath = path.join(OUT_DIR, "video-list.txt");
  await writeFile(listPath, segmentPaths.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const videoPath = path.join(OUT_DIR, "silent-video.mp4");
  await execFileAsync(ffmpegInstaller.path, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", videoPath]);
  return videoPath;
}

async function buildSubtitles() {
  const events = scenes
    .flatMap((scene) => {
      const chunks = splitSubtitleText(scene.voice);
      const start = scene.start + 0.2;
      const end = scene.end - 0.22;
      const slot = (end - start) / chunks.length;
      return chunks.map((chunk, idx) => {
        const chunkStart = start + idx * slot;
        const chunkEnd = idx === chunks.length - 1 ? end : start + (idx + 1) * slot - 0.05;
        return `Dialogue: 0,${assTime(chunkStart)},${assTime(chunkEnd)},Sub,,0,0,0,,${wrapSubtitle(chunk)}`;
      });
    })
    .join("\n");
  const assPath = path.join(OUT_DIR, "rudy-mobilisation-politique.ass");
  await writeFile(
    assPath,
    `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI,44,&H00FFFFFF,&H000000FF,&H8A111827,&HAA111827,0,0,0,0,100,100,0,0,3,2,0,2,90,90,105,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`,
    "utf8",
  );
  return assPath;
}

function ffmpegFilterPath(file: string) {
  return file.replace(/\\/g, "/").replace(/:/g, "\\:");
}

async function mux(videoPath: string, audioPath: string, assPath: string) {
  await execFileAsync(ffmpegInstaller.path, [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-vf",
    `ass='${ffmpegFilterPath(assPath)}'`,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-x264-params",
    "bframes=0:rc-lookahead=0:ref=1:sync-lookahead=0",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-t",
    "75",
    FINAL_MP4,
  ]);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(EXPORT_DIR, { recursive: true });
  const pngPaths = await renderSlides();
  const [voicePath, musicPath, assPath] = await Promise.all([buildVoiceTrack(), buildMusic(), buildSubtitles()]);
  const audioPath = await mixAudio(voicePath, musicPath);
  const videoPath = await buildVideo(pngPaths);
  await mux(videoPath, audioPath, assPath);
  console.log(`Vidéo générée : ${FINAL_MP4}`);
  console.log(`Assets : ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
