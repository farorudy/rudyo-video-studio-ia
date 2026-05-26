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
const WIDTH = 1920;
const HEIGHT = 1080;
const OUT_DIR = path.join(ROOT, "media", "generated", "rudyo-ux-test");
const EXPORT_DIR = path.join(ROOT, "media", "export");
const FINAL_MP4 = path.join(EXPORT_DIR, "rudyo-ux-test-presentation.mp4");

type Scene = {
  id: number;
  start: number;
  end: number;
  title?: string;
  screenText: string[];
  voice: string;
  variant:
    | "logo"
    | "prototype-toggle"
    | "prototype-list"
    | "remote"
    | "badge"
    | "checklist"
    | "cta"
    | "white"
    | "thanks";
};

const scenes: Scene[] = [
  {
    id: 1,
    start: 0,
    end: 8,
    variant: "logo",
    screenText: ["Bienvenue chez Rudyo"],
    voice:
      "Bonjour et bienvenue ! Merci de prendre le temps de découvrir Rudyo Video Studio IA.",
  },
  {
    id: 2,
    start: 8,
    end: 18,
    variant: "prototype-toggle",
    screenText: ["Storyboard", "Clip Final"],
    voice:
      "Rudyo est un outil conçu pour transformer vos idées en vidéos grâce à l'intelligence artificielle. Aujourd'hui, nous testons une nouvelle interface qui sépare clairement la phase de préparation du montage final.",
  },
  {
    id: 3,
    start: 18,
    end: 28,
    variant: "prototype-list",
    screenText: ["Générer IA", "Suivre chaque plan", "Comprendre l'export"],
    voice:
      "Dans ce prototype, vous explorerez un projet fictif. Vous verrez comment suivre l'état de chaque plan, générer des scènes avec l'IA, et comprendre exactement ce que vous exportez.",
  },
  {
    id: 4,
    start: 28,
    end: 40,
    variant: "remote",
    screenText: ["Pensez à voix haute", "Session à distance - 35 minutes"],
    voice:
      "La session dure environ 35 minutes, à distance, en partage d'écran. Nous vous demanderons simplement de naviguer et de penser à voix haute : dites ce que vous voyez, ce que vous cherchez, ou ce qui vous bloque.",
  },
  {
    id: 5,
    start: 40,
    end: 48,
    variant: "badge",
    screenText: ["Aucune mauvaise manipulation", "C'est l'outil que nous testons, pas vous."],
    voice:
      "Il n'y a aucune mauvaise manipulation. C'est l'outil que nous testons, pas vous.",
  },
  {
    id: 6,
    start: 48,
    end: 58,
    variant: "checklist",
    screenText: ["Chrome récent", "Micro actif", "Données RGPD"],
    voice:
      "Assurez-vous d'avoir un navigateur récent, un micro fonctionnel et une connexion stable. Tout ce que vous partagerez restera strictement confidentiel, conforme au RGPD, et servira uniquement à améliorer Rudyo.",
  },
  {
    id: 7,
    start: 58,
    end: 70,
    variant: "cta",
    screenText: ["Rejoindre la session"],
    voice:
      "Vos retours sont précieux et directement intégrés à la prochaine version. Préparez-vous, cliquez sur le lien ci-dessous, et faisons briller vos idées ensemble.",
  },
  {
    id: 8,
    start: 70,
    end: 75,
    variant: "white",
    screenText: ["Rudyo", "Lien de session : fourni dans l'invitation"],
    voice: "À très vite !",
  },
  {
    id: 9,
    start: 75,
    end: 90,
    variant: "thanks",
    screenText: ["Merci pour votre participation", "Rudyo Video Studio IA", "Votre idée devient une vidéo."],
    voice: "",
  },
];

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logo(x: number, y: number, scale = 1) {
  const s = scale;
  return `
    <g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-74" y="-74" width="148" height="148" rx="34" fill="url(#brand)" filter="url(#softShadow)"/>
      <path d="M-33 37V-37h40c24 0 39 14 39 35 0 14-7 25-19 31l22 38h-31l-17-32h-6v32h-28Zm28-55v30h10c9 0 15-6 15-15s-6-15-15-15H-5Z" fill="white"/>
    </g>`;
}

function baseDefs() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="52%" stop-color="#EEF2FF"/>
      <stop offset="100%" stop-color="#F5F3FF"/>
    </linearGradient>
    <linearGradient id="darkBg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="55%" stop-color="#312E81"/>
      <stop offset="100%" stop-color="#581C87"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" x2="1">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#9333EA"/>
    </linearGradient>
    <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#312E81" flood-opacity="0.18"/>
    </filter>
  </defs>`;
}

function text(x: number, y: number, value: string, size: number, color = "#111827", weight = 700, anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${xmlEscape(value)}</text>`;
}

