import { NextRequest, NextResponse } from "next/server";
import {
  putStorageBuffer,
  putStorageText,
  toClientFileRef,
} from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";

type ClipPrompt = {
  id: number;
  nom: string;
  duree: string;
  description: string;
  promptVideo: string;
  promptImage: string;
};

type GenerateVideosRequest = {
  titre?: string;
  clips?: ClipPrompt[];
};

type GenerationJob = {
  clipId: number;
  clipName: string;
  status: string;
  provider: string;
  savedTo?: string;
  outputUrl?: string;
  webUrl?: string;
  getUrl?: string;
  predictionId?: string;
  error?: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

function sanitizeFileStem(value: string) {
  return slugify(value) || `clip-${Date.now()}`;
}

function firstOutputUrl(output: unknown) {
  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    const firstString = output.find((item) => typeof item === "string");

    if (typeof firstString === "string") {
      return firstString;
    }
  }

  return undefined;
}

async function fetchRemoteVideo(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Téléchargement vidéo impossible (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    const body = (await req.json()) as GenerateVideosRequest;
    const clips = body.clips ?? [];

    if (clips.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun clip à générer.",
        },
        { status: 400 },
      );
    }

    const token = process.env.REPLICATE_API_TOKEN;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ajoutez REPLICATE_API_TOKEN dans .env.local pour lancer la génération vidéo automatique.",
        },
        { status: 400 },
      );
    }

    const model =
      process.env.REPLICATE_VIDEO_MODEL || "bytedance/seedance-1-pro";
    const [owner, name] = model.split("/");

    if (!owner || !name) {
      return NextResponse.json(
        {
          success: false,
          error:
            "REPLICATE_VIDEO_MODEL doit être au format owner/model, par exemple bytedance/seedance-1-pro.",
        },
        { status: 400 },
      );
    }

    const jobs = await Promise.all(
      clips.map(async (clip) => {
        try {
          const response = await fetch(
            `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Prefer: "wait=15",
                "Cancel-After": "10m",
              },
              body: JSON.stringify({
                input: {
                  prompt: clip.promptVideo,
                },
              }),
            },
          );

          const prediction = (await response.json()) as {
            id?: string;
            status?: string;
            error?: string;
            output?: unknown;
            urls?: {
              web?: string;
              get?: string;
            };
          };

          if (!response.ok) {
            throw new Error(
              prediction.error || `Erreur Replicate (${response.status}).`,
            );
          }

          const outputUrl = firstOutputUrl(prediction.output);
          let savedTo: string | undefined;

          if (outputUrl) {
            const fileName = `${sanitizeFileStem(clip.nom)}.mp4`;
            const videoBuffer = await fetchRemoteVideo(outputUrl);
            const storageKey = `plans/${user.id}/${fileName}`;
            const stored = await putStorageBuffer(
              storageKey,
              videoBuffer,
              {
                contentType: "video/mp4",
              },
            );
            savedTo = toClientFileRef(storageKey, stored.url);
          }

          return {
            clipId: clip.id,
            clipName: clip.nom,
            status: prediction.status || "unknown",
            provider: "replicate",
            savedTo,
            outputUrl,
            webUrl: prediction.urls?.web,
            getUrl: prediction.urls?.get,
            predictionId: prediction.id,
          } satisfies GenerationJob;
        } catch (error) {
          return {
            clipId: clip.id,
            clipName: clip.nom,
            status: "failed",
            provider: "replicate",
            error:
              error instanceof Error
                ? error.message
                : "Erreur inconnue lors de la génération.",
          } satisfies GenerationJob;
        }
      }),
    );

    const baseName = slugify(body.titre?.trim() || "clip-video");
    const manifestKey = `export/${user.id}/${baseName}-generation.json`;
    const manifestPayload = JSON.stringify(
      {
        provider: "replicate",
        model,
        createdAt: new Date().toISOString(),
        jobs,
      },
      null,
      2,
    );
    const manifestStored = await putStorageText(manifestKey, manifestPayload, {
      contentType: "application/json; charset=utf-8",
    });

    return NextResponse.json({
      success: true,
      result: {
        provider: "replicate",
        model,
        jobs,
        manifest: toClientFileRef(manifestKey, manifestStored.url),
      },
    });
  } catch (error) {
    console.error("Erreur génération vidéos :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors du lancement de la génération vidéo.",
      },
      { status: 500 },
    );
  }
}
