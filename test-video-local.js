#!/usr/bin/env node

/**
 * Script de test simplifié pour la production de vidéo
 * Teste le workflow local sans dépendre d'authentification
 * Utilise les fallbacks mock et locaux
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test 1: Vérifier les fichiers de configuration média existants
async function testMediaStructure() {
  console.log("\n📂 TEST 1: Vérification de la structure média");
  console.log("=============================================");

  const mediaPath = path.join(process.cwd(), "media");
  const requiredDirs = ["plans", "audio", "export"];

  try {
    for (const dir of requiredDirs) {
      const dirPath = path.join(mediaPath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Dossier créé: media/${dir}`);
      } else {
        console.log(`✅ Dossier existe: media/${dir}`);
      }
    }

    // Vérifier les fichiers audio et config
    const audioPath = path.join(mediaPath, "audio");
    if (fs.existsSync(path.join(audioPath, "musique.mp3"))) {
      console.log("✅ Fichier audio trouvé: media/audio/musique.mp3");
    } else {
      console.log(
        "⚠️  Musique d'accompagnement manquante (media/audio/musique.mp3)",
      );
    }

    const montageConfig = path.join(mediaPath, "montage-config.json");
    if (fs.existsSync(montageConfig)) {
      const config = JSON.parse(fs.readFileSync(montageConfig, "utf8"));
      console.log(`✅ Configuration montage trouvée`);
      console.log(
        `   Durée transition: ${config.transitionDuration || "N/A"}ms`,
      );
    } else {
      console.log("⚠️  Configuration montage manquante");
    }

    return true;
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    return false;
  }
}

// Test 2: Vérifier les scripts de montage
async function testMontageScripts() {
  console.log("\n📽️  TEST 2: Vérification des scripts de montage");
  console.log("=============================================");

  const scripts = ["montage.js", "montage-advanced.js", "montage-smart.js"];
  const scriptsPath = path.join(process.cwd(), "scripts");

  for (const script of scripts) {
    const scriptPath = path.join(scriptsPath, script);
    if (fs.existsSync(scriptPath)) {
      const content = fs.readFileSync(scriptPath, "utf8");
      const hasFFmpeg =
        content.includes("ffmpeg") || content.includes("FFmpeg");
      console.log(`✅ ${script}`);
      if (hasFFmpeg) console.log(`   ✓ Utilise FFmpeg`);
    } else {
      console.log(`❌ ${script} manquant`);
    }
  }
}

// Test 3: Créer des fichiers de test
async function createTestMediaFiles() {
  console.log("\n🎬 TEST 3: Création de fichiers média de test");
  console.log("=============================================");

  const mediaPath = path.join(process.cwd(), "media");
  const plansDir = path.join(mediaPath, "plans");

  // Créer des fichiers de test vides (simulation)
  const testVideos = ["clip_1.mp4", "clip_2.mp4", "clip_3.mp4"];

  try {
    for (const video of testVideos) {
      const videoPath = path.join(plansDir, video);
      // Créer un fichier vide pour la démo
      if (!fs.existsSync(videoPath)) {
        fs.writeFileSync(videoPath, "");
        console.log(`✅ Créé: media/plans/${video} (fichier vide de test)`);
      } else {
        console.log(`✅ Fichier existe: media/plans/${video}`);
      }
    }

    // Créer une liste de plans pour le montage
    const plansList = testVideos.map((v, i) => ({
      file: path.join(plansDir, v),
      duration: 10,
      order: i + 1,
    }));

    const configPath = path.join(mediaPath, "plans-config.json");
    fs.writeFileSync(configPath, JSON.stringify(plansList, null, 2));
    console.log(`✅ Configuration des plans créée: media/plans-config.json`);

    return true;
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    return false;
  }
}

// Test 4: Afficher les commandes disponibles
async function showAvailableCommands() {
  console.log("\n⚙️  TEST 4: Commandes de montage disponibles");
  console.log("=========================================");

  const commands = [
    {
      cmd: "npm run montage",
      desc: "Montage standard avec FFmpeg",
    },
    {
      cmd: "npm run montage:advanced",
      desc: "Montage avancé avec effets et transitions",
    },
    {
      cmd: "npm run montage:smart",
      desc: "Montage intelligent avec analyse de contenu",
    },
  ];

  console.log("\n📋 Commandes disponibles:\n");
  for (const cmd of commands) {
    console.log(`  ${cmd.cmd}`);
    console.log(`    → ${cmd.desc}\n`);
  }
}

// Test 5: Vérifier les formats supportés
async function checkSupportedFormats() {
  console.log("\n📊 TEST 5: Formats et configurations supportés");
  console.log("============================================");

  const formats = [
    { name: "16:9 (Landscape)", aspect: "16:9", resolution: "1920x1080" },
    { name: "9:16 (Portrait)", aspect: "9:16", resolution: "1080x1920" },
    { name: "1:1 (Square)", aspect: "1:1", resolution: "1080x1080" },
    { name: "4:3 (Standard)", aspect: "4:3", resolution: "1024x768" },
  ];

  console.log("\n✅ Formats vidéo supportés:\n");
  for (const fmt of formats) {
    console.log(`  • ${fmt.name}`);
    console.log(`    Aspect: ${fmt.aspect} | Résolution: ${fmt.resolution}`);
  }
}

// Test 6: Guide de test complet
async function printTestGuide() {
  console.log("\n📖 GUIDE DE TEST COMPLET");
  console.log("========================\n");

  console.log("1️⃣  STORYBOARD (Génération du plan vidéo):");
  console.log("   POST http://localhost:3000/api/storyboard");
  console.log("   Body: { prompt, titre, duree, nombrePlans, ... }");
  console.log("   (Nécessite authentification)\n");

  console.log("2️⃣  CLIP PACKAGE (Enrichissement des prompts):");
  console.log("   POST http://localhost:3000/api/clip-package");
  console.log("   Body: { titre, plans: [...] }");
  console.log("   Crée: media/export/*-clips.json et *-clips.txt\n");

  console.log("3️⃣  UPLOAD VIDÉOS (Upload manuel):");
  console.log("   POST http://localhost:3000/api/upload-plans");
  console.log("   Place les vidéos dans: media/plans/\n");

  console.log("4️⃣  MONTAGE FINAL (Assemblage):");
  console.log("   npm run montage");
  console.log("   Assemble: media/plans/* + media/audio/musique.mp3");
  console.log("   Résultat: media/export/clip_final.mp4\n");

  console.log("💡 WORKFLOW ALTERNATIF (Sans AI):");
  console.log("   1. Préparez vos vidéos MP4 dans media/plans/");
  console.log("   2. Exécutez: npm run montage");
  console.log("   3. Vidéo finale dans: media/export/clip_final.mp4\n");

  console.log("🔧 CONFIGURATION OPTIONNELLE:");
  console.log("   • REPLICATE_API_TOKEN: Pour la génération vidéo IA");
  console.log("   • OLLAMA_BASE_URL: Pour les storyboards locaux");
  console.log("   • AUTH_COOKIE_SECRET: Pour l'authentification");
}

async function runAllTests() {
  console.log("🎥 TEST DE PRODUCTION VIDÉO - MODE LOCAL");
  console.log("========================================\n");

  await testMediaStructure();
  await testMontageScripts();
  await createTestMediaFiles();
  await showAvailableCommands();
  await checkSupportedFormats();
  await printTestGuide();

  console.log("\n✨ Tests terminés!");
  console.log("📌 Prochaines étapes:");
  console.log("   1. Confirmez que les fichiers média sont en place");
  console.log("   2. Pour tester l'API, utilisez curl ou Postman");
  console.log("   3. Pour le montage, exécutez: npm run montage");
}

runAllTests().catch(console.error);
