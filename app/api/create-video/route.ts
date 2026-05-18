import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import {
  isCloudStorageEnabled,
  putStorageBuffer,
  toClientFileRef,
} from "@/lib/storage";
import type { StoryboardPlan, StoryboardResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const MIN_VIDEO_BYTES = 100 * 1024;

type CreateVideoBody = {
  storyboard?: StoryboardResult;
};

type StoryboardPlanWithDialogue = StoryboardPlan & {
  dialogue?: string;
  objectif_pedagogique?: string;
  titre_etape?: string;
};

type VideoQuality = {
  duration: number;
  width: number;
  height: number;
};

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeText(value?: string | null) {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(text: string, maxChars: number, maxLines: number) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (words.join(" ").length > lines.join(" ").length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\.*$/, "")}...`;
  }

  return lines.length > 0 ? lines : ["A completer avec le contenu du storyboard."];
}

function svgTextBlock(
  lines: string[],
  x: number,
  y: number,
  options: {
    size: number;
    color: string;
    weight?: number;
    lineHeight?: number;
  },
) {
  const lineHeight = options.lineHeight ?? Math.round(options.size * 1.35);
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="${options.color}" font-size="${options.size}" font-weight="${options.weight ?? 500}">${escapeXml(line)}</text>`,
    )
    .join("");
}

function pedagogicalDialogue(plan: StoryboardPlanWithDialogue) {
  const dialogue = normalizeText(plan.dialogue);
  if (dialogue) {
    return dialogue;
  }

  const description = normalizeText(plan.description);
  return `Conseiller : "Si je reformule, votre priorite est de ${description.toLowerCase()}." Usager : "Oui, j'ai besoin d'un plan clair pour avancer."`;
}

function pedagogicalObjective(plan: StoryboardPlanWithDialogue, index: number) {
  const objective = normalizeText(plan.objectif_pedagogique);
  if (objective) {
    return objective;
  }

  const defaults = [
    "Installer un cadre d'accueil rassurant et clarifier la demande de l'usager.",
    "Identifier les freins, les ressources et les attentes avec des questions ouvertes.",
    "Valoriser les competences et construire un plan d'action realiste.",
  ];

  return defaults[index] ?? "Transformer l'analyse de la situation en prochaine action concrete.";
}

function planTitle(plan: StoryboardPlanWithDialogue, index: number) {
  const explicit = normalizeText(plan.titre_etape || plan.texte_ecran);
  if (explicit) {
    return explicit;
  }

  const titles = [
    "Accueil et cadrage de l'entretien",
    "Analyse de la demande et des freins",
    "Valorisation des competences et plan d'action",
  ];

  return titles[index] ?? `Etape pedagogique ${index + 1}`;
}

