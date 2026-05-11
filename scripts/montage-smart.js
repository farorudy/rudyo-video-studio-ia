/**
 * montage-smart.js — Montage intelligent synchronisé storyboard + musique
 *
 * 1. Lit automatiquement le dernier *-clips.json du dossier export/
 * 2. Utilise FFprobe pour obtenir la durée exacte de la musique
 * 3. Distribue les clips selon la structure musicale (intro / verse / chorus / bridge / outro)
 * 4. Trie les clips par niveau d'énergie : scènes calmes → intro/outro, scènes intenses → chorus
 * 5. Applique des transitions xfade cinématiques entre les clips
 * 6. Grading colorimétrique caribéen (chaleur, contraste, vignette)
 * 7. Encode en haute qualité (CRF 18, preset slow, H.264 High profile)
 * 8. Fade audio entrée/sortie + normalisation volume
 * 9. Génère la miniature
 */

"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "media", "export");
const PLANS_DIR = path.join(ROOT, "media", "plans");
const AUDIO_PATH = path.join(ROOT, "media", "audio", "musique.mp3");
const OUTPUT_PATH = path.join(EXPORT_DIR, "clip_final.mp4");
const THUMBNAIL_PATH = path.join(EXPORT_DIR, "thumbnail.jpg");

const RESOLUTION = process.env.RESOLUTION || "1280x720";
const FPS = parseInt(process.env.FPS || "25", 10);
const TRANSITION_DURATION = 0.4; // secondes de fondu entre clips

// ── 1. Charger le storyboard JSON ────────────────────────────────────────────

function loadClipsJson() {
  if (!fs.existsSync(EXPORT_DIR)) return null;

  const files = fs
    .readdirSync(EXPORT_DIR)
    .filter((f) => f.endsWith("-clips.json"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(EXPORT_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) return null;

  try {
    const content = fs.readFileSync(path.join(EXPORT_DIR, files[0].name), "utf8");
    const parsed = JSON.parse(content);
    console.log(`📋 Storyboard chargé : ${files[0].name} (${parsed.clips?.length ?? 0} plans)`);
    return parsed;
  } catch {
    return null;
  }
}

// ── 2. FFprobe : durée d'un fichier média ─────────────────────────────────────

function getMediaDuration(filePath) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    // Fallback : tenter via streams
    const fallback = spawnSync(
      "ffprobe",
      ["-v", "quiet", "-print_format", "json", "-show_streams", filePath],
      { encoding: "utf8" },
    );
    try {
      const json = JSON.parse(fallback.stdout);
      for (const stream of json.streams || []) {
        if (stream.duration) return parseFloat(stream.duration);
      }
    } catch {}
    return 5;
  }

  const val = parseFloat(result.stdout.trim());
  return isFinite(val) && val > 0 ? val : 5;
}

// ── 3. Calculer le score d'énergie d'un clip (storyboard) ────────────────────

function computeEnergyScore(clipDef) {
  if (!clipDef) return 0;

  const src = [
    clipDef.nom || "",
    clipDef.description || "",
    clipDef.promptVideo || "",
    clipDef.promptImage || "",
  ]
    .join(" ")
    .toLowerCase();

  const highWords =
    src.match(
      /explosion|energi|danse|chore|hero|h[ée]ro|climax|puissance|impact|intense|action|dynamic|epic|performance|refrain|chorus/g,
    )?.length ?? 0;

  const lowWords =
    src.match(
      /calme|contemplatif|doux|douce|intime|pause|slow|soft|respiration|suspendu|intro|ouverture|outro|final|conclusion/g,
    )?.length ?? 0;

  return highWords - lowWords;
}

// ── 4. Mapping musical : structure de la chanson → nombre de plans par section ─

/**
 * Retourne un planning de slots avec section, énergie cible et durée cible.
 * On distribue les plans selon le tempo musical attendu :
 *   intro/outro  → coupes lentes (6-8 s)
 *   verse/bridge → coupes moyennes (4-5 s)
 *   chorus       → coupes rapides (2.5-3 s)
 */
