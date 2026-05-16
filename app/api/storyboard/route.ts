import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreditAction } from "@/lib/credit-costs";
import {
  logAiUsage,
  reserveCredits,
  confirmCreditUsage,
  refundCreditUsage,
  getCurrentUserFromRequest,
} from "@/lib/credit-utils";
import { generateWithBestProvider } from "@/lib/ai/generate";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";

type StoryboardRequestBody = {
  prompt?: string;
  titre?: string;
  typeVideo?: string;
  duree?: string;
  format?: string;
  style?: string;
  description?: string;
  nombrePlans?: string | number;
  provider?: string;
  model?: string;
};

function parseDurationSeconds(value: string | undefined) {
  if (!value) {
    return null;
  }

  const minutesMatch = value.match(/(\d+)\s*minute/i);

  if (minutesMatch) {
    return Number.parseInt(minutesMatch[1], 10) * 60;
  }

  const secondsMatch = value.match(/(\d+)\s*seconde/i);

  if (secondsMatch) {
    return Number.parseInt(secondsMatch[1], 10);
  }

  return null;
}

function getMockPlanCount(body: StoryboardRequestBody) {
  const requestedPlans = Number.parseInt(String(body.nombrePlans ?? ""), 10);
  const durationSeconds = parseDurationSeconds(body.duree);

  if (Number.isFinite(requestedPlans) && requestedPlans > 0) {
    return Math.min(12, Math.max(5, requestedPlans));
  }

  if (!durationSeconds) {
    return 5;
  }

  if (durationSeconds >= 300) {
    return 12;
  }

  if (durationSeconds >= 240) {
    return 10;
  }

  if (durationSeconds >= 120) {
    return 8;
  }

  return 5;
}

