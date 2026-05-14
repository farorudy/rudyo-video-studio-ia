#!/usr/bin/env node

/**
 * Crée des fichiers vidéo de test avec FFmpeg
 * pour tester le workflow de montage complet
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const mediaPath = path.join(process.cwd(), "media");
const plansDir = path.join(mediaPath, "plans");
const audioDir = path.join(mediaPath, "audio");

console.log("🎬 Création de fichiers vidéo de test avec FFmpeg");
console.log("================================================\n");

// Paramètres pour les vidéos de test
const testClips = [
  { file: "clip_1.mp4", color: "red" },
  { file: "clip_2.mp4", color: "green" },
  { file: "clip_3.mp4", color: "blue" },
];

try {
  // Créer chaque clip vidéo
  for (const clip of testClips) {
    const outputPath = path.join(plansDir, clip.file);

    console.log(`📹 Création de ${clip.file}...`);

    // Générer une vidéo simple avec une couleur (sans texte)
    // Utilise 2 secondes pour un test plus rapide
    const cmd = `ffmpeg -f lavfi -i color=${clip.color}:s=1280x720:d=2 -c:v libx264 -preset ultrafast -crf 51 "${outputPath}" -y 2>&1`;

    try {
      const output = execSync(cmd);
      const stats = fs.statSync(outputPath);
      console.log(`   ✅ Créé (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (error) {
      console.error(`   ❌ Erreur FFmpeg`);
      console.error(`      ${error.toString().split("\n")[0]}`);
    }
  }

  console.log("\n✨ Fichiers vidéo de test créés!");
  console.log("\n📋 Fichiers disponibles pour le montage:");

  const files = fs
    .readdirSync(plansDir)
    .filter((f) => f.match(/clip_\d+\.mp4$/));
  for (const file of files) {
    const stats = fs.statSync(path.join(plansDir, file));
    console.log(`   • ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
  }

  console.log("\n🎵 Audio:");
  if (fs.existsSync(path.join(audioDir, "musique.mp3"))) {
    const stats = fs.statSync(path.join(audioDir, "musique.mp3"));
    console.log(`   ✅ musique.mp3 (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(
      `   ⚠️  musique.mp3 manquant - le montage utilisera la piste vidéo seulement`,
    );
  }

  console.log("\n✨ Prêt pour le montage!");
  console.log("\n🎬 Commandes de montage disponibles:\n");
  console.log("  npm run montage              (montage standard)");
  console.log("  npm run montage:advanced     (avec transitions)");
  console.log("  npm run montage:smart        (analyse intelligente)\n");
  console.log("Résultat final: media/export/clip_final.mp4");
} catch (error) {
  console.error("\n❌ Erreur:", error.message);
}
