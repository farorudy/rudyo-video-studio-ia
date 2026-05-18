import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  confirmCreditUsage,
  refundCreditUsage,
  reserveCredits,
} from "@/lib/credit-utils";
import type { StoryboardPlan, StoryboardResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StoryboardRequestBody = {
  titre?: string;
  typeVideo?: string;
  duree?: string;
  format?: string;
  style?: string;
  langue?: string;
  publicCible?: string;
  nombrePlans?: string;
  description?: string;
};

function sanitize(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getPlanCount(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return 5;
  }

  return Math.min(12, Math.max(3, parsed));
}

function createMockStoryboard(body: StoryboardRequestBody): StoryboardResult {
  const titre = sanitize(body.titre, "Bod lanme pa lwen");
  const typeVideo = sanitize(body.typeVideo, "Clip musical");
  const format = sanitize(body.format, "9:16 TikTok / Reels / Shorts");
  const style = sanitize(body.style, "cinematique moderne caribeen");
  const duree = sanitize(body.duree, "30 secondes");
  const description = sanitize(
    body.description,
    "Un clip musical romantique au bord de mer, entre pluie, soleil et espoir.",
  );
  const planCount = getPlanCount(body.nombrePlans);

  const prompts = [
    "Premium AI music video scene, opening intro synced to the first instrumental bars, modern Caribbean cinematic style, Guadeloupe beach after rain, wet sand reflections, soft sunrise, one consistent lead artist facing the ocean, slow dolly-in, realistic skin, natural wind, emotional zouk romance, clean 9:16 composition, high-end music video lighting, no text, no logo.",
    "Verse scene for an emotional zouk music video, the same lead artist walks slowly along the shoreline, subtle lip-sync feeling without exaggerated mouth movement, waves and tropical light matching a mid-tempo groove, handheld cinematic tracking shot, warm cyan and gold color grade, realistic Caribbean atmosphere, coherent wardrobe and location, no text.",
    "Chorus scene with higher musical energy, romantic hope after rain, sunlight breaking through clouds, the same lead artist turns toward camera with restrained emotion, smooth crane-like movement, ocean spray, cinematic lens flare, premium music video realism, rhythm-aware visual pacing, no text overlays.",
    "Lyrics visual moment, elegant animated words floating over ocean reflections, minimal typography, French and Creole romantic mood, soft particles, beat-synced movement, blue night and gold highlights, premium lyric video scene, readable but not cluttered, modern Caribbean visual identity.",
    "Outro scene, final wide shot on a Guadeloupe beach, the artist faces the horizon as the music resolves, slow pullback, sun returns after rain, hopeful emotional ending, cohesive color grade, cinematic realism, professional AI music video finish, no watermark, no distorted hands.",
  ];

  const storyboard: StoryboardPlan[] = Array.from(
    { length: planCount },
    (_, index) => ({
      plan: index + 1,
      titre_etape:
        index === 0
          ? "Intro visuelle et ambiance musicale"
          : index === planCount - 1
            ? "Outro emotionnelle et signature du clip"
            : `Sequence musicale ${index + 1}`,
      duree: `${Math.max(3, Math.round(30 / planCount))} secondes`,
      description:
        index === 0
          ? `Ouverture du clip: ${description}`
          : `Sequence ${index + 1} qui developpe l'emotion, le lieu et le rythme du projet.`,
      camera:
        index % 2 === 0
          ? "Travelling lent et stable vers le sujet"
          : "Plan rapproche avec profondeur de champ douce",
      texte_ecran:
        index === 3
          ? "Bod lanme pa lwen"
          : index === planCount - 1
            ? "Votre idee devient une video"
            : "",
      dialogue:
        typeVideo.toLowerCase().includes("clip")
          ? "Intention clip : laisser l'image raconter l'emotion, avec paroles visibles seulement sur les phrases fortes."
          : "Intention video : rendre le message clair, humain et immediatement comprehensible.",
      objectif_pedagogique:
        "Transformer le concept en scene exploitable avec une intention visuelle claire, un rythme lisible et une continuite artistique.",
      rythme_musical:
        index === 0
          ? "Intro / installation du theme"
          : index === planCount - 1
            ? "Outro / resolution emotionnelle"
            : "Couplet ou refrain selon l'energie du morceau",
      direction_artistique:
        "Identite coherente sur tout le clip: meme personnage, meme lieu, meme colorimetrie, mouvements camera sobres.",
      prompt_video_ia: prompts[index % prompts.length],
      negative_prompt:
        "low quality, blurry, distorted face, extra fingers, bad anatomy, random text, watermark, logo, flicker, inconsistent character, chaotic camera",
      transition:
        index === planCount - 1
          ? "Fondu final vers le logo Farozik"
          : "Fondu lumineux rythme par la musique",
      type_media: index === 3 ? "texte_anime" : "video_ia",
      statut: "prompt_pret",
    }),
  );

  return {
    titre,
    type_video: typeVideo,
    format,
    style,
    duree_totale: duree,
    resume: `Storyboard V1 genere en mode mock pour tester Rudyo sans consommer de credits OpenAI. Le projet transforme ${description.toLowerCase()} en clip pret a produire.`,
    storyboard,
  };
}

function buildPrompt(body: StoryboardRequestBody) {
  return `Tu es Rudyo Video Studio IA, un directeur artistique IA specialise en clips musicaux, lyrics videos, videos promotionnelles et videos de formation.

Objectif qualite:
- Produire un resultat comparable aux meilleurs generateurs de music video IA, mais avec une redaction plus professionnelle, plus coherente et plus exploitable.
- Ne cite jamais une marque concurrente dans la reponse.
- Pense comme un realisateur: structure musicale, continuite visuelle, rythme, personnages, lieux, camera, transitions, paroles, emotions.
- Chaque plan doit pouvoir etre copie directement dans Runway, Veo, Kling, Luma ou un autre generateur video IA.
- Les prompts video IA doivent decrire une vraie scene filmable, pas une idee vague.
- Evite les prompts generiques du type "beautiful cinematic scene". Donne sujet, action, lieu, lumiere, camera, emotion, rythme, style et contraintes de qualite.

Genere un storyboard video structure en JSON strict.

Contraintes:
- Reponds uniquement avec un JSON valide.
- Les prompts video IA doivent etre en anglais.
- Le reste peut etre en francais.
- Le champ storyboard doit contenir exactement ${getPlanCount(body.nombrePlans)} plans.
- Si le projet contient des paroles ou une chanson, decoupe mentalement en intro, couplet, refrain, pont, outro.
- Si aucune musique n'est fournie, cree une structure musicale plausible adaptee a la duree.
- Garde une continuite visuelle: memes personnages, meme univers, meme palette, meme niveau de realisme.
- Ajoute une ligne de dialogue ou d'intention si utile; pour un clip musical, le dialogue peut etre une intention de jeu ou de lyrics.
- type_media doit etre l'une de ces valeurs: video_ia, image, tournage_reel, texte_anime.
- statut doit etre l'une de ces valeurs: a_creer, prompt_pret, media_ajoute, valide.

Schema attendu:
{
  "titre": "string",
  "type_video": "string",
  "format": "string",
  "style": "string",
  "duree_totale": "string",
  "resume": "string",
  "storyboard": [
    {
      "plan": 1,
      "titre_etape": "string",
      "duree": "string",
      "description": "string",
      "camera": "string",
      "texte_ecran": "string",
      "dialogue": "string",
      "objectif_pedagogique": "string",
      "rythme_musical": "string",
      "direction_artistique": "string",
      "prompt_video_ia": "English video generation prompt",
      "negative_prompt": "English negative prompt",
      "transition": "string",
      "type_media": "video_ia",
      "statut": "prompt_pret"
    }
  ]
}

Projet:
Titre: ${sanitize(body.titre, "Sans titre")}
Type video: ${sanitize(body.typeVideo, "Video creative")}
Duree: ${sanitize(body.duree, "30 secondes")}
Format: ${sanitize(body.format, "9:16")}
Style: ${sanitize(body.style, "cinematique moderne")}
Langue: ${sanitize(body.langue, "francais")}
Public cible: ${sanitize(body.publicCible, "public general")}
Description: ${sanitize(body.description, "Concept video a developper")}`;
}

function defaultNegativePrompt(value: unknown) {
  const current = sanitize(value);
  return (
    current ||
    "low quality, blurry, distorted face, bad anatomy, extra fingers, random text, watermark, logo, flicker, inconsistent character, inconsistent wardrobe, chaotic camera, poor lighting"
  );
}

function isPromptDetailed(prompt: string) {
  const lower = prompt.toLowerCase();
  const requiredSignals = [
    "camera",
    "lighting",
    "cinematic",
    "music video",
    "no text",
  ];

  return prompt.length >= 260 && requiredSignals.filter((word) => lower.includes(word)).length >= 3;
}

function enhanceVideoPrompt(
  prompt: string,
  plan: Partial<StoryboardPlan>,
  project: StoryboardResult,
) {
  if (isPromptDetailed(prompt)) {
    return prompt;
  }

  const step = sanitize(plan.titre_etape, `Scene ${plan.plan ?? ""}`);
  const description = sanitize(plan.description, project.resume);
  const camera = sanitize(plan.camera, "smooth cinematic camera movement");
  const rhythm = sanitize(plan.rythme_musical, "beat-synced visual pacing");
  const direction = sanitize(
    plan.direction_artistique,
    "consistent lead character, coherent wardrobe, same color grade, premium realistic music video identity",
  );
  const style = sanitize(project.style, "premium cinematic realism");
  const format = sanitize(project.format, "vertical 9:16");

  return [
    `Premium AI music video scene for "${project.titre}", section: ${step}.`,
    `Visual action: ${description}.`,
    `Camera direction: ${camera}, stable professional movement, intentional framing, rhythm-aware cuts.`,
    `Music timing: ${rhythm}, visuals should feel synchronized with the song energy and emotional progression.`,
    `Art direction: ${direction}.`,
    `Style: ${style}, high-end cinematic lighting, realistic texture, natural skin, clean composition, ${format}.`,
    "Keep visual continuity with the same character, location palette and mood across the whole music video.",
    "No text overlays unless this is explicitly a lyrics scene, no watermark, no logo, no random captions.",
    prompt ? `Original creative idea to preserve: ${prompt}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function validateStoryboard(value: unknown): StoryboardResult {
  const result = value as StoryboardResult;
  if (!result?.titre || !Array.isArray(result.storyboard)) {
    throw new Error("Reponse IA invalide: storyboard manquant.");
  }

  return {
    ...result,
    storyboard: result.storyboard.map((plan, index) => ({
      plan: Number(plan.plan) || index + 1,
      titre_etape: String(plan.titre_etape ?? ""),
      duree: String(plan.duree ?? ""),
      description: String(plan.description ?? ""),
      camera: String(plan.camera ?? ""),
      texte_ecran: String(plan.texte_ecran ?? ""),
      dialogue: String(plan.dialogue ?? ""),
      objectif_pedagogique: String(plan.objectif_pedagogique ?? ""),
      rythme_musical: String(plan.rythme_musical ?? ""),
      direction_artistique: String(plan.direction_artistique ?? ""),
      prompt_video_ia: enhanceVideoPrompt(
        String(plan.prompt_video_ia ?? ""),
        plan,
        result,
      ),
      negative_prompt: defaultNegativePrompt(plan.negative_prompt),
      transition: String(plan.transition ?? ""),
      type_media: plan.type_media ?? "video_ia",
      statut: plan.statut ?? "prompt_pret",
    })),
  };
}

export async function POST(req: NextRequest) {
  let reservation: Awaited<ReturnType<typeof reserveCredits>> | null = null;

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Utilisateur non authentifie. Connectez-vous ou creez un compte pour generer un storyboard Rudyo.",
        },
        { status: 401 },
      );
    }

    const body = (await req.json()) as StoryboardRequestBody;

    if (!sanitize(body.titre) || !sanitize(body.description)) {
      return NextResponse.json(
        {
          success: false,
          error: "Le titre et la description du projet sont obligatoires.",
        },
        { status: 400 },
      );
    }

    if (process.env.USE_MOCK_STORYBOARD === "true") {
      return NextResponse.json({
        success: true,
        mode: "mock",
        result: createMockStoryboard(body),
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY est manquante. Activez USE_MOCK_STORYBOARD=true ou configurez la cle OpenAI.",
        },
        { status: 500 },
      );
    }

    reservation = await reserveCredits({
      userId: user.id,
      action: "storyboard_complete",
      description: "Generation storyboard Rudyo avec OpenAI",
      metadata: {
        titre: sanitize(body.titre),
        typeVideo: sanitize(body.typeVideo),
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      },
    });

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu generes des storyboards video professionnels en JSON strict pour une application SaaS IA.",
        },
        {
          role: "user",
          content: buildPrompt(body),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI n'a retourne aucun contenu.");
    }

    await confirmCreditUsage(reservation);

    return NextResponse.json({
      success: true,
      mode: "openai",
      creditsUsed: reservation.amount,
      result: validateStoryboard(JSON.parse(text)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur inconnue.";
    console.error("[rudyo-storyboard] erreur", { message });

    if (reservation) {
      await refundCreditUsage(reservation).catch(() => undefined);
    }

    if (message === "CREDITS_INSUFFICIENTS") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Credits insuffisants. Choisissez un modele moins cher ou rechargez votre compte.",
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Impossible de generer le storyboard pour le moment. Verifiez votre session et la configuration OpenAI.",
        details: message,
      },
      { status: 500 },
    );
  }
}