function prototypeWindow(mode: "toggle" | "list" | "badge") {
  const rows = [0, 1, 2, 3, 4]
    .map((idx) => {
      const y = 390 + idx * 95;
      return `
        <rect x="360" y="${y}" width="1200" height="72" rx="18" fill="#FFFFFF" stroke="#E5E7EB"/>
        <circle cx="400" cy="${y + 36}" r="16" fill="${idx % 2 ? "#A78BFA" : "#818CF8"}"/>
        <rect x="438" y="${y + 18}" width="${idx === 1 ? 390 : 310}" height="14" rx="7" fill="#CBD5E1"/>
        <rect x="438" y="${y + 43}" width="${idx === 2 ? 570 : 470}" height="10" rx="5" fill="#E2E8F0"/>
        <rect x="1320" y="${y + 21}" width="150" height="30" rx="15" fill="${idx === 2 ? "#EEF2FF" : "#F1F5F9"}"/>
        ${idx === 2 ? text(1395, y + 43, "Générer IA", 20, "#4F46E5", 800) : ""}
      `;
    })
    .join("");

  const badge =
    mode === "badge"
      ? `<rect x="1220" y="185" width="330" height="58" rx="29" fill="#ECFDF5" stroke="#86EFAC"/>
         ${text(1385, 223, "Aucune mauvaise manipulation", 23, "#047857", 800)}`
      : "";

  const toggleHighlight =
    mode === "toggle"
      ? `<ellipse cx="960" cy="258" rx="260" ry="58" fill="none" stroke="#FACC15" stroke-width="8"/>
         <path d="M1230 180 L1110 231" stroke="#FACC15" stroke-width="8" stroke-linecap="round"/>
         <path d="M1110 231 l33 -3 l-20 -26" fill="none" stroke="#FACC15" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`
      : "";

  const listHighlight =
    mode === "list"
      ? `<circle cx="1395" cy="601" r="58" fill="none" stroke="#FACC15" stroke-width="8"/>
         <path d="M1455 650 L1515 710" stroke="#111827" stroke-width="10" stroke-linecap="round"/>
         <circle cx="1395" cy="601" r="10" fill="#111827"/>`
      : "";

  return `
    <rect x="240" y="130" width="1440" height="760" rx="34" fill="#F8FAFC" stroke="#E2E8F0" filter="url(#softShadow)"/>
    <rect x="240" y="130" width="1440" height="92" rx="34" fill="#FFFFFF"/>
    ${logo(325, 176, 0.35)}
    ${text(430, 185, "Rudyo Video Studio IA", 30, "#111827", 800, "start")}
    <rect x="745" y="228" width="430" height="62" rx="31" fill="#EEF2FF"/>
    <rect x="756" y="238" width="205" height="42" rx="21" fill="url(#brand)"/>
    ${text(858, 267, "Storyboard", 22, "#FFFFFF", 800)}
    ${text(1064, 267, "Clip Final", 22, "#4F46E5", 800)}
    ${rows}
    ${badge}
    ${toggleHighlight}
    ${listHighlight}`;
}

function checklist() {
  return `
    <rect x="560" y="275" width="800" height="470" rx="30" fill="#FFFFFF" stroke="#E5E7EB" filter="url(#softShadow)"/>
    ${text(960, 350, "Avant la session", 48, "#111827", 850)}
    ${checkRow(700, 445, "Chrome récent")}
    ${checkRow(700, 545, "Micro actif")}
    ${checkRow(700, 645, "Données RGPD")}
  `;
}

function checkRow(x: number, y: number, label: string) {
  return `
    <circle cx="${x}" cy="${y - 8}" r="24" fill="#EEF2FF"/>
    <path d="M${x - 11} ${y - 8} l8 9 l17 -20" fill="none" stroke="#4F46E5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(x + 60, y, label, 34, "#1F2937", 750, "start")}`;
}

