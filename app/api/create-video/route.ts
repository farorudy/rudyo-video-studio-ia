import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  isCloudStorageEnabled,
  putStorageBuffer,
  toClientFileRef,
} from "@/lib/storage";
import type { StoryboardPlan, StoryboardResult } from "@/lib/types";
import {
  renderStoryboardSlidePng,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from "@/lib/video-slide-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;
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

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

async function renderStoryboardSlide(
  plan: StoryboardPlanWithDialogue,
  index: number,
  project: StoryboardResult,
  tmpDir: string,
) {
  const fileName = `plan-${String(index + 1).padStart(2, "0")}.png`;
  const outputPath = path.join(tmpDir, fileName);
  return renderStoryboardSlidePng(plan, index, project, outputPath);
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
            "Utilisateur non authentifié. Connectez-vous avant de créer une vidéo.",
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
          error: "Storyboard manquant. Générez un storyboard avant de créer la vidéo.",
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
      const storageKey = `export/${user.id}/${outputName}`;
      const storedVideo = await putStorageBuffer(
        storageKey,
        outputBuffer,
        { contentType: "video/mp4" },
      );
      videoUrl = toClientFileRef(storageKey, storedVideo.url);
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
