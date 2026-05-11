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
import { putStorageText, toClientFileRef } from "@/lib/storage";

type ClipPackageRequest = {
  titre?: string;
  format?: string;
  style?: string;
  duree?: string;
  storyboard?: string;
  provider?: string;
  model?: string;
};

type ClipPrompt = {
  id: number;
  nom: string;
  duree: string;
  description: string;
  promptVideo: string;
  promptImage: string;
  imageTestUrl: string;
};

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";

type ClipPromptDraft = Omit<ClipPrompt, "promptVideo" | "promptImage"> & {
  action: string;
  emotion: string;
  decor: string;
  camera: string;
  fallbackPromptImage: string;
  fallbackPromptVideo: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

function splitStoryboard(storyboard: string) {
  const matches = storyboard.match(/Plan\s+\d+[\s\S]*?(?=\nPlan\s+\d+|$)/g);

  if (matches && matches.length > 0) {
    return matches.map((item) => item.trim());
  }

  return storyboard
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function pickLine(section: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(
    new RegExp(`(?:^|\\n)\\s*-?\\s*${escapedLabel}\\s*:?\\s*(.+)`, "i"),
  );

  return match?.[1]?.trim() ?? "";
}

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

function getPollinationsSize(format: string) {
  if (/9:16/i.test(format)) {
    return { width: 720, height: 1280 };
  }

  if (/1:1/i.test(format)) {
    return { width: 1024, height: 1024 };
  }

  return { width: 1280, height: 720 };
}

function sanitizePromptForPollinations(prompt: string) {
  return prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s,.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function buildPollinationsUrl(prompt: string, format: string, seed: number) {
  const { width, height } = getPollinationsSize(format);
  const safePrompt = sanitizePromptForPollinations(prompt);
  const params = new URLSearchParams({
    prompt: safePrompt,
    width: String(width),
    height: String(height),
    seed: String(seed),
  });

  return `/api/test-image?${params.toString()}`;
}

function buildClipPromptDrafts(body: ClipPackageRequest) {
  const storyboard = body.storyboard?.trim() ?? "";
  const sections = splitStoryboard(storyboard).slice(0, 12);
  const format = body.format?.trim() || "16:9";
  const style = body.style?.trim() || "cinematic";
  const title = body.titre?.trim() || "Projet sans titre";
  const totalDuration = parseDurationSeconds(body.duree);
  const clipSeconds = totalDuration
    ? Math.min(
        12,
        Math.max(4, Math.round(totalDuration / Math.max(sections.length, 1))),
      )
    : 6;
  const clipDuration = `${clipSeconds} secondes`;

  return sections.map((section, index) => {
    const description =
      pickLine(section, "Description visuelle") ||
      section.replace(/\s+/g, " ").slice(0, 220);
    const action =
      pickLine(section, "Action") || "Action à interpréter depuis le plan";
    const emotion =
      pickLine(section, "Émotion recherchée") || "émotion cinématique";
    const decor =
      pickLine(section, "Décor") || "set inspired by the storyboard";
    const camera =
      pickLine(section, "Mouvement caméra") || "smooth cinematic movement";
    const promptImage =
      pickLine(section, "Suggestion de prompt image IA") ||
      `cinematic keyframe, ${style}, ${format}, ${description}`;
    const fallbackPromptVideo =
      `Create a ${format} ${style} video shot for "${title}". ` +
      `Scene: ${description}. Action: ${action}. Emotion: ${emotion}. ` +
      `Set: ${decor}. Camera: ${camera}. High-end music video aesthetic, realistic motion, production-ready, no subtitles.`;

    return {
      id: index + 1,
      nom: `clip_${String(index + 1).padStart(2, "0")}`,
      duree: clipDuration,
      description,
      action,
      emotion,
      decor,
      camera,
      fallbackPromptImage: promptImage,
      fallbackPromptVideo,
      imageTestUrl: buildPollinationsUrl(promptImage, format, index + 1),
    } satisfies ClipPromptDraft;
  });
}

function finalizeClipPrompts(
  body: ClipPackageRequest,
  drafts: ClipPromptDraft[],
) {
  const format = body.format?.trim() || "16:9";

  return drafts.map((draft, index) => ({
    id: draft.id,
    nom: draft.nom,
    duree: draft.duree,
    description: draft.description,
    promptImage: draft.fallbackPromptImage,
    promptVideo: draft.fallbackPromptVideo,
    imageTestUrl: buildPollinationsUrl(
      draft.fallbackPromptImage,
      format,
      index + 1,
    ),
  })) satisfies ClipPrompt[];
}

function extractJsonPayload(rawText: string) {
  const fencedMatch = rawText.match(/```json\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const startIndex = rawText.indexOf("[");
  const endIndex = rawText.lastIndexOf("]");

  if (startIndex >= 0 && endIndex > startIndex) {
    return rawText.slice(startIndex, endIndex + 1);
  }

  return rawText.trim();
}

async function enhanceClipPromptsWithOllama(
  body: ClipPackageRequest,
  drafts: ClipPromptDraft[],
) {
  const model = resolveModelForProvider("ollama", body.model);
  const format = body.format?.trim() || "16:9";
  const style = body.style?.trim() || "cinematic";
  const title = body.titre?.trim() || "Projet sans titre";
  const prompt = `Tu es un prompt designer vidéo. Réponds uniquement en JSON valide sous forme de tableau.

Projet : ${title}
Format : ${format}
Style : ${style}

Pour chaque clip ci-dessous, rédige :
- promptImage : un prompt image propre pour un visuel de test Pollinations
- promptVideo : un prompt vidéo propre pour une future génération premium

Clips source :
${JSON.stringify(
  drafts.map((draft) => ({
    id: draft.id,
    nom: draft.nom,
    duree: draft.duree,
    description: draft.description,
    action: draft.action,
    emotion: draft.emotion,
    decor: draft.decor,
    camera: draft.camera,
  })),
  null,
  2,
)}

Format attendu :
[
  {
    "id": 1,
    "promptImage": "...",
    "promptVideo": "..."
  }
]`;

  const payload = await callOllamaGenerate(OLLAMA_BASE_URL, {
    model,
    prompt,
    stream: false,
    format: "json",
  });
  const rawText = payload.response?.trim();

  if (!rawText) {
    throw new Error("Réponse Ollama vide.");
  }

  const parsed = JSON.parse(extractJsonPayload(rawText)) as Array<{
    id?: number;
    promptImage?: string;
    promptVideo?: string;
  }>;

  return drafts.map((draft, index) => {
    const enhanced = parsed.find((item) => item.id === draft.id);
    const promptImage =
      enhanced?.promptImage?.trim() || draft.fallbackPromptImage;
    const promptVideo =
      enhanced?.promptVideo?.trim() || draft.fallbackPromptVideo;

    return {
      id: draft.id,
      nom: draft.nom,
      duree: draft.duree,
      description: draft.description,
      promptImage,
      promptVideo,
      imageTestUrl: buildPollinationsUrl(promptImage, format, index + 1),
    } satisfies ClipPrompt;
  });
}

async function enhanceClipPromptsWithRemoteProvider(
  body: ClipPackageRequest,
  drafts: ClipPromptDraft[],
  provider: "openai" | "blackbox",
) {
  const settings = resolveRemoteAiSettings(provider, body.model);
  const format = body.format?.trim() || "16:9";
  const style = body.style?.trim() || "cinematic";
  const title = body.titre?.trim() || "Projet sans titre";
  const prompt = `Tu es un prompt designer vidéo. Réponds uniquement en JSON valide sous forme de tableau.

Projet : ${title}
Format : ${format}
Style : ${style}

Pour chaque clip ci-dessous, rédige :
- promptImage : un prompt image propre pour un visuel de test Pollinations
- promptVideo : un prompt vidéo propre pour une future génération premium

Clips source :
${JSON.stringify(
  drafts.map((draft) => ({
    id: draft.id,
    nom: draft.nom,
    duree: draft.duree,
    description: draft.description,
    action: draft.action,
    emotion: draft.emotion,
    decor: draft.decor,
    camera: draft.camera,
  })),
  null,
  2,
)}

Format attendu :
[
  {
    "id": 1,
    "promptImage": "...",
    "promptVideo": "..."
  }
]`;

  const completion = await callRemoteChatCompletion({
    settings,
    messages: [
      {
        role: "system",
        content:
          "Tu es un prompt designer vidéo. Réponds uniquement en JSON valide sous forme de tableau.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  const parsed = JSON.parse(extractJsonPayload(completion.content)) as Array<{
    id?: number;
    promptImage?: string;
    promptVideo?: string;
  }>;

  return drafts.map((draft, index) => {
    const enhanced = parsed.find((item) => item.id === draft.id);
    const promptImage =
      enhanced?.promptImage?.trim() || draft.fallbackPromptImage;
    const promptVideo =
      enhanced?.promptVideo?.trim() || draft.fallbackPromptVideo;

    return {
      id: draft.id,
      nom: draft.nom,
      duree: draft.duree,
      description: draft.description,
      promptImage,
      promptVideo,
      imageTestUrl: buildPollinationsUrl(promptImage, format, index + 1),
    } satisfies ClipPrompt;
  });
}

function buildTextExport(body: ClipPackageRequest, clips: ClipPrompt[]) {
  const header = [
    `Titre : ${body.titre || "Projet sans titre"}`,
    `Format : ${body.format || "16:9"}`,
    `Style : ${body.style || "Cinématique"}`,
    `Durée : ${body.duree || "Non précisée"}`,
    "",
    "Etapes :",
    "1. Générez une vidéo par clip avec le prompt Video IA.",
    "2. Placez les fichiers mp4 générés dans media/plans.",
    "3. Placez la musique finale dans media/audio/musique.mp3.",
    "4. Lancez npm run montage pour assembler le clip final.",
    "",
    "Clips :",
  ];

  const content = clips.flatMap((clip) => [
    `Clip ${clip.id} - ${clip.nom}`,
    `Durée : ${clip.duree}`,
    `Description : ${clip.description}`,
    `Prompt Image IA : ${clip.promptImage}`,
    `Prompt Video IA : ${clip.promptVideo}`,
    "",
  ]);

  return [...header, ...content].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClipPackageRequest;
    const selectedProvider = isAiProvider(body.provider)
      ? body.provider
      : resolveDefaultAiProvider();

    if (!body.storyboard?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Le storyboard est obligatoire pour préparer les clips.",
        },
        { status: 400 },
      );
    }

    const drafts = buildClipPromptDrafts(body);
    const clips =
      drafts.length > 0
        ? isRemoteAiProvider(selectedProvider)
          ? await enhanceClipPromptsWithRemoteProvider(
              body,
              drafts,
              selectedProvider,
            ).catch(() => finalizeClipPrompts(body, drafts))
          : await enhanceClipPromptsWithOllama(body, drafts).catch(() =>
              finalizeClipPrompts(body, drafts),
            )
        : [];

    if (clips.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Impossible d'extraire des plans depuis le storyboard.",
        },
        { status: 400 },
      );
    }

    const baseName = slugify(body.titre?.trim() || "clip-video");
    const jsonKey = `export/${baseName}-clips.json`;
    const txtKey = `export/${baseName}-clips.txt`;

    const jsonStored = await putStorageText(
      jsonKey,
      JSON.stringify(
        {
          titre: body.titre,
          format: body.format,
          style: body.style,
          duree: body.duree,
          provider:
            selectedProvider === "ollama"
              ? "ollama+pollinations"
              : `${selectedProvider}+pollinations`,
          clips,
        },
        null,
        2,
      ),
      { contentType: "application/json; charset=utf-8" },
    );
    const txtStored = await putStorageText(
      txtKey,
      buildTextExport(body, clips),
      {
        contentType: "text/plain; charset=utf-8",
      },
    );

    return NextResponse.json({
      success: true,
      result: {
        clips,
        provider:
          selectedProvider === "ollama"
            ? "ollama+pollinations"
            : `${selectedProvider}+pollinations`,
        montage: {
          commande: "npm run montage",
          dossierPlans: "media/plans",
          audio: "media/audio/musique.mp3",
          sortie: "media/export/clip_final.mp4",
        },
        exports: {
          json: toClientFileRef(jsonKey, jsonStored.url),
          texte: toClientFileRef(txtKey, txtStored.url),
        },
      },
    });
  } catch (error) {
    console.error("Erreur package clips :", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la préparation des clips.",
      },
      { status: 500 },
    );
  }
}