function buildMusicSchedule(audioDuration, nClips) {
  const structure = [
    { id: "intro",   pct: 0.10, pace: "slow",   targetSec: 7 },
    { id: "verse1",  pct: 0.20, pace: "medium",  targetSec: 4.5 },
    { id: "chorus1", pct: 0.15, pace: "fast",    targetSec: 2.8 },
    { id: "verse2",  pct: 0.18, pace: "medium",  targetSec: 4.5 },
    { id: "chorus2", pct: 0.15, pace: "fast",    targetSec: 2.8 },
    { id: "bridge",  pct: 0.10, pace: "medium",  targetSec: 4.0 },
    { id: "outro",   pct: 0.12, pace: "slow",    targetSec: 7 },
  ];

  const slots = [];

  structure.forEach((section) => {
    const sectionDur = audioDuration * section.pct;
    const count = Math.max(1, Math.round(sectionDur / section.targetSec));
    for (let i = 0; i < count; i++) {
      slots.push({
        section: section.id,
        pace: section.pace,
        targetSec: section.targetSec,
        wantsEnergy: section.pace === "fast" ? "high" : section.pace === "slow" ? "low" : "medium",
      });
    }
  });

  // Ajuster le nombre total de slots au nombre de clips disponibles
  // Si trop peu de clips : compresser les slots (on garde la structure musicale mais moins de slots)
  // Si trop de clips : répéter le planning
  return slots;
}

// ── 5. Assigner les clips aux slots musicaux ──────────────────────────────────

/**
 * Trie les clips storyboard par énergie et les assigne aux slots.
 * Clips haute énergie → chorus | clips basse énergie → intro/outro
 */
function assignClipsToSlots(slots, clipsJson, planFiles) {
  // Récupérer la liste ordonnée des fichiers selon le storyboard
  let storyboardOrder = [];

  if (clipsJson && Array.isArray(clipsJson.clips)) {
    clipsJson.clips.forEach((def, idx) => {
      const candidates = [
        def.nom + ".mp4",
        `plan${idx + 1}.mp4`,
        `plan${String(idx + 1).padStart(2, "0")}.mp4`,
        planFiles[idx],
      ].filter(Boolean);

      const match = candidates.find((c) => planFiles.includes(c));

      storyboardOrder.push({
        file: match || planFiles[idx % planFiles.length],
        energyScore: computeEnergyScore(def),
        def,
      });
    });
  }

  // Compléter avec les fichiers non couverts par le storyboard
  planFiles.forEach((f, idx) => {
    if (!storyboardOrder.find((e) => e.file === f)) {
      storyboardOrder.push({ file: f, energyScore: 0, def: null });
    }
  });

  // Séparer par niveau d'énergie pour l'assignation intelligente
  const highEnergy = storyboardOrder
    .map((e, i) => ({ ...e, originalIdx: i }))
    .filter((e) => e.energyScore > 0)
    .sort((a, b) => b.energyScore - a.energyScore);

  const lowEnergy = storyboardOrder
    .map((e, i) => ({ ...e, originalIdx: i }))
    .filter((e) => e.energyScore < 0)
    .sort((a, b) => a.energyScore - b.energyScore);

  const medEnergy = storyboardOrder
    .map((e, i) => ({ ...e, originalIdx: i }))
    .filter((e) => e.energyScore === 0);

  const poolHigh = [...highEnergy];
  const poolLow = [...lowEnergy];
  const poolMed = [...medEnergy];
  const poolAll = [...storyboardOrder.map((e, i) => ({ ...e, originalIdx: i }))];

  let hiIdx = 0, loIdx = 0, meIdx = 0, allIdx = 0;

  function pickNext(wants) {
    // Essayer le pool spécifique, fallback sur le pool global en loopant
    if (wants === "high" && hiIdx < poolHigh.length) return poolHigh[hiIdx++].file;
    if (wants === "low" && loIdx < poolLow.length) return poolLow[loIdx++].file;
    if (wants === "medium" && meIdx < poolMed.length) return poolMed[meIdx++].file;
    // Fallback : pool global en boucle
    const entry = poolAll[allIdx % poolAll.length];
    allIdx++;
    return entry.file;
  }

  return slots.map((slot, i) => ({
    ...slot,
    file: pickNext(slot.wantsEnergy),
    fullPath: path.join(PLANS_DIR, pickNext(slot.wantsEnergy) /* will be overwritten */),
  })).map((slot) => ({
    ...slot,
    fullPath: path.join(PLANS_DIR, slot.file),
  }));
}

// ── 6. Construire le filter_complex FFmpeg ────────────────────────────────────

