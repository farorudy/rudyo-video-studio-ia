import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import {
  resolveDefaultAiProvider,
  resolveModelForProvider,
} from "@/lib/ai-provider";
import { getStorageHealth, type StorageHealthStatus } from "@/lib/server/private-storage";

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

/**
 * Convertit un statut de santé de stockage en message utilisateur
 */
function getStorageMessage(health: StorageHealthStatus): string {
  if (health.available) {
    return "Stockage cloud Vercel Blob activé.";
  }
  
  switch (health.code) {
    case 'NOT_CONFIGURED':
      return "Stockage cloud non configuré : BLOB_READ_WRITE_TOKEN manquant. Utilisation du stockage local.";
    case 'STORE_SUSPENDED':
      return "Stockage cloud temporairement suspendu. Utilisation du stockage local.";
    case 'AUTHENTICATION_FAILED':
      return "Authentification du stockage cloud échouée. Utilisation du stockage local.";
    case 'QUOTA_EXCEEDED':
      return "Quota du stockage cloud dépassé. Utilisation du stockage local.";
    case 'UNREACHABLE':
      return "Stockage cloud inaccessible. Utilisation du stockage local.";
    case 'UNKNOWN':
    default:
      return health.error ? `Stockage cloud indisponible : ${health.error}` : "Stockage cloud indisponible. Utilisation du stockage local.";
  }
}

export async function GET() {
  const isProduction = process.env.NODE_ENV === "production";
  const localSession =
    process.env.USE_LOCAL_SESSION === "true" && !isProduction;
  const authSecretReady =
    (process.env.AUTH_SECRET?.trim() || process.env.AUTH_COOKIE_SECRET?.trim() || "").length >= 32;
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

  // Contrôle de santé du stockage
  let storageHealth: StorageHealthStatus;
  try {
    storageHealth = await getStorageHealth();
  } catch (error) {
    // Si le contrôle échoue complètement, considérer comme UNKNOWN
    storageHealth = { available: false, code: 'UNKNOWN', error: String(error) };
  }

  const storageStatus: CheckStatus = storageHealth.available ? "ok" : storageHealth.code === "NOT_CONFIGURED" ? "warning" : "error";
  const storageMessage = getStorageMessage(storageHealth);

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
        : "AUTH_SECRET est manquant ou trop court.",
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
      storageStatus,
      storageMessage,
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