function renderStoryboardSlideSvg(
  plan: StoryboardPlanWithDialogue,
  index: number,
  project: StoryboardResult,
) {
  const stepTitle = planTitle(plan, index);
  const description = normalizeText(plan.description || project.resume);
  const camera = normalizeText(plan.camera);
  const screenText = normalizeText(plan.texte_ecran);
  const transition = normalizeText(plan.transition);
  const dialogue = pedagogicalDialogue(plan);
  const objective = pedagogicalObjective(plan, index);

  return `
<svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" viewBox="0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="#020617"/>
  <rect x="72" y="58" width="1776" height="92" rx="20" fill="#0F172A"/>
  <rect x="96" y="88" width="10" height="34" rx="5" fill="#06B6D4"/>
  <text x="126" y="113" fill="#CBD5E1" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">Rudyo Video Studio IA — Formation CIP</text>
  <text x="1510" y="113" fill="#10B981" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800">Plan ${index + 1}</text>

  <rect x="72" y="186" width="1776" height="758" rx="28" fill="#0F172A"/>
  <rect x="72" y="186" width="1776" height="8" fill="#06B6D4"/>
  <circle cx="1580" cy="276" r="122" fill="#06B6D4" opacity="0.10"/>
  <circle cx="1718" cy="762" r="154" fill="#10B981" opacity="0.09"/>

  <text x="120" y="266" fill="#06B6D4" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800">Projet</text>
  ${svgTextBlock(wrapText(project.titre, 55, 2), 120, 318, {
    size: 54,
    color: "#FFFFFF",
    weight: 900,
    lineHeight: 66,
  })}

  <rect x="120" y="448" width="760" height="214" rx="20" fill="#020617" opacity="0.78"/>
  <text x="154" y="504" fill="#10B981" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800">Objectif pédagogique</text>
  ${svgTextBlock(wrapText(objective, 50, 3), 154, 560, {
    size: 34,
    color: "#FFFFFF",
    weight: 700,
    lineHeight: 46,
  })}

  <rect x="920" y="270" width="860" height="392" rx="20" fill="#020617" opacity="0.78"/>
  <text x="956" y="328" fill="#06B6D4" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800">${escapeXml(stepTitle)}</text>
  <text x="956" y="388" fill="#CBD5E1" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">Description visuelle</text>
  ${svgTextBlock(wrapText(description, 58, 4), 956, 438, {
    size: 30,
    color: "#FFFFFF",
    weight: 500,
    lineHeight: 42,
  })}

  <rect x="120" y="700" width="790" height="172" rx="20" fill="#020617" opacity="0.78"/>
  <text x="154" y="754" fill="#06B6D4" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800">Dialogue conseillé</text>
  ${svgTextBlock(wrapText(dialogue, 58, 3), 154, 804, {
    size: 27,
    color: "#CBD5E1",
    weight: 600,
    lineHeight: 37,
  })}

  <rect x="950" y="700" width="830" height="172" rx="20" fill="#020617" opacity="0.78"/>
  <text x="986" y="754" fill="#10B981" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800">Texte à l'écran</text>
  ${svgTextBlock(wrapText(screenText || stepTitle, 58, 2), 986, 804, {
    size: 30,
    color: "#FFFFFF",
    weight: 800,
    lineHeight: 42,
  })}
  <text x="986" y="884" fill="#CBD5E1" font-family="Arial, Helvetica, sans-serif" font-size="24">Caméra : ${escapeXml(camera || "plan moyen, échange face à face")}</text>
  <text x="986" y="920" fill="#CBD5E1" font-family="Arial, Helvetica, sans-serif" font-size="24">Transition : ${escapeXml(transition || "fondu sobre")}</text>

  <rect x="72" y="972" width="1776" height="58" rx="18" fill="#0F172A"/>
  <text x="110" y="1010" fill="#CBD5E1" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="700">Durée : ${escapeXml(plan.duree || "8 secondes")}</text>
  <text x="1485" y="1010" fill="#10B981" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800">${escapeXml(plan.type_media)} · ${escapeXml(plan.statut)}</text>
</svg>`;
}

async function renderStoryboardSlide(
  plan: StoryboardPlanWithDialogue,
  index: number,
  project: StoryboardResult,
  tmpDir: string,
) {
  const fileName = `plan-${String(index + 1).padStart(2, "0")}.png`;
  const outputPath = path.join(tmpDir, fileName);
  const svg = renderStoryboardSlideSvg(plan, index, project);

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return outputPath;
}

function parseDurationSeconds(value: string | undefined, fallback: number) {
  const match = normalizeText(value).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    return fallback;
  }

  return Math.max(3, Number(match[1].replace(",", ".")));
}

async function createPlanImages(
  storyboard: StoryboardResult,
  tmpDir: string,
) {
  await fs.mkdir(tmpDir, { recursive: true });

  const plans: StoryboardPlanWithDialogue[] =
    storyboard.storyboard.length > 0
      ? storyboard.storyboard
      : [
          {
            plan: 1,
            duree: storyboard.duree_totale,
            description: storyboard.resume,
            camera: "Plan moyen, bureau d'accompagnement",
            texte_ecran: storyboard.titre,
            prompt_video_ia: "",
            transition: "Fondu sobre",
            type_media: "texte_anime",
            statut: "prompt_pret",
          },
        ];

  const imagePaths: string[] = [];
  const durations: number[] = [];

  for (const [index, plan] of plans.entries()) {
    imagePaths.push(await renderStoryboardSlide(plan, index, storyboard, tmpDir));
    durations.push(parseDurationSeconds(plan.duree, index === 0 ? 8 : 10));
  }

  return { imagePaths, durations };
}

