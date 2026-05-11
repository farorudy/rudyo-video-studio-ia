import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import {
  isCloudStorageEnabled,
  listStorage,
  putStorageBuffer,
  readStorageBuffer,
  toClientFileRef,
} from "@/lib/storage";

const execFileAsync = promisify(execFile);

type MontageConfig = {
  clips: Array<{ file: string; duree?: number; subtitleText?: string }>;
  transition?: { type: "cut" | "fade" | "wipe"; duree?: number };
  audio?: {
    musique?: string;
    voix?: string;
    musiqueVolume?: number;
    voixVolume?: number;
  };
  output?: {
    fichier?: string;
    resolution?: string;
    fps?: number;
  };
};

export async function POST(request: NextRequest) {
  try {
    const workspaceRoot = process.cwd();

    // Lecture du body JSON optionnel
    let advancedConfig: MontageConfig | null = null;
    let smartMode = false;
    try {
      const body = await request.json();
      if (body && body.config) {
        advancedConfig = body.config as MontageConfig;
      } else if (body && body.smart === true) {
        smartMode = true;
      }
    } catch {
      // Pas de body JSON → mode simple
    }

    // Détection automatique du mode smart : si un storyboard JSON existe dans export/
    if (!advancedConfig && !smartMode) {
      const exportDir = path.join(workspaceRoot, "media", "export");
      try {
        const exportFiles = await fs.readdir(exportDir);
        if (exportFiles.some((f) => f.endsWith("-clips.json"))) {
          smartMode = true;
        }
      } catch {
        // Pas de dossier export → mode simple
      }
    }

    const scriptName = advancedConfig
      ? "montage-advanced.js"
      : smartMode
        ? "montage-smart.js"
        : "montage.js";

    const scriptPath = path.join(workspaceRoot, "scripts", scriptName);
    const exportPath = path.join(
      workspaceRoot,
      "media",
      "export",
      "clip_final.mp4",
    );
    const thumbnailPath = path.join(
      workspaceRoot,
      "media",
      "export",
      "thumbnail.jpg",
    );
    const configPath = path.join(workspaceRoot, "media", "montage-config.json");
    const plansDir = path.join(workspaceRoot, "media", "plans");
    const audioPath = path.join(workspaceRoot, "media", "audio", "musique.mp3");

    await fs.mkdir(plansDir, { recursive: true });
    await fs.mkdir(path.dirname(exportPath), { recursive: true });

    if (isCloudStorageEnabled()) {
      const cloudPlans = (await listStorage("plans/")).filter((item) =>
        item.key.endsWith(".mp4"),
      );

      await Promise.all(
        cloudPlans.map(async (item) => {
          const fileBuffer = await readStorageBuffer(item.key);

          if (!fileBuffer) {
            return;
          }

          const fileName = path.basename(item.key);
          await fs.writeFile(path.join(plansDir, fileName), fileBuffer);
        }),
      );
    }

    const planFiles = (await fs.readdir(plansDir))
      .filter((file) => file.endsWith(".mp4"))
      .sort();

    if (planFiles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun plan mp4 disponible dans media/plans.",
        },
        { status: 400 },
      );
    }

    // Mode avancé : écrire la config et vérifier les fichiers audio déclarés
    if (advancedConfig) {
      // Compléter les clips avec les fichiers disponibles si liste vide
      if (!advancedConfig.clips || advancedConfig.clips.length === 0) {
        advancedConfig.clips = planFiles.map((f) => ({ file: f }));
      }
      // Assurer un chemin audio par défaut
      if (!advancedConfig.audio) {
        advancedConfig.audio = { musique: "media/audio/musique.mp3" };
      }
      // Écrire le fichier de configuration
      await fs.writeFile(
        configPath,
        JSON.stringify(advancedConfig, null, 2),
        "utf8",
      );
    } else {
      // Mode simple : vérifier que l'audio existe
      try {
        await fs.access(audioPath);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: "Le fichier audio media/audio/musique.mp3 est introuvable.",
          },
          { status: 400 },
        );
      }
    }

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath],
      {
        cwd: workspaceRoot,
        windowsHide: true,
      },
    );

    const stats = await fs.stat(exportPath);

    // Vérifier si un thumbnail a été généré
    let thumbnailUrl: string | null = null;
    try {
      await fs.access(thumbnailPath);

      if (isCloudStorageEnabled()) {
        const thumbnailBuffer = await fs.readFile(thumbnailPath);
        const storedThumbnail = await putStorageBuffer(
          "export/thumbnail.jpg",
          thumbnailBuffer,
          { contentType: "image/jpeg" },
        );
        thumbnailUrl = toClientFileRef(
          "export/thumbnail.jpg",
          storedThumbnail.url,
        );
      } else {
        thumbnailUrl = "/api/thumbnail";
      }
    } catch {
      // Pas de thumbnail
    }

    let sortie = "media/export/clip_final.mp4";

    if (isCloudStorageEnabled()) {
      const exportBuffer = await fs.readFile(exportPath);
      const storedVideo = await putStorageBuffer(
        "export/clip_final.mp4",
        exportBuffer,
        {
          contentType: "video/mp4",
        },
      );
      sortie = toClientFileRef("export/clip_final.mp4", storedVideo.url);
    }

    return NextResponse.json({
      success: true,
      result: {
        sortie,
        tailleOctets: stats.size,
        plansUtilises: advancedConfig
          ? advancedConfig.clips.map((c) => c.file)
          : planFiles,
        logs: [stdout, stderr].filter(Boolean).join("\n").trim(),
        thumbnailUrl,
        mode: advancedConfig ? "advanced" : smartMode ? "smart" : "simple",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur de montage inconnue.";

    return NextResponse.json(
      {
        success: false,
        error: `Erreur lors du montage MP4 : ${message}`,
      },
      { status: 500 },
    );
  }
}
