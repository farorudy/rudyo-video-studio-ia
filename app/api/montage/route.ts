import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { enqueueMontageJob } from "@/lib/montage/queue";
import {
  beginIdempotentRequest,
  enforceApiRateLimit,
  finishIdempotentRequest,
  readJsonWithLimit,
  requireIdempotencyKey,
} from "@/lib/request-security";

const schema = z.object({
  projectId: z.string().cuid(),
  format: z.enum(["mp4", "vertical", "square"]).default("mp4"),
  resolution: z.enum(["720p", "1080p"]).default("1080p"),
  transition: z.enum(["cut", "fade", "wipe"]).default("cut"),
}).strict();

export async function POST(request: NextRequest) {
  let idempotencyId: string | null = null;
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ error: "Authentification vérifiée requise." }, { status: 401 });
    await enforceApiRateLimit(request, "montage", user.id, 2, 10 * 60_000);
    const key = requireIdempotencyKey(request);
    const idempotency = await beginIdempotentRequest("montage", user.id, key);
    idempotencyId = idempotency.record.id;
    if (!idempotency.fresh) {
      if (idempotency.record.responseCode && idempotency.record.response) return NextResponse.json(idempotency.record.response, { status: idempotency.record.responseCode });
      return NextResponse.json({ error: "Ce montage est déjà en préparation." }, { status: 409 });
    }
    const parsed = schema.safeParse(await readJsonWithLimit<unknown>(request, 16 * 1024));
    if (!parsed.success) throw new Error("Paramètres de montage invalides.");
    const job = await enqueueMontageJob({
      projectId: parsed.data.projectId,
      userId: user.id,
      resolution: parsed.data.resolution,
      format: parsed.data.format === "vertical" ? "9:16" : parsed.data.format === "square" ? "1:1" : "16:9",
      transition: parsed.data.transition === "cut" ? "cut" : "crossfade",
    });
    const response = { success: true, status: job.status, exportId: job.finalExportId, jobId: job.id };
    await finishIdempotentRequest(idempotency.record.id, 202, response);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    const message = error instanceof Error && (error.message.includes("scène") || error.message.includes("invalides") || error.message.includes("introuvable"))
      ? error.message : "Impossible de préparer le montage.";
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 400, { error: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
