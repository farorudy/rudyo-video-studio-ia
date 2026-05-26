import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import {
  resolveDefaultAiProvider,
  resolveModelForProvider,
} from "@/lib/ai-provider";
import { isCloudStorageEnabled } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "warning" | "error";

function checkDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    return false;
  }

  try {
    const url = new URL(databaseUrl);
    return (
      ["postgresql:", "postgres:"].includes(url.protocol) &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function createCheck(name: string, status: CheckStatus, message: string) {
  return { name, status, message };
}

export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
  const localSession =
    process.env.USE_LOCAL_SESSION === "true" && !isProduction;
  const authSecretReady =
    (process.env.AUTH_COOKIE_SECRET?.trim() ?? "").length >= 32;
  const databaseReady = checkDatabaseUrl();
  const provider = resolveDefaultAiProvider();
  const model = resolveModelForProvider(provider);
  const mockStoryboard = process.env.USE_MOCK_STORYBOARD === "true";
  const ffmpegReady = existsSync(ffmpegInstaller.path) && existsSync(ffprobeInstaller.path);
  const localAudioReady = existsSync(
    path.join(process.cwd(), "media", "audio", "musique.mp3"),
  );
  const remoteAiReady =
    provider === "mistral"
      ? Boolean(process.env.MISTRAL_API_KEY)
      : provider === "openai"
        ? Boolean(process.env.OPENAI_API_KEY)
        : true;

  const checks = [
    createCheck(
      "app",
      "ok",
      `Rudyo Video Studio répond en mode ${
        isProduction ? "production" : "développement"
      }.`,
    ),
    createCheck(
      "session",
      authSecretReady ? "ok" : "error",
      authSecretReady
        ? localSession
          ? "Session locale activée pour les tests."
          : "Secret de session configuré."
        : "AUTH_COOKIE_SECRET est manquant ou trop court.",
    ),
    createCheck(
      "database",
      localSession || databaseReady ? "ok" : "warning",
      localSession
        ? "PostgreSQL contourne en mode session locale."
        : databaseReady
          ? "DATABASE_URL semble configuré."
          : "DATABASE_URL absent : utilisez npm run dev:local ou configurez PostgreSQL.",
    ),
    createCheck(
      "storage",
      "ok",
      isCloudStorageEnabled()
        ? "Stockage cloud Vercel Blob activé."
        : "Stockage local dans media/*.",
    ),
    createCheck(
      "video",
      ffmpegReady ? "ok" : "error",
      ffmpegReady
        ? localAudioReady
          ? "FFmpeg prêt, musique locale détectée."
          : "FFmpeg prêt, vidéo générée sans musique locale."
        : "FFmpeg ou ffprobe introuvable.",
    ),
    createCheck(
      "storyboard",
      mockStoryboard || Boolean(process.env.OPENAI_API_KEY) ? "ok" : "warning",
      mockStoryboard
        ? "Storyboard démo activé."
        : process.env.OPENAI_API_KEY
          ? "Storyboard OpenAI configuré."
          : "Storyboard sans clé OpenAI: activez USE_MOCK_STORYBOARD=true pour tester.",
    ),
    createCheck(
      "ai",
      remoteAiReady ? "ok" : "warning",
      remoteAiReady
        ? `IA configurée: ${provider} / ${model}.`
        : `Fournisseur ${provider} sélectionné, mais clé API absente.`,
    ),
  ];

  const ok = checks.every((check) => check.status !== "error");

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
