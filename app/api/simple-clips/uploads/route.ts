import path from "node:path";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disableCloudStorage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Vérifie si une erreur provient de Vercel Blob (store suspendu)
 */
function isVercelBlobSuspendedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errorObj = error as { message?: string; code?: string };
  const message = errorObj.message?.toLowerCase() || "";
  return (
    message.includes("this store has been suspended") ||
    message.includes("store has been suspended") ||
    message.includes("blob store suspended") ||
    errorObj.code === "FORBIDDEN"
  );
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "video/mp4"];

function safeName(value: string) {
  return path.basename(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser(request);
        if (!user || user.localSession) throw new Error("Authentification requise.");
        const payload = JSON.parse(clientPayload || "{}") as { kind?: "photo" | "audio"; fileName?: string };
        if (payload.kind !== "photo" && payload.kind !== "audio") throw new Error("Type de fichier invalide.");
        const expectedPrefix = `rudyo-video-studio/users/${user.id}/simple-clips/assets/`;
        const expectedName = safeName(payload.fileName || "");
        if (!expectedName || !pathname.startsWith(expectedPrefix) || !pathname.endsWith(`/${expectedName}`)) {
          throw new Error("Chemin d’upload invalide.");
        }
        return {
          allowedContentTypes: payload.kind === "photo" ? PHOTO_TYPES : AUDIO_TYPES,
          maximumSizeInBytes: payload.kind === "photo" ? 20 * 1024 * 1024 : 100 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60_000,
          tokenPayload: JSON.stringify({ userId: user.id, kind: payload.kind }),
        };
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload indisponible.";
    
    // Si c'est une erreur de suspension de Vercel Blob, désactiver le cloud storage
    // et retourner un message clair
    if (isVercelBlobSuspendedError(error)) {
      disableCloudStorage();
      return NextResponse.json(
        { 
          error: "Le stockage cloud Vercel Blob est actuellement suspendu. Votre fichier sera stocké localement pour cette session." 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: message },
      { status: message === "Authentification requise." ? 401 : 400 }
    );
  }
}