async function writeImageConcatList(
  imagePaths: string[],
  durations: number[],
  listPath: string,
) {
  const normalized = imagePaths.map((imagePath) =>
    imagePath.replace(/\\/g, "/").replace(/'/g, "'\\''"),
  );
  const lines = normalized.flatMap((imagePath, index) => [
    `file '${imagePath}'`,
    `duration ${durations[index] ?? 8}`,
  ]);
  lines.push(`file '${normalized[normalized.length - 1]}'`);
  await fs.writeFile(listPath, lines.join("\n"), "utf8");
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function inspectVideo(outputPath: string): Promise<VideoQuality> {
  const { stdout } = await execFileAsync(
    ffprobePath,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      outputPath,
    ],
    { cwd: process.cwd(), windowsHide: true },
  );
  const data = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = data.streams?.[0] ?? {};

  return {
    duration: Number(data.format?.duration ?? 0),
    width: Number(stream.width ?? 0),
    height: Number(stream.height ?? 0),
  };
}

async function assertVideoQuality(outputPath: string, size: number) {
  const quality = await inspectVideo(outputPath);

  if (
    size <= MIN_VIDEO_BYTES ||
    quality.duration <= 0 ||
    quality.width !== SLIDE_WIDTH ||
    quality.height !== SLIDE_HEIGHT
  ) {
    throw new Error(
      "Le rendu ne contient pas de contenu pédagogique exploitable.",
    );
  }

  return quality;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Utilisateur non authentifie. Connectez-vous avant de creer une video.",
        },
        { status: 401 },
      );
    }

    const body = (await req.json()) as CreateVideoBody;
    const storyboard = body.storyboard;

    if (!storyboard?.titre || !Array.isArray(storyboard.storyboard)) {
      return NextResponse.json(
        {
          success: false,
          error: "Storyboard manquant. Generez un storyboard avant de creer la video.",
        },
        { status: 400 },
      );
    }

    const tempRoot = path.join(
      os.tmpdir(),
      `rudyo-video-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const exportDir = path.join(tempRoot, "export");
    const slidesDir = path.join(tempRoot, "tmp");
    await fs.mkdir(exportDir, { recursive: true });

    const slug = sanitizeFileName(storyboard.titre) || "rudyo-video";
    const listPath = path.join(exportDir, "list.txt");
    const outputPath = path.join(exportDir, `${slug}-generated.mp4`);
    const { imagePaths, durations } = await createPlanImages(storyboard, slidesDir);
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);

    await writeImageConcatList(imagePaths, durations, listPath);

    const audioPath = path.join(process.cwd(), "media", "audio", "musique.mp3");
    const hasAudio = await fileExists(audioPath);
    const ffmpegArgs = [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
    ];

    if (hasAudio) {
      ffmpegArgs.push("-stream_loop", "-1", "-i", audioPath);
    }

    ffmpegArgs.push(
      "-vsync",
      "vfr",
      "-vf",
      "fps=25,format=yuv420p",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
    );

    if (hasAudio) {
      ffmpegArgs.push("-t", String(totalDuration), "-c:a", "aac", "-shortest");
    }

    ffmpegArgs.push(outputPath);

    await execFileAsync(ffmpegPath, ffmpegArgs, {
      cwd: process.cwd(),
      windowsHide: true,
    });

    const stats = await fs.stat(outputPath);
    const quality = await assertVideoQuality(outputPath, stats.size);
    const outputBuffer = await fs.readFile(outputPath);
    const imageRefs: string[] = [];

    if (isCloudStorageEnabled()) {
      for (const imagePath of imagePaths) {
        const imageName = path.basename(imagePath);
        const imageBuffer = await fs.readFile(imagePath);
        const storedImage = await putStorageBuffer(
          `generated/${slug}-${imageName}`,
          imageBuffer,
          { contentType: "image/png" },
        );
        imageRefs.push(toClientFileRef(`generated/${slug}-${imageName}`, storedImage.url));
      }
    } else if (process.env.VERCEL !== "1") {
      const localGeneratedDir = path.join(process.cwd(), "media", "generated");
      await fs.mkdir(localGeneratedDir, { recursive: true });
      for (const imagePath of imagePaths) {
        const imageName = `${slug}-${path.basename(imagePath)}`;
        await fs.copyFile(imagePath, path.join(localGeneratedDir, imageName));
        imageRefs.push(`media/generated/${imageName}`);
      }
    }

    let videoUrl = "";
    let dataUrl: string | undefined;
    const outputName = path.basename(outputPath);

    if (isCloudStorageEnabled()) {
      const storedVideo = await putStorageBuffer(
        `export/${outputName}`,
        outputBuffer,
        { contentType: "video/mp4" },
      );
      videoUrl = toClientFileRef(`export/${outputName}`, storedVideo.url);
    } else if (process.env.VERCEL === "1") {
      dataUrl = `data:video/mp4;base64,${outputBuffer.toString("base64")}`;
    } else {
      const localOutputDir = path.join(process.cwd(), "media", "export");
      await fs.mkdir(localOutputDir, { recursive: true });
      await fs.copyFile(outputPath, path.join(localOutputDir, outputName));
      videoUrl = `/api/generated-video?file=${encodeURIComponent(outputName)}`;
    }

    return NextResponse.json({
      success: true,
      result: {
        file: `media/export/${outputName}`,
        url: videoUrl,
        dataUrl,
        size: stats.size,
        duration: quality.duration,
        width: quality.width,
        height: quality.height,
        images: imageRefs,
        audio: hasAudio ? "media/audio/musique.mp3" : null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";
    console.error("[rudyo-create-video] erreur", { message });

    return NextResponse.json(
      {
        success: false,
        error: `Impossible de creer la video MP4 : ${message}`,
      },
      { status: 500 },
    );
  }
}
