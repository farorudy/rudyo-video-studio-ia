import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import {
  renderStoryboardSlidePng,
  renderStoryboardSlideSvg,
} from "../lib/video-slide-renderer";
import type { StoryboardResult } from "../lib/types";

const execFileAsync = promisify(execFile);
const generatedDir = path.join(process.cwd(), "media", "generated");
const exportDir = path.join(process.cwd(), "media", "export");
const svgPath = path.join(generatedDir, "accented-text-test.svg");
const pngPath = path.join(generatedDir, "accented-text-test.png");
const mp4Path = path.join(exportDir, "accented-text-test.mp4");

const storyboard: StoryboardResult = {
  titre: "Entretien simulé — Conseiller en insertion professionnelle",
  type_video: "formation",
  format: "16:9",
  style: "pédagogique",
  duree_totale: "8 secondes",
  resume:
    "Accueillir l’usager, reformuler sa demande, identifier les freins à l’emploi.",
  storyboard: [
    {
      plan: 1,
      titre_etape: "Entretien simulé — Conseiller en insertion professionnelle",
      duree: "8 secondes",
      description:
        "Accueillir l’usager, reformuler sa demande, identifier les freins à l’emploi.",
      camera: "Plan moyen, échange face à face",
      texte_ecran: "Bòd lanmè pa lwen — Lanbéli tou pré",
      dialogue:
        "Conseiller : “Bòd lanmè pa lwen — Lanbéli tou pré.” Usager : “Mwen ka konprann.”",
      objectif_pedagogique:
        "Accueillir l’usager, reformuler sa demande, identifier les freins à l’emploi.",
      prompt_video_ia: "",
      transition: "Fondu sobre",
      type_media: "texte_anime",
      statut: "prompt_pret",
    },
  ],
};

async function main() {
  await mkdir(generatedDir, { recursive: true });
  await mkdir(exportDir, { recursive: true });

  const svg = renderStoryboardSlideSvg(storyboard.storyboard[0], 0, storyboard);
  await writeFile(svgPath, svg, "utf8");
  await renderStoryboardSlidePng(storyboard.storyboard[0], 0, storyboard, pngPath);
  await execFileAsync(
    ffmpegInstaller.path,
    [
      "-y",
      "-loop",
      "1",
      "-i",
      pngPath,
      "-t",
      "2",
      "-vf",
      "fps=25,format=yuv420p",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      mp4Path,
    ],
    { cwd: process.cwd(), windowsHide: true },
  );

  console.log(`SVG accentué généré : ${svgPath}`);
  console.log(`PNG accentué généré : ${pngPath}`);
  console.log(`MP4 accentué généré : ${mp4Path}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
