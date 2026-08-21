import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { requireCredits } from "@/lib/credit-utils";
import { generateStoryboard, type StoryboardGenerateRequest } from "@/lib/ai/generate";
import {
  beginIdempotentRequest,
  enforceApiRateLimit,
  finishIdempotentRequest,
  readJsonWithLimit,
  requireIdempotencyKey,
  withTimeout,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  mode: z.enum(["creative", "expert", "sovereign"]),
  contentType: z.enum(["storyboard", "script", "prompt", "project"]),
  topic: z.string().trim().min(2).max(500),
  objective: z.string().trim().max(2_000).optional(),
  targetAudience: z.string().trim().max(500).optional(),
  duration: z.number().int().min(5).max(3_600).optional(),
  format: z.enum(["vertical", "horizontal", "square"]).optional(),
  style: z.string().trim().max(200).optional(),
  tone: z.string().trim().max(200).optional(),
  customInstructions: z.string().trim().max(2_000).optional(),
}).strict();

export async function POST(request: NextRequest) {
  let idempotencyId: string | null = null;
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ error: "Authentification vérifiée requise." }, { status: 401 });
    await enforceApiRateLimit(request, "ai-storyboard", user.id, 5, 60_000);
    await requireCredits(user.id, 1);
    const key = requireIdempotencyKey(request);
    const idempotency = await beginIdempotentRequest("ai-storyboard", user.id, key);
    idempotencyId = idempotency.record.id;
    if (!idempotency.fresh) {
      if (idempotency.record.responseCode && idempotency.record.response) {
        return NextResponse.json(idempotency.record.response, { status: idempotency.record.responseCode });
      }
      return NextResponse.json({ error: "Cette génération est déjà en cours." }, { status: 409 });
    }

    const parsed = schema.safeParse(await readJsonWithLimit<unknown>(request, 32 * 1024));
    if (!parsed.success) {
      const response = { error: "Paramètres de storyboard invalides." };
      await finishIdempotentRequest(idempotencyId, 400, response);
      return NextResponse.json(response, { status: 400 });
    }
    const result = await withTimeout(
      generateStoryboard(parsed.data as StoryboardGenerateRequest),
      55_000,
      "Le fournisseur IA a dépassé le délai autorisé.",
    );
    await finishIdempotentRequest(idempotencyId, 200, result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error && error.message === "CREDITS_INSUFFICIENTS"
      ? "Crédits insuffisants."
      : error instanceof Error && error.message.includes("Idempotency-Key")
        ? error.message
        : "La génération du storyboard a échoué.";
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 500, { error: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: message === "Crédits insuffisants." ? 402 : 400 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "API Storyboard Rudyo AI", method: "POST" });
}
