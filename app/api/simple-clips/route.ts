import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { probeAudioBuffer } from "@/lib/audio-probe";
import { enqueueAutomaticMontageIfReady } from "@/lib/montage/queue";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { PAID_GENERATION_UNAVAILABLE_MESSAGE } from "@/lib/montage/paid-generation-gate";
import { PaidGenerationUnavailableError } from "@/lib/montage/paid-generation-error";
import { prisma } from "@/lib/prisma";
import { deleteStorage, putStorageBuffer, readStorageBuffer, storageKeyFromClientRef, toClientFileRef } from "@/lib/storage";
import { syncGenerationTask } from "@/lib/seedance/service";
import { signedDownloadUrl } from "@/lib/media-access";
import { startPreparedSimpleClip } from "@/lib/simple-clip-production";
import { beginIdempotentRequest, enforceApiRateLimit, finishIdempotentRequest, readFormDataWithLimit, requireIdempotencyKey, sniffMime } from "@/lib/request-security";
import { buildTikTokScenes, CLIP_OFFER, getClipAuthorization, getClipEconomics, quoteClip, validateClipScenario } from "@/lib/tiktok-offer";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 121 * 1024 * 1024;
const schema = z.object({ plan: z.enum(["TIKTOK", "LONG", "PREMIUM"]), idea: z.string().trim().min(10).max(3000), style: z.string().trim().max(120).optional(), audioStartSeconds: z.coerce.number().min(0).default(0), intent: z.enum(["generate", "prepare_only"]).default("generate") });
const blobSchema = z.object({ photoBlobUrl: z.string().url(), audioBlobUrl: z.string().url(), photoName: z.string().min(1).max(255), audioName: z.string().min(1).max(255) });
const safeName = (value: string) => path.basename(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);

function validateFileSize(size: number, kind: "photo" | "audio") {
  const maximum = kind === "photo" ? 20 * 1024 * 1024 : 100 * 1024 * 1024;
  if (size <= 0 || size > maximum) throw new Error(kind === "photo" ? "Choisissez une photo JPG, PNG ou WebP valide." : "Choisissez une musique MP3, WAV ou M4A valide.");
}

