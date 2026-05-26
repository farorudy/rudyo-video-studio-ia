/**
 * montage-advanced.js — Moteur de montage FFmpeg avancé
 *
 * Lit media/montage-config.json et produit media/export/clip_final.mp4
 * + media/export/thumbnail.jpg
 *
 * Structure de config attendue :
 * {
 *   clips: [{ file: "nom.mp4", duree?: number, subtitleText?: string }],
 *   transition: { type: "cut" | "fade" | "wipe", duree: 0.5 },
 *   audio: {
 *     musique: "media/audio/musique.mp3",
 *     voix?: "media/audio/voix.mp3",
 *     musiqueVolume?: 0.7,
 *     voixVolume?: 1.0
 *   },
 *   output: {
 *     fichier: "media/export/clip_final.mp4",
 *     resolution: "1280x720" | "1920x1080" | "1080x1920",
 *     fps: 24
 *   }
 * }
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "media", "montage-config.json");

// ── Lecture de la config ────────────────────────────────────────────────────

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("Fichier de configuration introuvable :", CONFIG_PATH);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

const clips = config.clips || [];
const transition = config.transition || { type: "cut", duree: 0.5 };
const audio = config.audio || {};
const output = config.output || {};

const plansDir = path.join(ROOT, "media", "plans");
const exportDir = path.join(ROOT, "media", "export");
const exportPath = output.fichier
  ? path.join(ROOT, output.fichier)
  : path.join(exportDir, "clip_final.mp4");
const thumbnailPath = path.join(exportDir, "thumbnail.jpg");
const resolution = output.resolution || "1280x720";
const fps = output.fps || 24;
const FONT_CANDIDATES = [
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/segoeui.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];

const musiqueVolume =
  audio.musiqueVolume !== undefined ? audio.musiqueVolume : 0.8;
const voixVolume = audio.voixVolume !== undefined ? audio.voixVolume : 1.0;

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

if (clips.length === 0) {
  console.error("Aucun clip défini dans la configuration.");
  process.exit(1);
}

// ── Résoudre les chemins des clips ──────────────────────────────────────────

function resolveSubtitleFontFile() {
  const configured = process.env.RUDYO_SUBTITLE_FONT;
  const candidates = configured ? [configured, ...FONT_CANDIDATES] : FONT_CANDIDATES;
  return candidates.find((fontPath) => fs.existsSync(fontPath)) || null;
}

function escapeDrawtextPath(value) {
  return value
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function escapeDrawtextText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .replace(/\n/g, "\\n");
}

const resolvedClips = clips.map((clip) => {
  const full = path.isAbsolute(clip.file)
    ? clip.file
    : path.join(plansDir, clip.file);
  if (!fs.existsSync(full)) {
    console.error("Clip introuvable :", full);
    process.exit(1);
  }
  return { ...clip, fullPath: full };
});

// ── Utilitaire : obtenir la durée d'un clip via ffprobe ─────────────────────

function getDuration(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_streams", filePath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    console.warn("ffprobe impossible pour", filePath, "→ durée supposée = 5s");
    return 5;
  }

  try {
    const json = JSON.parse(result.stdout);
    const videoStream = json.streams.find((s) => s.codec_type === "video");
    if (videoStream && videoStream.duration) {
      return parseFloat(videoStream.duration);
    }
    if (json.streams[0] && json.streams[0].duration) {
      return parseFloat(json.streams[0].duration);
    }
  } catch {
    // ignore
  }
  return 5;
}

// ── Montage CUT (concat demux classique) ────────────────────────────────────

function monterCut() {
  const listePath = path.join(ROOT, "media", "liste-advanced.txt");
  const lines = resolvedClips
    .map((c) => `file '${c.fullPath.replace(/\\/g, "/")}'`)
    .join("\n");
  fs.writeFileSync(listePath, lines, "utf8");

  const [w, h] = resolution.split("x");
  const scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=${fps}`;

  let audioArgs = [];

  if (audio.musique && fs.existsSync(path.join(ROOT, audio.musique))) {
    const musiqueFullPath = path.join(ROOT, audio.musique);
    audioArgs = ["-i", musiqueFullPath];
  }

  // Durée totale estimée pour le fade audio
  const cutTotalDur = resolvedClips.reduce(
    (sum, c) => sum + (c.duree ? parseFloat(c.duree) : getDuration(c.fullPath)),
    0,
  );
  const cutFadeOutSt = Math.max(0, cutTotalDur - 3).toFixed(3);

  const gradedVf = [
    scaleFilter,
    "eq=brightness=0.02:saturation=1.2:contrast=1.06:gamma_r=1.04:gamma_b=0.97",
    "unsharp=5:5:0.6:3:3:0.3",
    "vignette=PI/5",
  ].join(",");

  const ffmpegArgs = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listePath,
    ...audioArgs,
    "-vf",
    gradedVf,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-profile:v",
    "high",
    "-movflags",
    "+faststart",
    ...(audioArgs.length
      ? [
          "-af",
          `afade=t=in:st=0:d=1.5,afade=t=out:st=${cutFadeOutSt}:d=3,volume=${musiqueVolume}`,
          "-c:a",
          "aac",
          "-b:a",
          "192k",
        ]
      : []),
    "-shortest",
    exportPath,
  ];

  console.log("Montage CUT en cours...");
  const result = spawnSync("ffmpeg", ffmpegArgs, {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error("Erreur FFmpeg CUT, code :", result.status);
    process.exit(result.status || 1);
  }
}

// ── Montage avec transitions FADE / WIPE (filter_complex) ───────────────────

function monterAvecTransitions() {
  const transitionDuree = parseFloat(transition.duree) || 0.5;
  const transType = transition.type === "wipe" ? "wipeleft" : "fade";
  const [w, h] = resolution.split("x");
  const scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=${fps}`;

  // Calculer les durées de chaque clip
  const durees = resolvedClips.map((c) =>
    c.duree ? parseFloat(c.duree) : getDuration(c.fullPath),
  );

  // Construire le filter_complex
  const inputArgs = resolvedClips.flatMap((c) => ["-i", c.fullPath]);

  let filterLines = [];

  // Étape 1 : trim à la durée cible + scale chaque clip
  resolvedClips.forEach((c, i) => {
    filterLines.push(
      `[${i}:v]trim=0:${durees[i].toFixed(3)},setpts=PTS-STARTPTS,${scaleFilter}[v${i}scaled]`,
    );
  });

  if (resolvedClips.length === 1) {
    // Un seul clip : pas de transition
    filterLines.push(`[v0scaled]copy[vfinal]`);
  } else {
    // Enchaîner les transitions xfade deux à deux
    let offset = durees[0] - transitionDuree;
    filterLines.push(
      `[v0scaled][v1scaled]xfade=transition=${transType}:duration=${transitionDuree}:offset=${offset.toFixed(3)}[xf1]`,
    );

    for (let i = 2; i < resolvedClips.length; i++) {
      offset += durees[i - 1] - transitionDuree;
      const prev = i === 2 ? "xf1" : `xf${i - 1}`;
      const curr = i === resolvedClips.length - 1 ? "vfinal" : `xf${i}`;
      filterLines.push(
        `[${prev}][v${i}scaled]xfade=transition=${transType}:duration=${transitionDuree}:offset=${offset.toFixed(3)}[${curr}]`,
      );
    }

    if (resolvedClips.length === 2) {
      // renommer xf1 en vfinal
      filterLines[filterLines.length - 1] = filterLines[
        filterLines.length - 1
      ].replace("[xf1]", "[vfinal]");
    }
  }

  // Sous-titres (drawtext)
  const hasSubtitles = resolvedClips.some((c) => c.subtitleText);
  let videoOutput = "[vfinal]";

  if (hasSubtitles) {
    const subtitleFontFile = resolveSubtitleFontFile();
    if (!subtitleFontFile) {
      console.error(
        "Sous-titres impossibles : aucune police compatible trouvee. Installez Arial, Segoe UI, DejaVu Sans, Noto Sans ou Liberation Sans, ou definissez RUDYO_SUBTITLE_FONT.",
      );
      process.exit(1);
    }

    // Calculer les offsets temporels pour chaque clip afin d'afficher les sous-titres au bon moment
    let timeOffset = 0;
    const subtitleFilters = [];

    resolvedClips.forEach((clip, i) => {
      if (clip.subtitleText) {
        const startTime = timeOffset;
        const endTime =
          timeOffset +
          durees[i] -
          (i < resolvedClips.length - 1 ? transitionDuree : 0);
        const escapedText = escapeDrawtextText(clip.subtitleText);
        subtitleFilters.push(
          `drawtext=fontfile=${escapeDrawtextPath(subtitleFontFile)}:fontsize=28:fontcolor=white:borderw=2:bordercolor=black:` +
            `x=(w-text_w)/2:y=h-70:text='${escapedText}':` +
            `enable='between(t,${startTime.toFixed(3)},${endTime.toFixed(3)})'`,
        );
      }
      timeOffset +=
        durees[i] - (i < resolvedClips.length - 1 ? transitionDuree : 0);
    });

    if (subtitleFilters.length > 0) {
      filterLines.push(`[vfinal]${subtitleFilters.join(",")}[vwithsubs]`);
      videoOutput = "[vwithsubs]";
    }
  }

  // Grading colorimétrique cinématique appliqué après les transitions
  const gradedLabel = "[vgraded]";
  filterLines.push(
    `${videoOutput}` +
      `eq=brightness=0.02:saturation=1.2:contrast=1.06:gamma_r=1.04:gamma_b=0.97,` +
      `unsharp=5:5:0.6:3:3:0.3,vignette=PI/5` +
      `${gradedLabel}`,
  );
  videoOutput = gradedLabel;

  // Durée totale pour le fade audio
  const totalVideoDuration = durees.reduce(
    (sum, d, i) => sum + d - (i < durees.length - 1 ? transitionDuree : 0),
    0,
  );
  const fadeOutSt = Math.max(0, totalVideoDuration - 3).toFixed(3);

  // Audio
  let audioArgs = [];
  let audioFilterLines = [];

  const musiqueFullPath = audio.musique ? path.join(ROOT, audio.musique) : null;
  const voixFullPath = audio.voix ? path.join(ROOT, audio.voix) : null;

  const musiqueExists = musiqueFullPath && fs.existsSync(musiqueFullPath);
  const voixExists = voixFullPath && fs.existsSync(voixFullPath);

  if (musiqueExists) {
    audioArgs.push("-i", musiqueFullPath);
  }
  if (voixExists) {
    audioArgs.push("-i", voixFullPath);
  }

  const totalInputs = resolvedClips.length;

  if (musiqueExists && voixExists) {
    const musiqueIdx = totalInputs;
    const voixIdx = totalInputs + 1;
    audioFilterLines.push(
      `[${musiqueIdx}:a]afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutSt}:d=3,volume=${musiqueVolume}[amus];` +
        `[${voixIdx}:a]volume=${voixVolume}[avoix];` +
        `[amus][avoix]amix=inputs=2:duration=first:dropout_transition=3[aout]`,
    );
  } else if (musiqueExists) {
    const musiqueIdx = totalInputs;
    audioFilterLines.push(
      `[${musiqueIdx}:a]afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOutSt}:d=3,volume=${musiqueVolume}[aout]`,
    );
  }

  const allFilters = [...filterLines, ...audioFilterLines].join(";");

  // Construction plus robuste avec spawn pour éviter les problèmes de quoting
  const ffmpegArgs = [
    "-y",
    ...inputArgs,
    ...audioArgs,
    "-filter_complex",
    allFilters,
    "-map",
    videoOutput,
  ];

  if (musiqueExists || voixExists) {
    ffmpegArgs.push("-map", "[aout]", "-c:a", "aac", "-b:a", "192k");
  }

  ffmpegArgs.push(
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-profile:v",
    "high",
    "-movflags",
    "+faststart",
    "-shortest",
    exportPath,
  );

  console.log("Montage", transition.type.toUpperCase(), "en cours...");
  console.log(
    "Clips :",
    resolvedClips.length,
    "| Résolution :",
    resolution,
    "| FPS :",
    fps,
  );

  const result = spawnSync("ffmpeg", ffmpegArgs, {
    stdio: "inherit",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error("Erreur FFmpeg, code :", result.status);
    process.exit(result.status || 1);
  }
}

// ── Génération de la miniature ───────────────────────────────────────────────

function genererThumbnail() {
  if (!fs.existsSync(exportPath)) {
    console.warn("Fichier exporté introuvable, miniature ignorée.");
    return;
  }

  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      "00:00:01",
      "-i",
      exportPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      thumbnailPath,
    ],
    { stdio: "inherit", encoding: "utf8" },
  );

  if (result.status === 0) {
    console.log("Miniature générée :", thumbnailPath);
  } else {
    console.warn("Impossible de générer la miniature.");
  }
}

// ── Exécution principale ─────────────────────────────────────────────────────

if (transition.type === "cut") {
  monterCut();
} else {
  monterAvecTransitions();
}

genererThumbnail();

console.log("Vidéo exportée :", exportPath);