function buildFilterComplex(entries, audioInputIdx) {
  const [W, H] = RESOLUTION.split("x");
  const N = entries.length;
  const TD = TRANSITION_DURATION;

  const scaleBase = [
    `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`,
    `fps=${FPS}`,
    `format=yuv420p`,
  ].join(",");

  const filters = [];

  // Étape A : trim + scale chaque clip à sa durée cible
  entries.forEach((e, i) => {
    const dur = e.targetSec.toFixed(3);
    filters.push(`[${i}:v]trim=0:${dur},setpts=PTS-STARTPTS,${scaleBase}[vs${i}]`);
  });

  // Étape B : chaîne xfade (alternance de 3 types de transition pour variété)
  const transTypes = ["fade", "dissolve", "wipeleft", "fadeblack"];

  if (N === 1) {
    filters.push(`[vs0]copy[vchain]`);
  } else {
    let cumOffset = entries[0].targetSec - TD;

    // Première transition
    const t0 = transTypes[0];
    const firstOut = N === 2 ? "vchain" : "xf0";
    filters.push(
      `[vs0][vs1]xfade=transition=${t0}:duration=${TD}:offset=${cumOffset.toFixed(3)}[${firstOut}]`,
    );

    for (let i = 2; i < N; i++) {
      cumOffset += entries[i - 1].targetSec - TD;
      const trans = transTypes[(i - 1) % transTypes.length];
      const prevLabel = `xf${i - 2}`;
      const currLabel = i === N - 1 ? "vchain" : `xf${i - 1}`;
      filters.push(
        `[${prevLabel}][vs${i}]xfade=transition=${trans}:duration=${TD}:offset=${cumOffset.toFixed(3)}[${currLabel}]`,
      );
    }
  }

  // Étape C : grading colorimétrique caribéen cinématique
  // - eq : légère chaleur (gamma_r↑ gamma_b↓), contraste modéré, saturation
  // - unsharp : netteté douce
  // - vignette : bords assombris pour effet cinéma
  filters.push(
    `[vchain]` +
    `eq=brightness=0.02:saturation=1.25:contrast=1.08:gamma_r=1.05:gamma_b=0.96,` +
    `unsharp=5:5:0.8:3:3:0.4,` +
    `vignette=PI/4.5` +
    `[vfinal]`,
  );

  // Étape D : fade audio entrée/sortie
  const totalVideoSec = entries.reduce(
    (sum, e, i) => sum + e.targetSec - (i < N - 1 ? TD : 0),
    0,
  );
  const fadeOutStart = Math.max(0, totalVideoSec - 3.5).toFixed(3);

  filters.push(
    `[${audioInputIdx}:a]` +
    `afade=t=in:st=0:d=2,` +
    `afade=t=out:st=${fadeOutStart}:d=3.5,` +
    `volume=0.88` +
    `[aout]`,
  );

  return filters.join(";");
}

// ── 7. Lancer le montage FFmpeg ───────────────────────────────────────────────

function runMontage(entries, filterComplex) {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const inputArgs = [];
  entries.forEach((e) => inputArgs.push("-i", e.fullPath));
  inputArgs.push("-i", AUDIO_PATH);

  const args = [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vfinal]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-preset",
    "slow",       // meilleure qualité (vs fast)
    "-crf",
    "18",         // haute qualité (vs 23)
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-c:a",
    "aac",
    "-b:a",
    "192k",       // audio haute fidélité
    "-movflags",
    "+faststart",  // optimisé pour streaming web
    "-shortest",
    OUTPUT_PATH,
  ];

  console.log(`\n🎬 Lancement FFmpeg — ${entries.length} plans`);
  console.log(`   Résolution : ${RESOLUTION} @ ${FPS}fps`);

  const result = spawnSync("ffmpeg", args, { stdio: "inherit", encoding: "utf8" });

  if (result.status !== 0) {
    console.error(`❌ Erreur FFmpeg (code ${result.status})`);
    process.exit(result.status || 1);
  }
}

// ── 8. Générer la miniature ───────────────────────────────────────────────────

function generateThumbnail() {
  if (!fs.existsSync(OUTPUT_PATH)) return;

  const totalDur = getMediaDuration(OUTPUT_PATH);
  const seekTime = Math.max(1, totalDur * 0.12).toFixed(2);

  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      seekTime,
      "-i",
      OUTPUT_PATH,
      "-frames:v",
      "1",
      "-vf",
      `scale=${RESOLUTION.replace("x", ":")}:force_original_aspect_ratio=decrease,` +
        `pad=${RESOLUTION.replace("x", ":")}:(ow-iw)/2:(oh-ih)/2,` +
        `eq=brightness=0.05:saturation=1.3:contrast=1.1`,
      "-q:v",
      "2",
      THUMBNAIL_PATH,
    ],
    { stdio: "pipe", encoding: "utf8" },
  );

  if (result.status === 0) {
    console.log(`🖼️  Miniature générée : ${path.basename(THUMBNAIL_PATH)}`);
  }
}

