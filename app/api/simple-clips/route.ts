import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { probeAudioBuffer } from "@/lib/audio-probe";
import { enqueueAutomaticMontageIfReady } from "@/lib/montage/queue";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { prisma } from "@/lib/prisma";
import { deleteStorage, putStorageBuffer, toClientFileRef } from "@/lib/storage";
import { syncGenerationTask } from "@/lib/seedance/service";
import { signedDownloadUrl } from "@/lib/media-access";
import { startPreparedSimpleClip } from "@/lib/simple-clip-production";
import { beginIdempotentRequest, enforceApiRateLimit, finishIdempotentRequest, readFormDataWithLimit, requireIdempotencyKey, sniffMime } from "@/lib/request-security";
import { CLIP_OFFER, getClipAuthorization, getClipEconomics, quoteClip } from "@/lib/tiktok-offer";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 121 * 1024 * 1024;
const schema = z.object({ plan: z.enum(["TIKTOK", "LONG", "PREMIUM"]), idea: z.string().trim().min(10).max(3000), style: z.string().trim().max(120).optional(), audioStartSeconds: z.coerce.number().min(0).default(0), intent: z.enum(["generate", "prepare_only"]).default("generate") });
const safeName = (value: string) => path.basename(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);

function validateFile(file: File, kind: "photo" | "audio") {
  const maximum = kind === "photo" ? 20 * 1024 * 1024 : 100 * 1024 * 1024;
  if (file.size <= 0 || file.size > maximum) throw new Error(kind === "photo" ? "Choisissez une photo JPG, PNG ou WebP valide." : "Choisissez une musique MP3, WAV ou M4A valide.");
}

