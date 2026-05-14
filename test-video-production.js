#!/usr/bin/env node

/**
 * Script de test pour la production de vidéo
 * Teste le workflow complet: storyboard -> clip-package -> generate-videos
 */

const BASE_URL = "http://localhost:3000";

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testStoryboard() {
  console.log("\n📋 TEST 1: Storyboard (génération du plan vidéo)");
  console.log("============================================");

  const storyboardRequest = {
    prompt: "Un chat jouant avec une balle de laine dans un salon cosy",
    titre: "Chat Joueur",
    typeVideo: "demo",
    duree: "30 secondes",
    format: "16:9",
    nombrePlans: 4,
  };

  try {
    console.log("📤 Envoi de la requête storyboard...");
    const response = await fetch(`${BASE_URL}/api/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(storyboardRequest),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Storyboard généré avec succès!");
      console.log("🎬 Plans générés:", data.plans?.length || "N/A");
      console.log(
        "📄 Aperçu du premier plan:",
        data.plans?.[0]?.description?.substring(0, 100) + "..." || "N/A",
      );
      return data.plans;
    } else {
      console.error("❌ Erreur:", data.error || data.reason);
      return null;
    }
  } catch (error) {
    console.error("❌ Erreur réseau:", error.message);
    return null;
  }
}

async function testClipPackage(plans) {
  if (!plans || plans.length === 0) {
    console.log("\n⚠️  TEST 2: IGNORÉ (pas de plans du storyboard)");
    return null;
  }

  console.log("\n📦 TEST 2: Clip Package (enrichissement des prompts)");
  console.log("====================================================");

  const clipPackageRequest = {
    titre: "Chat Joueur",
    plans: plans.slice(0, 2).map((plan, idx) => ({
      id: idx + 1,
      nom: `Plan ${idx + 1}`,
      duree: "10 secondes",
      description: plan.description,
      promptVideo: plan.promptVideo || plan.description,
    })),
  };

  try {
    console.log("📤 Envoi du pack de clips...");
    const response = await fetch(`${BASE_URL}/api/clip-package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clipPackageRequest),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Pack de clips créé!");
      console.log("📁 Fichiers exportés:", data.files || "N/A");
      console.log("📊 Prompts enrichis:", data.clipsCount || "N/A");
      return data.clips;
    } else {
      console.error("❌ Erreur:", data.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Erreur réseau:", error.message);
    return null;
  }
}

async function testGenerateVideos(clips) {
  if (!clips || clips.length === 0) {
    console.log("\n⚠️  TEST 3: IGNORÉ (pas de clips)");
    return null;
  }

  console.log("\n🎥 TEST 3: Generate Videos (génération via Replicate)");
  console.log("======================================================");

  const generateRequest = {
    titre: "Chat Joueur",
    clips: clips.slice(0, 1).map((clip) => ({
      ...clip,
      promptVideo: clip.promptVideo || "Un chat jouant avec une balle de laine",
      promptImage: clip.promptImage || "Un chat mignon avec une balle de laine",
    })),
  };

  try {
    console.log("📤 Envoi de la demande de génération vidéo...");
    console.log("⏳ Cela peut prendre plusieurs minutes...");

    const response = await fetch(`${BASE_URL}/api/generate-videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(generateRequest),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Génération lancée!");
      console.log(
        "📊 Statut des jobs:",
        data.jobs?.map((j) => j.status).join(", ") || "N/A",
      );
      console.log("💾 Fichiers sauvegardés:", data.jobs?.[0]?.savedTo || "N/A");
      return data.jobs;
    } else {
      console.error("❌ Erreur:", data.error);
      console.log(
        "💡 Astuce: Assurez-vous que REPLICATE_API_TOKEN est configuré dans .env.local",
      );
      return null;
    }
  } catch (error) {
    console.error("❌ Erreur réseau:", error.message);
    return null;
  }
}

async function testHealthCheck() {
  console.log("\n🏥 HEALTH CHECK: Vérification que le serveur répond");
  console.log("==================================================");

  try {
    const response = await fetch(`${BASE_URL}`);
    if (response.ok) {
      console.log("✅ Serveur accessible sur http://localhost:3000");
      return true;
    }
  } catch (error) {
    console.error("❌ Serveur non accessible:", error.message);
    return false;
  }
}

async function runTests() {
  console.log("🎬 TEST DE PRODUCTION VIDÉO RUDYO");
  console.log("==================================");

  // Health check
  const serverOk = await testHealthCheck();
  if (!serverOk) {
    console.error(
      "\n❌ Le serveur n'est pas accessible. Assurez-vous que 'npm run dev' est en cours d'exécution.",
    );
    process.exit(1);
  }

  // Test storyboard
  const plans = await testStoryboard();
  await delay(1000);

  // Test clip package
  const clips = await testClipPackage(plans);
  await delay(1000);

  // Test video generation
  await testGenerateVideos(clips);

  console.log("\n✨ Tests terminés!");
  console.log("\n📝 PROCHAINES ÉTAPES:");
  console.log("1. Vérifiez les fichiers générés dans 'media/export/'");
  console.log("2. Pour le montage final, exécutez: npm run montage");
  console.log(
    "3. Le vidéo final sera sauvegardé dans 'media/export/clip_final.mp4'",
  );
}

runTests().catch(console.error);
