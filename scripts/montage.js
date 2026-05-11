const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const plansDir = path.join(__dirname, "..", "media", "plans");
const audioPath = path.join(__dirname, "..", "media", "audio", "musique.mp3");
const exportPath = path.join(
  __dirname,
  "..",
  "media",
  "export",
  "clip_final.mp4",
);
const listePath = path.join(__dirname, "..", "media", "liste.txt");

const fichiers = fs
  .readdirSync(plansDir)
  .filter((file) => file.endsWith(".mp4"))
  .sort();

if (fichiers.length === 0) {
  console.error("Aucun fichier vidéo trouvé dans media/plans");
  process.exit(1);
}

const contenuListe = fichiers
  .map((file) => `file '${path.join(plansDir, file).replace(/\\/g, "/")}'`)
  .join("\n");

fs.writeFileSync(listePath, contenuListe);

const commande = `ffmpeg -y -f concat -safe 0 -i "${listePath}" -i "${audioPath}" -c:v libx264 -c:a aac -shortest "${exportPath}"`;

console.log("Montage en cours...");
execSync(commande, { stdio: "inherit" });
console.log("Vidéo exportée :", exportPath);