function renderSvg(scene: Scene) {
  const isDark = scene.variant === "logo" || scene.variant === "cta" || scene.variant === "thanks";
  const bg = scene.variant === "white" ? "#FFFFFF" : isDark ? "url(#darkBg)" : "url(#bg)";
  let body = "";

  if (scene.variant === "logo") {
    body = `${logo(960, 395, 1.25)}${text(960, 665, "Bienvenue chez Rudyo", 74, "#FFFFFF", 850)}${text(960, 735, "Rudyo Video Studio IA", 34, "#E0E7FF", 650)}`;
  }

  if (scene.variant === "prototype-toggle") {
    body = `${prototypeWindow("toggle")}`;
  }

  if (scene.variant === "prototype-list") {
    body = `${prototypeWindow("list")}`;
  }

  if (scene.variant === "remote") {
    body = `
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#0F172A" opacity="0.30"/>
      <rect x="245" y="210" width="690" height="520" rx="28" fill="#FFFFFF" stroke="#E2E8F0" filter="url(#softShadow)"/>
      ${prototypeWindow("toggle").replace(/<rect x="240" y="130" width="1440" height="760"[\s\S]*/, "")}
      <rect x="1015" y="210" width="660" height="520" rx="28" fill="#FFFFFF" stroke="#E2E8F0" filter="url(#softShadow)"/>
      <circle cx="1345" cy="390" r="92" fill="#EEF2FF"/>
      <rect x="1292" y="360" width="106" height="70" rx="20" fill="url(#brand)"/>
      <path d="M1398 383 l56 -32 v88 l-56 -32z" fill="#4F46E5"/>
      ${text(1345, 555, "Partage d'écran", 42, "#111827", 850)}
      <rect x="575" y="775" width="770" height="96" rx="48" fill="url(#brand)" filter="url(#softShadow)"/>
      ${text(960, 837, "Pensez à voix haute", 48, "#FFFFFF", 850)}
      `;
  }

  if (scene.variant === "badge") {
    body = `${prototypeWindow("badge")}`;
  }

  if (scene.variant === "checklist") {
    body = `${checklist()}`;
  }

  if (scene.variant === "cta") {
    body = `
      ${logo(960, 250, 0.85)}
      ${text(960, 435, "Rudyo UX Test", 68, "#FFFFFF", 850)}
      ${text(960, 510, "Présentation Prototype", 38, "#E0E7FF", 700)}
      <rect x="660" y="610" width="600" height="118" rx="59" fill="#FFFFFF" filter="url(#softShadow)"/>
      ${text(960, 683, "Rejoindre la session", 46, "#4F46E5", 850)}
      ${text(960, 820, "Vos retours améliorent directement la prochaine version", 32, "#EDE9FE", 700)}`;
  }

  if (scene.variant === "white") {
    body = `${logo(960, 360, 0.95)}${text(960, 560, "Rudyo", 72, "#111827", 900)}${text(960, 650, "Lien de session : fourni dans l'invitation", 34, "#4B5563", 650)}`;
  }

  if (scene.variant === "thanks") {
    body = `${logo(960, 265, 0.75)}${text(960, 475, "Merci pour votre participation", 66, "#FFFFFF", 850)}${text(960, 570, "Rudyo Video Studio IA", 42, "#E0E7FF", 750)}${text(960, 665, "Votre idée devient une vidéo.", 52, "#FFFFFF", 850)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${baseDefs()}
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
    <circle cx="285" cy="190" r="180" fill="#FFFFFF" opacity="${isDark ? "0.06" : "0.35"}"/>
    <circle cx="1650" cy="860" r="240" fill="#FFFFFF" opacity="${isDark ? "0.05" : "0.45"}"/>
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
  const words = value.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 58 && line) {
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
    if (chunk.length >= 9 || (chunk.length >= 5 && endsSentence)) {
      chunks.push(chunk.join(" "));
      chunk = [];
    }
  }
  if (chunk.length) chunks.push(chunk.join(" "));
  return chunks;
}

function assEscape(value: string) {
  return value.replace(/[{}]/g, "");
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
  if (!scene.voice) {
    await execFileAsync(ffmpegInstaller.path, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=stereo",
      "-t",
      String(scene.end - scene.start),
      rawPath,
    ]);
    return rawPath;
  }

  const psPath = path.join(OUT_DIR, `voice-${String(scene.id).padStart(2, "0")}.ps1`);
  const escapedText = scene.voice.replace(/'/g, "''");
  const escapedOut = rawPath.replace(/'/g, "''");
  await writeFile(
    psPath,
    `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'fr-*' } | Select-Object -First 1
if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }
$synth.Rate = 1
$synth.Volume = 100
$synth.SetOutputToWaveFile('${escapedOut}')
$synth.Speak('${escapedText}')
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
    const voiceDuration = Math.max(0.5, targetDuration - 0.45);
    const speed = scene.voice ? Math.max(0.5, Math.min(2.4, duration / voiceDuration)) : 1;
    const segmentPath = path.join(OUT_DIR, `voice-${String(scene.id).padStart(2, "0")}.wav`);
    const filter = scene.voice
      ? `aformat=sample_rates=48000:channel_layouts=stereo,${atempoFilter(speed)},apad,atrim=0:${targetDuration},afade=t=in:st=0:d=0.08,afade=t=out:st=${Math.max(0, targetDuration - 0.18)}:d=0.18`
      : `aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${targetDuration}`;
    await execFileAsync(ffmpegInstaller.path, ["-y", "-i", rawPath, "-af", filter, segmentPath]);
    segmentPaths.push(segmentPath);
  }

  const listPath = path.join(OUT_DIR, "voice-list.txt");
  await writeFile(
    listPath,
    segmentPaths.map((file) => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8",
  );
  const voicePath = path.join(OUT_DIR, "voice-track.wav");
  await execFileAsync(ffmpegInstaller.path, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", voicePath]);
  return voicePath;
}

async function buildMusic() {
  const musicPath = path.join(OUT_DIR, "music-bed.wav");
  const lavfi =
    "sine=frequency=220:sample_rate=48000:duration=90[a0];" +
    "sine=frequency=277.18:sample_rate=48000:duration=90[a1];" +
    "sine=frequency=329.63:sample_rate=48000:duration=90[a2];" +
    "sine=frequency=659.25:sample_rate=48000:duration=90[a3];" +
    "[a0]volume=0.035,afade=t=in:st=0:d=2,afade=t=out:st=86:d=4[b0];" +
    "[a1]volume=0.025,afade=t=in:st=0:d=2,afade=t=out:st=86:d=4[b1];" +
    "[a2]volume=0.022,afade=t=in:st=0:d=2,afade=t=out:st=86:d=4[b2];" +
    "[a3]volume=0.012,afade=t=in:st=0:d=2,afade=t=out:st=86:d=4[b3];" +
    "[b0][b1][b2][b3]amix=inputs=4:duration=longest,apulsator=hz=0.18,volume=0.7[m]";
  await execFileAsync(ffmpegInstaller.path, ["-y", "-filter_complex", lavfi, "-map", "[m]", musicPath]);
  return musicPath;
}

async function mixAudio(voicePath: string, musicPath: string) {
  const audioPath = path.join(OUT_DIR, "final-audio.m4a");
  const filter =
    "[1:a]volume=0.18,afade=t=in:st=0:d=2,afade=t=out:st=86:d=4[music];" +
    "[0:a]volume=1.25[voice];" +
    "[voice][music]amix=inputs=2:duration=first:dropout_transition=0," +
    "alimiter=limit=0.707,volume=1.0[aout]";
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

async function buildSilentVideo(pngPaths: string[]) {
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
      "veryfast",
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
  await writeFile(
    listPath,
    segmentPaths.map((file) => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8",
  );
  const silentPath = path.join(OUT_DIR, "silent-video.mp4");
  await execFileAsync(ffmpegInstaller.path, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    silentPath,
  ]);
  return silentPath;
}

async function buildSubtitles() {
  const assPath = path.join(OUT_DIR, "rudyo-ux-test.ass");
  const events = scenes
    .filter((scene) => scene.voice)
    .flatMap((scene) => {
      const chunks = splitSubtitleText(scene.voice);
      const start = scene.start + 0.2;
      const end = scene.end - 0.25;
      const slot = (end - start) / chunks.length;
      return chunks.map((chunk, idx) => {
        const chunkStart = start + idx * slot;
        const chunkEnd = idx === chunks.length - 1 ? end : start + (idx + 1) * slot - 0.06;
        return `Dialogue: 0,${assTime(chunkStart)},${assTime(chunkEnd)},Sub,,0,0,0,,${wrapSubtitle(assEscape(chunk))}`;
      });
    })
    .join("\n");

  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI,38,&H00FFFFFF,&H000000FF,&H7A111827,&H9A111827,0,0,0,0,100,100,0,0,3,2,0,2,190,190,66,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
  await writeFile(assPath, ass, "utf8");
  return assPath;
}

function ffmpegFilterPath(file: string) {
  return file.replace(/\\/g, "/").replace(/:/g, "\\:");
}

async function muxFinal(videoPath: string, audioPath: string, assPath: string) {
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
    "medium",
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
    "90",
    FINAL_MP4,
  ]);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(EXPORT_DIR, { recursive: true });

  const pngPaths = await renderSlides();
  const [voicePath, musicPath, assPath] = await Promise.all([
    buildVoiceTrack(),
    buildMusic(),
    buildSubtitles(),
  ]);
  const audioPath = await mixAudio(voicePath, musicPath);
  const silentVideo = await buildSilentVideo(pngPaths);
  await muxFinal(silentVideo, audioPath, assPath);

  console.log(`Vidéo générée : ${FINAL_MP4}`);
  console.log(`Sous-titres : ${assPath}`);
  console.log(`Assets : ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
