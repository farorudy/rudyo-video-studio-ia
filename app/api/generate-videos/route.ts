import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  putStorageBuffer,
  putStorageText,
  toClientFileRef,
} from "@/lib/storage";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import {
  confirmCreditUsage,
  logAiUsage,
  refundCreditUsage,
  reserveCredits,
} from "@/lib/credit-utils";
import { CREDIT_COSTS } from "@/lib/credit-costs";

export const runtime = "nodejs";

const DEFAULT_BYTEPLUS_BASE_URL =
  "https://ark.ap-southeast.bytepluses.com/api/v3";
const DEFAULT_BYTEPLUS_MODEL = "dreamina-seedance-2-0-260128";
const TERMINAL_FAILURE_STATUSES = new Set([
  "failed",
  "cancelled",
  "expired",
]);

type ClipPrompt = {
  id: number;
  nom: string;
  duree: string;
  description: string;
  promptVideo: string;
  promptImage?: string;
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

type BytePlusTask = {
  id?: string;
  model?: string;
  status?: string;
  content?: { video_url?: string };
  error?: { code?: string; message?: string };
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

function safeClipName(value: string, clipId: number) {
  return slugify(value) || `plan-${clipId}`;
}

function parseClipDuration(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed)
    ? Math.min(15, Math.max(2, Math.round(parsed)))
    : 5;
}

function bytePlusBaseUrl() {
  return (
    process.env.BYTEPLUS_BASE_URL?.trim().replace(/\/$/, "") ||
    DEFAULT_BYTEPLUS_BASE_URL
  );
}

function bytePlusError(task: BytePlusTask, fallback: string) {
  return task.error?.message || task.error?.code || fallback;
}

async function bytePlusRequest(pathname: string, init?: RequestInit) {
  const apiKey = process.env.ARK_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("ARK_API_KEY n'est pas configurée.");
  }

  const response = await fetch(`${bytePlusBaseUrl()}${pathname}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const task = (await response.json()) as BytePlusTask;

  if (!response.ok) {
    throw new Error(bytePlusError(task, `Erreur BytePlus (${response.status}).`));
  }

  return task;
}

async function fetchRemoteVideo(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Téléchargement vidéo impossible (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function trackingPayload(params: {
  userId: string;
  taskId: string;
  reservationId: string;
  clipId: number;
  clipName: string;
}) {
  return [
    params.userId,
    params.taskId,
    params.reservationId,
    params.clipId,
    params.clipName,
  ].join(":");
}

function signTrackingPayload(payload: string) {
  const secret = process.env.AUTH_COOKIE_SECRET?.trim();

  if (!secret) {
    throw new Error("AUTH_COOKIE_SECRET n'est pas configuré.");
  }

  return createHmac("sha256", secret).update(payload).digest("hex");
}

function isValidTrackingSignature(payload: string, signature: string) {
  const expected = Buffer.from(signTrackingPayload(payload), "hex");
  const received = Buffer.from(signature, "hex");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

function createTrackingUrl(params: {
  user: SessionUser;
  taskId: string;
  reservationId: string;
  clip: ClipPrompt;
}) {
  const payload = trackingPayload({
    userId: params.user.id,
    taskId: params.taskId,
    reservationId: params.reservationId,
    clipId: params.clip.id,
    clipName: params.clip.nom,
  });
  const query = new URLSearchParams({
    taskId: params.taskId,
    reservationId: params.reservationId,
    clipId: String(params.clip.id),
    clipName: params.clip.nom,
    signature: signTrackingPayload(payload),
  });

  return `/api/generate-videos?${query.toString()}`;
}

async function createBytePlusTask(clip: ClipPrompt, model: string) {
  return bytePlusRequest("/contents/generations/tasks", {
    method: "POST",
    body: JSON.stringify({
      model,
      content: [{ type: "text", text: clip.promptVideo }],
      resolution: process.env.BYTEPLUS_VIDEO_RESOLUTION?.trim() || "720p",
      ratio: process.env.BYTEPLUS_VIDEO_RATIO?.trim() || "16:9",
      duration: parseClipDuration(clip.duree),
      generate_audio: process.env.BYTEPLUS_GENERATE_AUDIO === "true",
      watermark: process.env.BYTEPLUS_WATERMARK === "true",
    }),
  });
}

async function createChargedBytePlusJob(
  user: SessionUser,
  clip: ClipPrompt,
  model: string,
) {
  const reservation = await reserveCredits({
    userId: user.id,
    action: "seedance_video",
    amount: CREDIT_COSTS.seedance_video,
    description: `Génération Seedance : ${clip.nom}`,
    metadata: { clipId: clip.id, model },
  });

  try {
    const task = await createBytePlusTask(clip, model);

    if (!task.id) {
      throw new Error("BytePlus n'a pas retourné d'identifiant de tâche.");
    }

    await confirmCreditUsage(reservation.id);
    await logAiUsage({
      userId: user.id,
      provider: "byteplus",
      model,
      action: "seedance_video",
      creditsCharged: CREDIT_COSTS.seedance_video,
    });

    return {
      clipId: clip.id,
      clipName: clip.nom,
      status: task.status || "queued",
      provider: "byteplus",
      predictionId: task.id,
      getUrl: createTrackingUrl({
        user,
        taskId: task.id,
        reservationId: reservation.id,
        clip,
      }),
    } satisfies GenerationJob;
  } catch (error) {
    await refundCreditUsage(reservation.id).catch(() => undefined);
    return {
      clipId: clip.id,
      clipName: clip.nom,
      status: "failed",
      provider: "byteplus",
      error:
        error instanceof Error
          ? error.message
          : "Erreur inconnue lors de la création de la tâche BytePlus.",
    } satisfies GenerationJob;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    const taskId = req.nextUrl.searchParams.get("taskId")?.trim() || "";
    const reservationId =
      req.nextUrl.searchParams.get("reservationId")?.trim() || "";
    const clipName = req.nextUrl.searchParams.get("clipName")?.trim() || "Plan";
    const clipId = Number.parseInt(
      req.nextUrl.searchParams.get("clipId") || "0",
      10,
    );
    const signature =
      req.nextUrl.searchParams.get("signature")?.trim() || "";

    if (!/^[a-zA-Z0-9_-]{5,200}$/.test(taskId) || !reservationId) {
      return NextResponse.json(
        { success: false, error: "Identifiant de tâche BytePlus invalide." },
        { status: 400 },
      );
    }

    const payload = trackingPayload({
      userId: user.id,
      taskId,
      reservationId,
      clipId,
      clipName,
    });

    if (!isValidTrackingSignature(payload, signature)) {
      return NextResponse.json(
        { success: false, error: "Signature de suivi invalide." },
        { status: 403 },
      );
    }

    const task = await bytePlusRequest(
      `/contents/generations/tasks/${encodeURIComponent(taskId)}`,
    );
    const outputUrl = task.content?.video_url;
    const succeededWithoutVideo = task.status === "succeeded" && !outputUrl;
    const failed =
      succeededWithoutVideo ||
      TERMINAL_FAILURE_STATUSES.has(task.status || "");
    let savedTo: string | undefined;

    if (task.status === "succeeded" && outputUrl) {
      const storageKey = `plans/${user.id}/${safeClipName(clipName, clipId)}.mp4`;
      const stored = await putStorageBuffer(
        storageKey,
        await fetchRemoteVideo(outputUrl),
        { contentType: "video/mp4" },
      );
      savedTo = toClientFileRef(storageKey, stored.url);
    } else if (failed) {
      await refundCreditUsage(reservationId).catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      job: {
        clipId,
        clipName,
        status: failed ? "failed" : task.status || "unknown",
        provider: "byteplus",
        savedTo,
        outputUrl,
        predictionId: task.id || taskId,
        getUrl: req.nextUrl.pathname + req.nextUrl.search,
        error: succeededWithoutVideo
          ? "BytePlus a terminé la tâche sans retourner de vidéo."
          : failed
            ? bytePlusError(task, "La génération BytePlus a échoué.")
            : undefined,
      } satisfies GenerationJob,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Impossible de suivre la tâche BytePlus.",
      },
      { status: 502 },
    );
  }
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

    if (!process.env.ARK_API_KEY?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "ARK_API_KEY n'est pas configurée sur le serveur.",
        },
        { status: 503 },
      );
    }

    const body = (await req.json()) as GenerateVideosRequest;
    const clips = body.clips ?? [];

    if (clips.length === 0 || clips.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: "La génération accepte entre 1 et 10 clips à la fois.",
        },
        { status: 400 },
      );
    }

    const model =
      process.env.BYTEPLUS_VIDEO_MODEL?.trim() || DEFAULT_BYTEPLUS_MODEL;
    const jobs: GenerationJob[] = [];

    for (const clip of clips) {
      jobs.push(await createChargedBytePlusJob(user, clip, model));
    }

    const baseName = slugify(body.titre?.trim() || "clip-video");
    const manifestKey = `export/${user.id}/${baseName}-generation.json`;
    const manifestStored = await putStorageText(
      manifestKey,
      JSON.stringify(
        { provider: "byteplus", model, createdAt: new Date().toISOString(), jobs },
        null,
        2,
      ),
      { contentType: "application/json; charset=utf-8" },
    );

    return NextResponse.json({
      success: true,
      result: {
        provider: "byteplus",
        model,
        jobs,
        manifest: toClientFileRef(manifestKey, manifestStored.url),
      },
    });
  } catch (error) {
    console.error("Erreur génération vidéos :", error);

    if (error instanceof Error && error.message === "CREDITS_INSUFFICIENTS") {
      return NextResponse.json(
        {
          success: false,
          error: "Crédits insuffisants pour générer cette vidéo Seedance.",
          redirectTo: "/credits",
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors du lancement de la génération vidéo.",
      },
      { status: 500 },
    );
  }
}