function getMockPlanTemplate(index: number) {
  const templates = [
    {
      description:
        "plan d'ouverture atmosphérique qui installe le lieu, le ton et le personnage principal.",
      type: "plan large",
      camera: "travelling avant lent",
      decor: "environnement principal du récit",
      light: "lumière naturelle douce",
      action: "le personnage entre dans le cadre et observe l'horizon",
      emotion: "attente",
      image:
        "cinematic opening shot, tropical environment, soft natural light, emotional atmosphere",
    },
    {
      description:
        "alternance de détails symboliques liés au thème de la vidéo.",
      type: "gros plan",
      camera: "caméra portée stabilisée",
      decor: "éléments de décor texturés et expressifs",
      light: "contrastes fins avec reflets subtils",
      action: "gestes lents et contemplatifs",
      emotion: "introspection",
      image:
        "close-up symbolic details, textured set, cinematic contrast, reflective mood",
    },
    {
      description:
        "montée d'intensité avec mouvement plus ample et décor plus vivant.",
      type: "plan moyen",
      camera: "panoramique fluide",
      decor: "espace ouvert avec profondeur marquée",
      light: "lumière dorée de fin de journée",
      action: "le personnage avance avec détermination",
      emotion: "élan",
      image:
        "medium shot, golden hour, determined character, dynamic composition",
    },
    {
      description:
        "plan culminant qui met en avant l'émotion centrale du projet.",
      type: "plan rapproché",
      camera: "léger arc de cercle",
      decor: "arrière-plan diffus pour isoler le sujet",
      light: "lumière dramatique contrôlée",
      action: "expression intense face caméra",
      emotion: "impact",
      image:
        "dramatic close shot, expressive face, shallow depth of field, emotional climax",
    },
    {
      description:
        "transition visuelle qui relie le récit à un nouvel espace ou une nouvelle énergie.",
      type: "plan séquence court",
      camera: "travelling latéral souple",
      decor: "passage entre deux zones du décor",
      light: "contre-jour léger",
      action: "le personnage change de rythme et de direction",
      emotion: "bascule",
      image:
        "cinematic transition shot, lateral tracking, soft backlight, changing energy",
    },
    {
      description:
        "tableau chorégraphié ou performatif qui donne de l'ampleur au clip.",
      type: "plan large chorégraphié",
      camera: "grue virtuelle ou drone lent",
      decor: "espace ouvert mis en valeur par la composition",
      light: "lumière contrastée premium",
      action: "mouvement collectif ou performance centrale",
      emotion: "puissance",
      image:
        "music video wide shot, choreographed movement, premium lighting, epic composition",
    },
    {
      description:
        "moment suspendu plus intime avant la dernière montée dramatique.",
      type: "plan rapproché intime",
      camera: "caméra fixe respirante",
      decor: "décor apaisé avec textures naturelles",
      light: "lumière douce et enveloppante",
      action: "regard intérieur ou geste symbolique",
      emotion: "vulnérabilité",
      image:
        "intimate cinematic close-up, soft wrap light, symbolic gesture, emotional pause",
    },
    {
      description: "relance rythmique qui prépare la séquence finale.",
      type: "plan moyen dynamique",
      camera: "mouvement d'épaule énergique",
      decor: "décor animé par le vent, la foule ou les éléments",
      light: "lumière plus nerveuse et contrastée",
      action: "accélération du jeu ou de la progression",
      emotion: "tension",
      image:
        "dynamic medium shot, energetic handheld feel, cinematic tension, vivid environment",
    },
    {
      description: "pré-climax visuel avec composition très graphique.",
      type: "plan tableau",
      camera: "zoom lent contrôlé",
      decor: "décor stylisé à forte identité",
      light: "éclairage sculpté",
      action: "pose, arrêt ou geste clé du récit",
      emotion: "affirmation",
      image:
        "graphic cinematic tableau, sculpted light, strong pose, visual statement",
    },
    {
      description: "explosion émotionnelle et visuelle au coeur du morceau.",
      type: "plan héro",
      camera: "orbite ample autour du sujet",
      decor: "décor principal à son maximum d'intensité",
      light: "lumière dramatique spectaculaire",
      action: "performance frontale et engagée",
      emotion: "libération",
      image:
        "hero shot, dramatic orbit camera, spectacular lighting, emotional release",
    },
    {
      description: "retombée poétique après le point culminant.",
      type: "plan contemplatif",
      camera: "recul lent",
      decor: "retour à un espace plus ouvert et respirant",
      light: "crépuscule doux",
      action: "le personnage reprend son souffle ou s'éloigne",
      emotion: "apaisement",
      image:
        "poetic contemplative shot, slow pull back, dusk atmosphere, emotional calm",
    },
    {
      description:
        "conclusion visuelle mémorable qui referme le récit sur une note forte.",
      type: "plan large final",
      camera: "recul lent",
      decor: "décor initial réinterprété",
      light: "ambiance crépusculaire",
      action: "le personnage s'éloigne ou reste immobile dans un tableau final",
      emotion: "résolution",
      image:
        "cinematic final wide shot, dusk light, poetic ending, memorable composition",
    },
  ];

  return templates[index % templates.length];
}

function buildMockStoryboard(body: StoryboardRequestBody) {
  const title = body.titre?.trim() || "Projet sans titre";
  const videoType = body.typeVideo?.trim() || "Vidéo créative";
  const duration = body.duree?.trim() || "Durée libre";
  const format = body.format?.trim() || "Format libre";
  const style = body.style?.trim() || "Style cinématique";
  const description =
    body.description?.trim() ||
    body.prompt?.trim() ||
    "Storyboard de démonstration généré en mode local.";
  const planCount = getMockPlanCount(body);
  const plans = Array.from({ length: planCount }, (_, index) => {
    const template = getMockPlanTemplate(index);

    return `Plan ${index + 1}
- Description visuelle : ${template.description}
- Type de plan : ${template.type}
- Mouvement caméra : ${template.camera}
- Décor : ${template.decor}
- Lumière : ${template.light}
- Action : ${template.action}
- Émotion recherchée : ${template.emotion}
- Suggestion de prompt image IA : ${template.image}`;
  }).join("\n\n");

  return `Titre du projet : ${title}

Résumé de l'histoire :
Cette version est un storyboard de démonstration généré localement pour permettre de tester l'interface sans appel OpenAI. Le concept repose sur ${description.toLowerCase()} avec une mise en scène ${style.toLowerCase()} pensée pour un ${videoType.toLowerCase()} au format ${format} sur une durée de ${duration}.

${plans}`;
}