async function projects(userId: string) {
  return prisma.videoProject.findMany({ where: { userId, OR: [{ clipPlan: { not: null } }, { scenes: { some: { title: { startsWith: "Clip automatique" } } } }] }, orderBy: { createdAt: "desc" }, take: 100, include: { generationTasks: { orderBy: { createdAt: "desc" } }, finalExports: { orderBy: { createdAt: "desc" }, take: 1 }, montageJobs: { orderBy: { createdAt: "desc" }, take: 1 } } });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  let rows = await projects(user.id);
  const active = rows.flatMap((project) => project.generationTasks).filter((task) => ["SUBMITTED", "PROCESSING"].includes(task.status)).slice(0, 20);
  if (active.length) { await Promise.all(active.map((task) => syncGenerationTask(task.id, user.id).catch(() => null))); rows = await projects(user.id); }
  for (const project of rows.slice(0, 10)) {
    const tasks = project.generationTasks;
    if (tasks.length && tasks.every((task) => task.status === "SUCCEEDED" && task.permanentVideoUrl) && project.montageJobs.length === 0) await enqueueAutomaticMontageIfReady(project.id, user.id).catch(() => null);
  }
  rows = await projects(user.id);
  const creations = rows.map((project) => {
    const finalExport = project.finalExports[0], montage = project.montageJobs[0], tasks = project.generationTasks;
    const failed = tasks.some((task) => ["FAILED", "CANCELLED", "REFUNDED"].includes(task.status)) || ["FAILED", "REFUNDED"].includes(montage?.status || "") || finalExport?.status === "FAILED";
    const completed = finalExport?.status === "COMPLETED";
    return { id: project.id, title: project.title, createdAt: project.createdAt, status: project.status === "DRAFT" ? "Brouillon — en attente de confirmation" : failed ? "Échec" : completed ? "Prêt" : montage ? "Montage sur votre musique" : "Génération des scènes", cost: project.maxBudgetCredits || 0, downloadUrl: completed ? signedDownloadUrl(finalExport.id) : null };
  });
  return NextResponse.json({ success: true, creations }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  let idempotencyId: string | null = null, projectId: string | null = null, preparedProject = false;
  const uploadedKeys: string[] = [];
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ error: "Connectez-vous pour générer votre clip." }, { status: 401 });
    await enforceApiRateLimit(request, "simple-clip", user.id, 2, 10 * 60_000);
    const worker = await getMontageServiceStatus();
    if (!worker.available) return NextResponse.json({ code: "WORKER_UNAVAILABLE", error: "Le service de création est momentanément indisponible. Aucun crédit ne sera débité." }, { status: 503 });
    const key = requireIdempotencyKey(request), idem = await beginIdempotentRequest("simple-clip", user.id, key); idempotencyId = idem.record.id;
    if (!idem.fresh) return idem.record.responseCode && idem.record.response ? NextResponse.json(idem.record.response, { status: idem.record.responseCode }) : NextResponse.json({ error: "Ce clip est déjà en cours de création." }, { status: 409 });
    const form = await readFormDataWithLimit(request, MAX_REQUEST_BYTES), photo = form.get("photo"), audio = form.get("audio");
    if (!(photo instanceof File) || !(audio instanceof File)) throw new Error("Ajoutez votre photo et votre musique.");
    validateFile(photo, "photo"); validateFile(audio, "audio");
    const parsed = schema.parse({ plan: form.get("plan"), idea: form.get("idea"), style: String(form.get("style") || "") || undefined, audioStartSeconds: form.get("audioStartSeconds") || 0, intent: form.get("intent") || "generate" });
    const photoBuffer = Buffer.from(await photo.arrayBuffer()), audioBuffer = Buffer.from(await audio.arrayBuffer()), photoMime = sniffMime(photoBuffer), audioMime = sniffMime(audioBuffer);
    if (!photoMime?.startsWith("image/") || !audioMime || !["audio/mpeg", "audio/wav", "video/mp4"].includes(audioMime)) throw new Error("Les fichiers sélectionnés ne sont pas valides.");
    const audioProbe = await probeAudioBuffer(audioBuffer, audio.name.split(".").pop()), quote = quoteClip(audioProbe.durationSeconds, parsed.audioStartSeconds, parsed.plan), economics = getClipEconomics(quote.billableDurationSeconds, parsed.plan);
    if (!quote.supported) return NextResponse.json({ code: "DURATION_TOO_LONG", error: "Votre musique dépasse la durée maximale automatique de 7 minutes.", normalizedSeconds: quote.normalizedSeconds }, { status: 422 });
    if (!quote.fitsSelectedPlan) return NextResponse.json({ code: "PLAN_TOO_SHORT", error: "La musique dépasse la formule choisie.", normalizedSeconds: quote.normalizedSeconds, recommendedPlan: quote.recommendedPlan }, { status: 409 });
    if (!economics.enabled) return NextResponse.json({ code: "OFFER_PAUSED", error: `${quote.planName} est temporairement suspendue par le contrôle de rentabilité.` }, { status: 503 });
    const project = await prisma.videoProject.create({ data: { userId: user.id, title: `${quote.planName.replace("Formule ", "")} · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, artistName: user.name || "Artiste Rudyo", durationSeconds: quote.normalizedSeconds, billedDurationSeconds: quote.normalizedSeconds, audioStartSeconds: parsed.audioStartSeconds, finalFormat: CLIP_OFFER.ratio, summary: parsed.idea, visualStyle: parsed.style, clipPlan: quote.plan, colors: { tiktokClip: { audioProbe, normalizedSeconds: quote.normalizedSeconds, plan: quote.plan, truncated: false } }, maxBudgetCredits: quote.totalCredits, clientRevenueEur: economics.clientRevenueEur, estimatedProviderCostEur: economics.providerCostEur, estimatedMarginEur: economics.marginEur, status: "DRAFT", budgetLimit: { create: { projectCredits: quote.totalCredits } }, consentRecords: { create: { userId: user.id, personName: user.name || "Artiste", authorizationType: "image_artiste_importee", consentedAt: new Date(), notes: "Autorisation confirmée lors de la préparation du clip." } } } }); projectId = project.id;
    const photoId = crypto.randomUUID(), audioId = crypto.randomUUID(), photoKey = `users/${user.id}/projects/${project.id}/assets/${photoId}/${safeName(photo.name)}`, audioKey = `users/${user.id}/projects/${project.id}/assets/${audioId}/${safeName(audio.name)}`; uploadedKeys.push(photoKey, audioKey);
    await Promise.all([putStorageBuffer(photoKey, photoBuffer, { contentType: photoMime, access: "private" }), putStorageBuffer(audioKey, audioBuffer, { contentType: audioMime === "video/mp4" ? "audio/mp4" : audioMime, access: "private" })]);
    await prisma.mediaAsset.createMany({ data: [{ id: photoId, userId: user.id, projectId: project.id, type: "ARTIST_PORTRAIT", fileName: safeName(photo.name), storageKey: photoKey, url: toClientFileRef(photoKey), mimeType: photoMime, sizeBytes: photo.size, metadata: { automaticClip: true, plan: quote.plan } }, { id: audioId, userId: user.id, projectId: project.id, type: "AUDIO", fileName: safeName(audio.name), storageKey: audioKey, url: toClientFileRef(audioKey), mimeType: audioMime === "video/mp4" ? "audio/mp4" : audioMime, sizeBytes: audio.size, metadata: { automaticClip: true, plan: quote.plan, audioProbe, audioStartSeconds: parsed.audioStartSeconds, normalizedSeconds: quote.normalizedSeconds } }] });
    preparedProject = true;
    const authorization = getClipAuthorization(quote.totalCredits, user.creditsRemaining, worker.available, economics.enabled, quote.supported, quote.fitsSelectedPlan);
    if (parsed.intent === "prepare_only" || !authorization.allowed) {
      const response = { success: true, state: "draft", projectId: project.id, ...quote, ...authorization, requiresCheckout: authorization.missingCredits > 0 };
      const status = authorization.missingCredits > 0 ? 402 : 201;
      await finishIdempotentRequest(idem.record.id, status, response);
      return NextResponse.json(response, { status });
    }
    const started = await startPreparedSimpleClip({ projectId: project.id, userId: user.id });
    const response = { success: true, projectId: project.id, workerJobId: started.workerJob.id, workerWaking: started.dispatch?.waking ?? false, taskIds: started.tasks.map((task) => task.id), credits: quote.totalCredits, priceEur: quote.priceEur, durationSeconds: quote.normalizedSeconds, plan: quote.plan, truncated: false };
    await finishIdempotentRequest(idem.record.id, 202, response); return NextResponse.json(response, { status: 202 });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Vérifiez votre idée et le point de départ." : error instanceof Error ? error.message : "La création n’a pas pu démarrer.";
    if (projectId && !preparedProject) await prisma.videoProject.delete({ where: { id: projectId } }).catch(() => undefined);
    if (!preparedProject) await Promise.all(uploadedKeys.map((key) => deleteStorage(key).catch(() => false)));
    const response = { error: message, ...(preparedProject && projectId ? { projectId, state: "draft" as const } : {}) };
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 400, response).catch(() => undefined);
    console.error("Automatic clip creation failed", message); return NextResponse.json(response, { status: message.includes("crédit") || message === "INSUFFICIENT_CREDITS" ? 402 : 400 });
  }
}
