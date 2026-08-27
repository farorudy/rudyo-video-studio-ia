import path from "node:path";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: message }, { status: message === "Authentification requise." ? 401 : 400 });
  }
}