function buildPrompt(body: StoryboardRequestBody) {
  if (typeof body.prompt === "string" && body.prompt.trim()) {
    return body.prompt.trim();
  }

  const { titre, typeVideo, duree, format, style, description, nombrePlans } =
    body;

  if (!titre && !description) {
    return null;
  }

  const requestedPlans = Number.parseInt(String(nombrePlans ?? ""), 10);
  const planInstruction =
    Number.isFinite(requestedPlans) && requestedPlans > 0
      ? `${requestedPlans}`
      : "10 à 20";

  return `Crée un storyboard professionnel à partir de cette idée :

Titre : ${titre ?? "Sans titre"}
Type de vidéo : ${typeVideo ?? "Non précisé"}
Durée : ${duree ?? "Non précisée"}
Format : ${format ?? "Non précisé"}
Style : ${style ?? "Non précisé"}
Nombre de plans souhaité : ${planInstruction}
Description : ${description ?? "Non précisée"}

Réponds en français avec :
1. Titre du projet
2. Résumé de l'histoire
3. Liste de ${planInstruction} plans si possible
4. Pour chaque plan :
- Numéro du plan
- Description visuelle
- Type de plan
- Mouvement caméra
- Décor
- Lumière
- Action
- Émotion recherchée
- Suggestion de prompt image IA`;
}

export async function POST(req: NextRequest) {
  let body: StoryboardRequestBody = {};
  const action: CreditAction = "storyboard_complete";

  try {
    body = (await req.json()) as StoryboardRequestBody;
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Connectez-vous pour utiliser vos crédits Rudyo." },
        { status: 401 },
      );
    }

    const prompt = buildPrompt(body);
    if (!prompt) {
      return NextResponse.json(
        { error: "Le prompt est obligatoire." },
        { status: 400 },
      );
    }

    const transaction = await reserveCredits(
      user.id,
      action,
      "Réservation storyboard Rudyo",
      { provider: body.provider ?? "unknown", model: body.model ?? "default" },
    );

    try {
      const generated = await generateWithBestProvider({
        action,
        prompt,
        userId: user.id,
        quality: process.env.DEFAULT_AI_QUALITY as
          | "economy"
          | "balanced"
          | "premium"
          | undefined,
        preferredProvider: body.provider,
        modelOverride: body.model,
        userPlan: (user as { plan?: string }).plan,
        allowPremiumAi: (user as { allowPremiumAi?: boolean }).allowPremiumAi,
      });

      await confirmCreditUsage(transaction.id);

      await logAiUsage({
        userId: user.id,
        provider: generated.provider,
        model: generated.model,
        action,
        estimatedInputTokens: undefined,
        estimatedOutputTokens: undefined,
        estimatedCost: undefined,
        creditsCharged: transaction.amount,
      });

      return NextResponse.json({
        success: true,
        storyboard: generated.text,
        provider: generated.provider,
        model: generated.model,
        reason: generated.reason,
      });
    } catch (error) {
      await refundCreditUsage(transaction.id).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Erreur API storyboard :", error);

    if (
      error instanceof Error &&
      (error.message === "CREDITS_INSUFFICIENTS" ||
        error.message.includes("Crédits insuffisants") ||
        error.message.includes("Credits insuffisants"))
    ) {
      return NextResponse.json(
        {
          error:
            "Crédits Rudyo insuffisants ou action non couverte par votre plan.",
        },
        { status: 402 },
      );
    }

    const currentUser = await getCurrentUserFromRequest(req);
    if (currentUser) {
      const pending = await prisma.creditTransaction.findFirst({
        where: {
          userId: currentUser.id,
          status: "PENDING",
          description: "Réservation storyboard Rudyo",
        },
        orderBy: { createdAt: "desc" },
      });
      if (pending) {
        await refundCreditUsage(pending.id).catch((refundError) => {
          console.error("Erreur remboursement crédit :", refundError);
        });
      }
    }

    const fallbackStoryboard = buildMockStoryboard(body);

    return NextResponse.json({
      success: true,
      storyboard: fallbackStoryboard,
      fallback: true,
      provider: "mock-local",
    });
  }
}