// ── 9. Rapport de montage ─────────────────────────────────────────────────────

function printReport(entries, audioDuration) {
  let cumTime = 0;
  console.log("\n📋 Plan de montage :");
  console.log("─".repeat(68));
  console.log(
    `${"#".padStart(3)}  ${"Fichier".padEnd(22)} ${"Section".padEnd(10)} ${"Rythme".padEnd(8)} ${"Début".padStart(6)} → ${"Fin".padStart(6)}   Durée`,
  );
  console.log("─".repeat(68));

  entries.forEach((e, i) => {
    const start = cumTime.toFixed(1);
    const td = e.targetSec - (i < entries.length - 1 ? TRANSITION_DURATION : 0);
    cumTime += td;
    const end = cumTime.toFixed(1);
    const pace =
      e.pace === "fast" ? "⚡ rapide" : e.pace === "slow" ? "🌊 lent" : "🎵 moyen";
    console.log(
      `${String(i + 1).padStart(3)}  ${e.file.padEnd(22)} ${e.section.padEnd(10)} ${pace.padEnd(12)} ${String(start + "s").padStart(6)} → ${String(end + "s").padStart(6)}   ${e.targetSec.toFixed(1)}s`,
    );
  });

  console.log("─".repeat(68));
  console.log(
    `     Total vidéo : ${cumTime.toFixed(1)}s | Durée audio : ${audioDuration.toFixed(1)}s | Plans : ${entries.length}`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log("🎬 Montage Smart — Storyboard + Musique\n");

  // Vérifier les prérequis
  if (!fs.existsSync(AUDIO_PATH)) {
    console.error(`❌ Fichier audio introuvable : ${AUDIO_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(PLANS_DIR)) {
    console.error(`❌ Dossier plans introuvable : ${PLANS_DIR}`);
    process.exit(1);
  }

  const planFiles = fs
    .readdirSync(PLANS_DIR)
    .filter((f) => f.endsWith(".mp4"))
    .sort();

  if (planFiles.length === 0) {
    console.error(`❌ Aucun clip .mp4 trouvé dans ${PLANS_DIR}`);
    process.exit(1);
  }

  console.log(`📁 Clips disponibles : ${planFiles.length} fichier(s)`);
  planFiles.forEach((f) => console.log(`   • ${f}`));

  // Durée de la musique
  const audioDuration = getMediaDuration(AUDIO_PATH);
  console.log(`\n🎵 Durée audio : ${audioDuration.toFixed(1)}s`);

  // Charger le storyboard
  const clipsJson = loadClipsJson();

  // Construire le planning musical
  const slots = buildMusicSchedule(audioDuration, planFiles.length);

  // Assigner les clips aux slots
  const rawEntries = assignClipsToSlots(slots, clipsJson, planFiles);

  // Limiter à MAX(3 × nombre de clips, slots) pour éviter une vidéo interminable
  const maxEntries = Math.max(planFiles.length * 3, 8);
  const entries = rawEntries.slice(0, maxEntries);

  // Rapport
  printReport(entries, audioDuration);

  // Construire le filter_complex
  const audioInputIdx = entries.length;
  const filterComplex = buildFilterComplex(entries, audioInputIdx);

  // Lancer FFmpeg
  runMontage(entries, filterComplex);

  // Miniature
  generateThumbnail();

  // Rapport final
  const finalStats = fs.statSync(OUTPUT_PATH);
  const finalDur = getMediaDuration(OUTPUT_PATH);
  const finalSizeKo = (finalStats.size / 1024).toFixed(0);

  console.log("\n✅ Montage terminé !");
  console.log(`   Fichier  : ${OUTPUT_PATH}`);
  console.log(`   Taille   : ${finalSizeKo} Ko`);
  console.log(`   Durée    : ${finalDur.toFixed(1)}s`);
  console.log(`   Qualité  : CRF 18, H.264 High, AAC 192k`);
  console.log(`   Grading  : caribéen cinématique`);
}

main();
