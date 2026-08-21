import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  beginIdempotentRequest,
  enforceApiRateLimit,
  finishIdempotentRequest,
  readJsonWithLimit,
  requireIdempotencyKey,
  withTimeout,
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
    const project = await prisma.videoProject.findFirst({
      where: { id: parsed.data.projectId, userId: user.id },
      include: { scenes: { include: { variants: { where: { selected: true }, take: 1 } }, orderBy: { order: "asc" } } },
    });
    if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    if (project.scenes.length === 0 || project.scenes.some((scene) => scene.variants.length !== 1)) {
      throw new Error("Chaque scène doit posséder une variante sélectionnée.");
    }
    const workerUrl = process.env.FINAL_RENDER_WORKER_URL;
    const workerToken = process.env.FINAL_RENDER_WORKER_TOKEN;
    if (!workerUrl || !workerToken) return NextResponse.json({ error: "Worker de montage non configuré." }, { status: 503 });
    const url = new URL(workerUrl);
    if (url.protocol !== "https:") throw new Error("URL du worker invalide.");
    const exportRecord = await prisma.finalExport.create({
      data: { projectId: project.id, status: "QUEUED", format: parsed.data.format, resolution: parsed.data.resolution, settings: { transition: parsed.data.transition, idempotencyKey: key } },
    });
    const workerResponse = await withTimeout(fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
      body: JSON.stringify({ exportId: exportRecord.id, projectId: project.id, userId: user.id }),
      cache: "no-store",
    }), 10_000);
    if (!workerResponse.ok) throw new Error("Le worker de montage a refusé la tâche.");
    const response = { success: true, status: "QUEUED", exportId: exportRecord.id };
    await finishIdempotentRequest(idempotency.record.id, 202, response);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    const message = error instanceof Error && (error.message.includes("scène") || error.message.includes("invalides"))
      ? error.message : "Impossible de préparer le montage.";
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 400, { error: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
