import { chooseSeedanceModel } from "@/lib/seedance/models";
import { buildTikTokScenes, CLIP_OFFER, getClipAuthorization, quoteClip } from "@/lib/tiktok-offer";

export const SIMPLE_CLIP_DURATION_SECONDS = CLIP_OFFER.maxDurationSeconds;
export type SimpleClipOptions = { ratio: "16:9" | "9:16" | "1:1"; quality: "standard" | "high"; style?: string; subtitles: boolean };

export function getSimpleClipAuthorization(totalCost: number, currentBalance: number | null, workerAvailable: boolean) { return getClipAuthorization(totalCost, currentBalance, workerAvailable); }

export function getSimpleClipQuote(_options: SimpleClipOptions, audioDurationSeconds = 15, audioStartSeconds = 0) {
  const commercial = quoteClip(audioDurationSeconds, audioStartSeconds);
  const model = chooseSeedanceModel({ requestedModelId: "auto", durationSeconds: Math.min(10, Math.max(4, Math.ceil(commercial.billableDurationSeconds))), referenceCount: 1 });
  if (!model?.modelId || !model.capabilities.resolutions.includes(CLIP_OFFER.generationResolution)) throw new Error("Aucun modèle Seedance 720p n’est disponible.");
  return { ...commercial, durationSeconds: commercial.billableDurationSeconds, resolution: CLIP_OFFER.resolution, generationResolution: CLIP_OFFER.generationResolution, ratio: CLIP_OFFER.ratio, model };
}

export function enrichSimpleClipPrompt(idea: string, style?: string) {
  const cleanIdea = idea.trim().replace(/\s+/g, " "), cleanStyle = style?.trim().replace(/\s+/g, " ");
  return [cleanIdea, cleanStyle ? `Direction visuelle : ${cleanStyle}.` : "", "Clip musical cinématographique cohérent, artiste reconnaissable d’un plan à l’autre, mouvements naturels, lumière soignée, narration claire.", "Synchroniser les changements visuels avec le rythme de la musique de référence. Cadrage professionnel, sans texte ni logo à l’image."].filter(Boolean).join(" ");
}

export { buildTikTokScenes };
