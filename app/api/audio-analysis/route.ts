import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import {
  putStorageBuffer,
  putStorageText,
  toClientFileRef,
} from "@/lib/storage";

const execFileAsync = promisify(execFile);

type AudioSection = {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  energy: "low" | "medium" | "high";
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 80);
}

function estimateBpm(durationSec: number) {
  if (durationSec <= 90) {
    return 124;
  }

  if (durationSec <= 180) {
    return 112;
  }

  return 98;
}

function buildSections(durationSec: number): AudioSection[] {
  const safeDuration = Math.max(10, durationSec);
  const markers = [0, 0.12, 0.42, 0.68, 0.84, 1].map((ratio) =>
    round2(safeDuration * ratio),
  );

  const sections: AudioSection[] = [
    {
      id: "intro",
      label: "Intro",
      startSec: markers[0],
      endSec: markers[1],
      energy: "low",
    },
    {
      id: "couplet-1",
      label: "Couplet",
      startSec: markers[1],
      endSec: markers[2],
      energy: "medium",
    },
    {
      id: "refrain",
      label: "Refrain",
      startSec: markers[2],
      endSec: markers[3],
      energy: "high",
    },
    {
      id: "bridge",
      label: "Pont",
      startSec: markers[3],
      endSec: markers[4],
      energy: "medium",
    },
    {
      id: "outro",
      label: "Outro",
      startSec: markers[4],
      endSec: markers[5],
      energy: "low",
    },
  ];

  return sections.filter((section) => section.endSec > section.startSec + 0.2);
}

async function probeAudioDuration(filePath: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  const parsed = Number.parseFloat(stdout.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Durée audio invalide.");
  }

  return parsed;
}

export async function POST(req: NextRequest) {
  let tempPath = "";

  try {
    const formData = await req.formData();
    const input = formData.get("audio");

    if (!(input instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun fichier audio reçu.",
        },
        { status: 400 },
      );
    }

    const extension = path.extname(input.name) || ".mp3";
    const safeName = sanitizeFileName(path.basename(input.name, extension));
    const targetName = `${safeName}${extension}`;
    const buffer = Buffer.from(await input.arrayBuffer());

    tempPath = path.join(os.tmpdir(), `rudyo-audio-${Date.now()}${extension}`);
    await fs.writeFile(tempPath, buffer);

    const durationSec = round2(await probeAudioDuration(tempPath));
    const bpm = estimateBpm(durationSec);
    const sections = buildSections(durationSec);

    const audioStored = await putStorageBuffer(`audio/${targetName}`, buffer, {
      contentType: input.type || "audio/mpeg",
    });

    const analysis = {
      provider: "local-ffprobe",
      fileName: targetName,
      durationSec,
      bpm,
      sections,
      analyzedAt: new Date().toISOString(),
    };

    const analysisKey = `export/${safeName}-audio-analysis.json`;
    const analysisStored = await putStorageText(
      analysisKey,
      JSON.stringify(analysis, null, 2),
      { contentType: "application/json; charset=utf-8" },
    );

    return NextResponse.json({
      success: true,
      result: {
        ...analysis,
        audioRef: toClientFileRef(`audio/${targetName}`, audioStored.url),
        analysisRef: toClientFileRef(analysisKey, analysisStored.url),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur pendant l'analyse audio.";

    return NextResponse.json(
      {
        success: false,
        error:
          message.includes("ffprobe") || message.includes("ENOENT")
            ? "FFprobe est requis pour analyser la musique. Installez FFmpeg/FFprobe sur la machine."
            : message,
      },
      { status: 500 },
    );
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}
