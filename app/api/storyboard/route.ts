import { NextRequest, NextResponse } from "next/server";
import {
  callRemoteChatCompletion,
  isAiProvider,
  isRemoteAiProvider,
  resolveDefaultAiProvider,
  resolveModelForProvider,
  resolveRemoteAiSettings,
} from "@/lib/ai-provider";
import { callOllamaGenerate } from "@/lib/ollama";

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

type MockStoryboardResult = {
  titre: string;
  type_video: string;
  format: string;
  style: string;
  duree_totale: string;
  resume: string;
  storyboard: Array<{
    plan: number;
    duree: string;
    description: string;
    camera: string;
    texte_ecran: string;
    prompt_video_ia: string;
    transition: string;
  }>;
};

type OllamaStoryboardResult = {
  titre?: string;
  type_video?: string;
  format?: string;
  style?: string;
  duree_totale?: string;
  resume?: string;
  storyboard?: Array<{
    plan?: number;
    duree?: string;
    description?: string;
    camera?: string;
    texte_ecran?: string;
    prompt_video_ia?: string;
    transition?: string;
  }>;
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

function buildStructuredMockResult(): MockStoryboardResult {
  return {
    titre: "Bòd lanmè pa lwen",
    type_video: "Clip musical",
    format: "16:9 YouTube",
    style: "Cinématographique caribéen",
    duree_totale: "3 minutes",
    resume: "Clip sur la persévérance, l’amour et le lanbéli en Guadeloupe.",
    storyboard: [
      {
        plan: 1,
        duree: "6 secondes",
        description: "Vue du bord de mer au lever du soleil.",
        camera: "Travelling lent vers l’océan.",
        texte_ecran: "Bòd lanmè pa lwen",
        prompt_video_ia:
          "Cinematic Caribbean seaside in Guadeloupe at sunrise, golden light, calm ocean, emotional music video style",
        transition: "Fondu lent",
      },
      {
        plan: 2,
        duree: "5 secondes",
        description: "Le chanteur marche seul près de la mer.",
        camera: "Plan moyen avec mouvement latéral.",
        texte_ecran: "An nou rivé gadé",
        prompt_video_ia:
          "A Caribbean male singer walking near the ocean, thoughtful mood, realistic cinematic look, soft wind, music video",
        transition: "Cut doux",
      },
    ],
  };
}

function structuredMockToText(result: MockStoryboardResult) {
  const plans = result.storyboard
    .map(
      (plan) => `Plan ${plan.plan}
- Durée : ${plan.duree}
- Description visuelle : ${plan.description}
- Mouvement caméra : ${plan.camera}
- Texte écran : ${plan.texte_ecran}
- Prompt vidéo IA : ${plan.prompt_video_ia}
- Transition : ${plan.transition}`,
    )
    .join("\n\n");

  return `Titre du projet : ${result.titre}

Résumé de l'histoire :
${result.resume}

${plans}`;
}

function normalizeStructuredResult(
  value: OllamaStoryboardResult,
  body: StoryboardRequestBody,
) {
  const title = body.titre?.trim() || "Projet sans titre";

  if (!Array.isArray(value.storyboard) || value.storyboard.length === 0) {
    return null;
  }

  return {
    titre: value.titre?.trim() || title,
    type_video:
      value.type_video?.trim() || body.typeVideo?.trim() || "Clip musical",
    format: value.format?.trim() || body.format?.trim() || "16:9 YouTube",
    style:
      value.style?.trim() || body.style?.trim() || "Cinématographique local",
    duree_totale:
      value.duree_totale?.trim() || body.duree?.trim() || "Durée libre",
    resume:
      value.resume?.trim() ||
      body.description?.trim() ||
      "Storyboard généré localement avec Ollama.",
    storyboard: value.storyboard.filter(Boolean).map((plan, index) => ({
      plan: Number.isFinite(plan.plan) ? Number(plan.plan) : index + 1,
      duree: plan.duree?.trim() || "6 secondes",
      description:
        plan.description?.trim() ||
        "Description visuelle à préciser dans le storyboard.",
      camera: plan.camera?.trim() || "Mouvement caméra fluide",
      texte_ecran: plan.texte_ecran?.trim() || "",
      prompt_video_ia:
        plan.prompt_video_ia?.trim() ||
        "Cinematic scene, realistic motion, music video style",
      transition: plan.transition?.trim() || "Cut doux",
    })),
  } satisfies MockStoryboardResult;
}

function extractJsonPayload(rawText: string) {
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const startIndex = rawText.indexOf("{");
  const endIndex = rawText.lastIndexOf("}");

  if (startIndex >= 0 && endIndex > startIndex) {
    return rawText.slice(startIndex, endIndex + 1);
  }

  return rawText.trim();
}

function buildOllamaPrompt(body: StoryboardRequestBody) {
  const { titre, typeVideo, duree, format, style, description, nombrePlans } =
    body;
  const requestedPlans = Number.parseInt(String(nombrePlans ?? ""), 10);
  const safePlanCount = Number.isFinite(requestedPlans)
    ? Math.min(12, Math.max(2, requestedPlans))
    : 8;

  return `Tu es un réalisateur vidéo. Réponds uniquement en JSON valide sans markdown.

Construit un storyboard pour :
- titre: ${titre ?? "Sans titre"}
- type_video: ${typeVideo ?? "Clip musical"}
- duree_totale: ${duree ?? "3 minutes"}
- format: ${format ?? "16:9 YouTube"}
- style: ${style ?? "Cinématographique"}
- description: ${description ?? "A préciser"}
- nombre_de_plans: ${safePlanCount}

Format JSON attendu:
{
  "titre": "...",
  "type_video": "...",
  "format": "...",
  "style": "...",
  "duree_totale": "...",
  "resume": "...",
  "storyboard": [
    {
      "plan": 1,
      "duree": "6 secondes",
      "description": "...",
      "camera": "...",
      "texte_ecran": "...",
      "prompt_video_ia": "...",
      "transition": "..."
    }
  ]
}`;
}

async function generateStoryboardWithOllama(body: StoryboardRequestBody) {
  const model = resolveModelForProvider("ollama", body.model);
  const payload = await callOllamaGenerate(OLLAMA_BASE_URL, {
    model,
    prompt: buildOllamaPrompt(body),
    stream: false,
    format: "json",
  });
  const rawText = payload.response?.trim();

  if (!rawText) {
    throw new Error("Réponse Ollama vide.");
  }

  const parsed = JSON.parse(
    extractJsonPayload(rawText),
  ) as OllamaStoryboardResult;
  const normalized = normalizeStructuredResult(parsed, body);

  if (!normalized) {
    throw new Error("Réponse Ollama incomplète.");
  }

  return normalized;
}

async function generateStoryboardWithRemoteProvider(
  body: StoryboardRequestBody,
  provider: "openai" | "blackbox",
) {
  const settings = resolveRemoteAiSettings(provider, body.model);
  const completion = await callRemoteChatCompletion({
    settings,
    messages: [
      {
        role: "system",
        content:
          "Tu es un réalisateur vidéo. Réponds uniquement en JSON valide sans markdown.",
      },
      {
        role: "user",
        content: buildOllamaPrompt(body),
      },
    ],
    temperature: 0.7,
  });

  const parsed = JSON.parse(
    extractJsonPayload(completion.content),
  ) as OllamaStoryboardResult;
  const normalized = normalizeStructuredResult(parsed, body);

  if (!normalized) {
    throw new Error(`Réponse ${settings.label} incomplète.`);
  }

  return {
    result: normalized,
    provider,
    model: settings.model,
  };
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

  return `
Crée un storyboard professionnel à partir de cette idée :

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
- Suggestion de prompt image IA
`;
}

export async function GET() {
  const defaultProvider = resolveDefaultAiProvider();

  return NextResponse.json({
    success: true,
    message: "Storyboard API prête",
    provider: defaultProvider,
    model:
      defaultProvider === "ollama"
        ? resolveModelForProvider("ollama")
        : resolveRemoteAiSettings(defaultProvider).model,
  });
}

export async function POST(req: NextRequest) {
  let body: StoryboardRequestBody = {};

  try {
    body = (await req.json()) as StoryboardRequestBody;
    const selectedProvider = isAiProvider(body.provider)
      ? body.provider
      : resolveDefaultAiProvider();

    if (process.env.USE_MOCK_STORYBOARD === "true") {
      const mockResult = buildStructuredMockResult();

      return NextResponse.json({
        success: true,
        storyboard: structuredMockToText(mockResult),
        result: mockResult,
        fallback: true,
        mock: true,
      });
    }

    if (!buildPrompt(body)) {
      return NextResponse.json(
        { error: "Le prompt est obligatoire." },
        { status: 400 },
      );
    }

    const generated = isRemoteAiProvider(selectedProvider)
      ? await generateStoryboardWithRemoteProvider(body, selectedProvider)
      : {
          result: await generateStoryboardWithOllama(body),
          provider: "ollama" as const,
          model: resolveModelForProvider("ollama", body.model),
        };

    return NextResponse.json({
      success: true,
      storyboard: structuredMockToText(generated.result),
      result: generated.result,
      provider: generated.provider,
      model: generated.model,
    });
  } catch (error) {
    console.error("Erreur API storyboard :", error);

    const fallbackStoryboard = buildMockStoryboard(body);

    return NextResponse.json({
      success: true,
      storyboard: fallbackStoryboard,
      result: null,
      fallback: true,
      provider: "mock-local",
    });
  }
}