async function projects(userId: string) {
  return prisma.videoProject.findMany({ where: { userId, OR: [{ clipPlan: { not: null } }, { scenes: { some: { title: { startsWith: "Clip automatique" } } } }] }, orderBy: { createdAt: "desc" }, take: 100, include: { scenes: { orderBy: { order: "asc" } }, generationTasks: { orderBy: { createdAt: "desc" } }, finalExports: { orderBy: { createdAt: "desc" }, take: 1 }, montageJobs: { orderBy: { createdAt: "desc" }, take: 1 }, clipWorkerJobs: { orderBy: { createdAt: "desc" }, take: 1 } } });
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
    const finalExport = project.finalExports[0], montage = project.montageJobs[0], workerJob = project.clipWorkerJobs[0], tasks = project.generationTasks;
    const failed = tasks.some((task) => ["FAILED", "CANCELLED", "REFUNDED"].includes(task.status)) || ["FAILED", "REFUNDED"].includes(montage?.status || "") || ["FAILED", "REFUNDED"].includes(workerJob?.status || "") || finalExport?.status === "FAILED";
    let scenarioValid = false;
    try { validateClipScenario(project.scenes, project.billedDurationSeconds || project.durationSeconds || 0); scenarioValid = true; } catch { scenarioValid = false; }
    const completed = finalExport?.status === "COMPLETED" && scenarioValid;
    const progress = completed ? 100 : failed ? 100 : workerJob?.progress ?? montage?.progress ?? 0;
    return { id: project.id, title: project.title, createdAt: project.createdAt, status: project.status === "DRAFT" ? "Brouillon — en attente de confirmation" : failed ? "Échec" : completed ? "Prêt" : montage ? "Montage sur votre musique" : "Génération des scènes", error: workerJob?.errorMessage || null, progress, durationSeconds: project.billedDurationSeconds || project.durationSeconds || 0, sceneCount: project.scenes.length, scenarioValid, cost: project.maxBudgetCredits || 0, scenarioUrl: `/api/projects/${encodeURIComponent(project.id)}/scenario`, scenarioJsonUrl: `/api/projects/${encodeURIComponent(project.id)}/export?format=json`, scenarioPdfUrl: `/api/projects/${encodeURIComponent(project.id)}/export?format=pdf`, downloadUrl: completed ? signedDownloadUrl(finalExport.id) : null };
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
    const key = requireIdempotencyKey(request), idem = await beginIdempotentRequest("simple-clip", user.id, key); idempotencyId = idem.record.id;
    if (!idem.fresh) return idem.record.responseCode && idem.record.response ? NextResponse.json(idem.record.response, { status: idem.record.responseCode }) : NextResponse.json({ error: "Ce clip est déjà en cours de création." }, { status: 409 });
    const isJson = (request.headers.get("content-type") || "").includes("application/json");
    let parsed: z.infer<typeof schema>, photoBuffer: Buffer, audioBuffer: Buffer, photoName: string, audioName: string;
    let photoKey: string | null = null, audioKey: string | null = null, directBlobUpload = false;
    if (isJson) {
      const body = await request.json();
      parsed = schema.parse(body);
      const refs = blobSchema.parse(body);
      photoKey = storageKeyFromClientRef(refs.photoBlobUrl);
      audioKey = storageKeyFromClientRef(refs.audioBlobUrl);
      const expectedPrefix = `users/${user.id}/simple-clips/assets/`;
      if (!photoKey?.startsWith(expectedPrefix) || !audioKey?.startsWith(expectedPrefix) || photoKey === audioKey) throw new Error("Références de fichiers invalides.");
      const [storedPhoto, storedAudio] = await Promise.all([readStorageBuffer(photoKey), readStorageBuffer(audioKey)]);
      if (!storedPhoto || !storedAudio) throw new Error("Les fichiers importés sont introuvables.");
      photoBuffer = storedPhoto; audioBuffer = storedAudio; photoName = refs.photoName; audioName = refs.audioName;
      directBlobUpload = true;
      uploadedKeys.push(photoKey, audioKey);
    } else {
      const form = await readFormDataWithLimit(request, MAX_REQUEST_BYTES), photo = form.get("photo"), audio = form.get("audio");
      if (!(photo instanceof File) || !(audio instanceof File)) throw new Error("Ajoutez votre photo et votre musique.");
      parsed = schema.parse({ plan: form.get("plan"), idea: form.get("idea"), style: String(form.get("style") || "") || undefined, audioStartSeconds: form.get("audioStartSeconds") || 0, intent: form.get("intent") || "generate" });
      photoBuffer = Buffer.from(await photo.arrayBuffer()); audioBuffer = Buffer.from(await audio.arrayBuffer()); photoName = photo.name; audioName = audio.name;
    }
    validateFileSize(photoBuffer.byteLength, "photo"); validateFileSize(audioBuffer.byteLength, "audio");
    const photoMime = sniffMime(photoBuffer), audioMime = sniffMime(audioBuffer);
    if (!photoMime?.startsWith("image/") || !audioMime || !["audio/mpeg", "audio/wav", "video/mp4"].includes(audioMime)) throw new Error("Les fichiers sélectionnés ne sont pas valides.");
    const audioProbe = await probeAudioBuffer(audioBuffer, audioName.split(".").pop()), quote = quoteClip(audioProbe.durationSeconds, parsed.audioStartSeconds, parsed.plan), economics = getClipEconomics(quote.billableDurationSeconds, parsed.plan);
    const rejectBeforeProject = async (status: number, response: Record<string, unknown>) => {
      await Promise.all(uploadedKeys.map((storedKey) => deleteStorage(storedKey).catch(() => false)));
      uploadedKeys.length = 0;
      await finishIdempotentRequest(idem.record.id, status, response);
      return NextResponse.json(response, { status });
    };
    if (!quote.supported) return rejectBeforeProject(422, { code: "DURATION_TOO_LONG", error: "Votre musique dépasse la durée maximale automatique de 7 minutes.", normalizedSeconds: quote.normalizedSeconds });
    if (!quote.fitsSelectedPlan) return rejectBeforeProject(409, { code: "PLAN_TOO_SHORT", error: "La musique dépasse la formule choisie.", normalizedSeconds: quote.normalizedSeconds, recommendedPlan: quote.recommendedPlan });
    if (!economics.enabled && parsed.intent === "generate") return rejectBeforeProject(503, { code: "OFFER_PAUSED", error: `${quote.planName} est temporairement suspendue par le contrôle de rentabilité.` });
    const project = await prisma.videoProject.create({ data: { userId: user.id, title: `${quote.planName.replace("Formule ", "")} · ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`, artistName: user.name || "Artiste Rudyo", durationSeconds: quote.normalizedSeconds, billedDurationSeconds: quote.normalizedSeconds, audioStartSeconds: parsed.audioStartSeconds, finalFormat: CLIP_OFFER.ratio, summary: parsed.idea, visualStyle: parsed.style, clipPlan: quote.plan, colors: { tiktokClip: { audioProbe, normalizedSeconds: quote.normalizedSeconds, plan: quote.plan, truncated: false } }, maxBudgetCredits: quote.totalCredits, clientRevenueEur: economics.clientRevenueEur, estimatedProviderCostEur: economics.providerCostEur, estimatedMarginEur: economics.marginEur, status: "DRAFT", budgetLimit: { create: { projectCredits: quote.totalCredits } }, consentRecords: { create: { userId: user.id, personName: user.name || "Artiste", authorizationType: "image_artiste_importee", consentedAt: new Date(), notes: "Autorisation confirmée lors de la préparation du clip." } } } }); projectId = project.id;
    const photoId = crypto.randomUUID(), audioId = crypto.randomUUID();
    if (!directBlobUpload) {
      photoKey = `users/${user.id}/projects/${project.id}/assets/${photoId}/${safeName(photoName)}`;
      audioKey = `users/${user.id}/projects/${project.id}/assets/${audioId}/${safeName(audioName)}`;
      uploadedKeys.push(photoKey, audioKey);
      await Promise.all([putStorageBuffer(photoKey, photoBuffer, { contentType: photoMime, access: "private" }), putStorageBuffer(audioKey, audioBuffer, { contentType: audioMime === "video/mp4" ? "audio/mp4" : audioMime, access: "private" })]);
    }
    if (!photoKey || !audioKey) throw new Error("Références de stockage invalides.");
    await prisma.mediaAsset.createMany({ data: [{ id: photoId, userId: user.id, projectId: project.id, type: "ARTIST_PORTRAIT", fileName: safeName(photoName), storageKey: photoKey, url: toClientFileRef(photoKey), mimeType: photoMime, sizeBytes: photoBuffer.byteLength, metadata: { automaticClip: true, plan: quote.plan } }, { id: audioId, userId: user.id, projectId: project.id, type: "AUDIO", fileName: safeName(audioName), storageKey: audioKey, url: toClientFileRef(audioKey), mimeType: audioMime === "video/mp4" ? "audio/mp4" : audioMime, sizeBytes: audioBuffer.byteLength, metadata: { automaticClip: true, plan: quote.plan, audioProbe, audioStartSeconds: parsed.audioStartSeconds, normalizedSeconds: quote.normalizedSeconds } }] });
    const modelId = process.env.BYTEPLUS_VIDEO_MODEL || "dreamina-seedance-2-0-260128";
    const scenario = buildTikTokScenes(quote.normalizedSeconds, parsed.idea, parsed.style, photoKey);
    await prisma.storyboardScene.createMany({
      data: scenario.map((scene) => ({
        order: scene.order,
        title: scene.title,
        startTimeSeconds: scene.startTimeSeconds,
        endTimeSeconds: scene.endTimeSeconds,
        durationSeconds: scene.durationSeconds,
        prompt: scene.prompt,
        negativePrompt: scene.continuityNotes,
        mood: scene.lighting,
        location: scene.description,
        cameraMovement: scene.cameraMovement,
        projectId: project.id,
        modelId,
        resolution: CLIP_OFFER.generationResolution,
        ratio: CLIP_OFFER.ratio,
        generateAudio: false,
        watermark: false,
        status: "READY" as const,
      })),
    });
    preparedProject = true;
    const worker = await getMontageServiceStatus();
    const authorization = getClipAuthorization(quote.totalCredits, user.creditsRemaining, worker.paidGenerationAllowed, economics.enabled, quote.supported, quote.fitsSelectedPlan);
    if (parsed.intent === "prepare_only" || !authorization.allowed) {
      const response = { success: true, state: "draft", projectId: project.id, ...quote, ...authorization, scenarioSceneCount: scenario.length, requiresCheckout: authorization.missingCredits > 0 };
      const status = authorization.missingCredits > 0 ? 402 : parsed.intent === "generate" && !worker.paidGenerationAllowed ? 503 : 201;
      await finishIdempotentRequest(idem.record.id, status, response);
      return NextResponse.json(response, { status });
    }
    const started = await startPreparedSimpleClip({ projectId: project.id, userId: user.id });
    const response = { success: true, projectId: project.id, workerJobId: started.workerJob.id, workerWaking: started.dispatch?.waking ?? false, taskIds: started.tasks.map((task) => task.id), credits: quote.totalCredits, priceEur: quote.priceEur, durationSeconds: quote.normalizedSeconds, plan: quote.plan, truncated: false };
    await finishIdempotentRequest(idem.record.id, 202, response); return NextResponse.json(response, { status: 202 });
  } catch (error) {
    // Indisponibilité de la génération payante : 503, projet conservé, aucun débit.
    if (error instanceof PaidGenerationUnavailableError) {
      const response = { code: error.refusal, error: PAID_GENERATION_UNAVAILABLE_MESSAGE, ...(preparedProject && projectId ? { projectId, state: "draft" as const } : {}) };
      if (idempotencyId) await finishIdempotentRequest(idempotencyId, 503, response).catch(() => undefined);
      return NextResponse.json(response, { status: 503 });
    }
    const message = error instanceof z.ZodError ? "Vérifiez votre idée et le point de départ." : error instanceof Error ? error.message : "La création n’a pas pu démarrer.";
    if (projectId && !preparedProject) await prisma.videoProject.delete({ where: { id: projectId } }).catch(() => undefined);
    if (!preparedProject) await Promise.all(uploadedKeys.map((key) => deleteStorage(key).catch(() => false)));
    const response = { error: message, ...(preparedProject && projectId ? { projectId, state: "draft" as const } : {}) };
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, 400, response).catch(() => undefined);
    console.error("Automatic clip creation failed", message); return NextResponse.json(response, { status: message.includes("crédit") || message === "INSUFFICIENT_CREDITS" ? 402 : 400 });
  }
}
