import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { probeAudioBuffer } from "@/lib/audio-probe";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { readFormDataWithLimit, sniffMime } from "@/lib/request-security";
import { CLIP_OFFER, getClipAuthorization, getClipEconomics, quoteClip } from "@/lib/tiktok-offer";
import { type AutomaticClipPlanCode } from "@/lib/clip-pricing";

export const runtime = "nodejs";
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let durationSeconds: number, codec = "browser-metadata", sampleRate: number | null = null, channels: number | null = null;
    let start: number, selectedPlan: string;
    if (contentType.includes("application/json")) {
      const body = await request.json() as { audioDurationSeconds?: number; audioStartSeconds?: number; plan?: string };
      durationSeconds = Number(body.audioDurationSeconds);
      start = Number(body.audioStartSeconds || 0);
      selectedPlan = String(body.plan || "TIKTOK");
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 24 * 60 * 60) {
        return NextResponse.json({ error: "La durée de la musique n’a pas pu être vérifiée." }, { status: 400 });
      }
    } else {
      const form = await readFormDataWithLimit(request, MAX_AUDIO_BYTES + 1024 * 1024);
      const audio = form.get("audio");
      start = Number(form.get("audioStartSeconds") || 0);
      selectedPlan = String(form.get("plan") || "TIKTOK");
      if (!(audio instanceof File) || audio.size <= 0 || audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Choisissez une musique MP3, WAV ou M4A valide." }, { status: 400 });
      const buffer = Buffer.from(await audio.arrayBuffer()), mime = sniffMime(buffer);
      if (!mime || !["audio/mpeg", "audio/wav", "video/mp4"].includes(mime)) return NextResponse.json({ error: "Le contenu du fichier audio n’est pas autorisé." }, { status: 400 });
      const extension = audio.name.split(".").pop() || "audio";
      const probe = await probeAudioBuffer(buffer, extension);
      durationSeconds = probe.durationSeconds;
      codec = probe.codec || "unknown";
      sampleRate = probe.sampleRate;
      channels = probe.channels;
    }
    if (!(["TIKTOK", "LONG", "PREMIUM"] as string[]).includes(selectedPlan)) return NextResponse.json({ error: "Choisissez une formule valide." }, { status: 400 });
    const [user, worker] = await Promise.all([getCurrentUser(request), getMontageServiceStatus()]);
    const plan = selectedPlan as AutomaticClipPlanCode;
    const quote = quoteClip(durationSeconds, start, plan), economics = getClipEconomics(quote.billableDurationSeconds, plan), balance = user && !user.localSession ? user.creditsRemaining : null;
    return NextResponse.json({ success: true, ...quote, ...getClipAuthorization(quote.totalCredits, balance, worker.paidGenerationAllowed, economics.enabled, quote.supported, quote.fitsSelectedPlan), workerState: worker.state, workerWaking: worker.waking, balance, codec, sampleRate, channels, maxSupportedSeconds: CLIP_OFFER.maxDurationSeconds,
      // État réel de la porte de facturation : « joignable » ne vaut pas « facturable ».
      paidGenerationAllowed: worker.paidGenerationAllowed,
      paidGenerationRefusal: worker.paidGenerationRefusal,
      workerMode: worker.workerMode,
      providerReady: worker.providerReady,
      economics: { enabled: economics.enabled, marginEur: economics.marginEur } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Automatic clip quote failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "La durée de la musique n’a pas pu être vérifiée." }, { status: 400 });
  }
}
