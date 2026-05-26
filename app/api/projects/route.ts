import { NextRequest, NextResponse } from "next/server";
import { listStorage, putStorageText, readStorageText } from "@/lib/storage";
import { isAiProvider, type AiProvider } from "@/lib/ai-provider";
import { getCurrentUser } from "@/lib/auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// GET /api/projects — lister tous les projets
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    const files = (await listStorage("projects/")).filter((item) =>
      item.key.endsWith(".json"),
    );

    const projects = await Promise.all(
      files.map(async (file) => {
        try {
          const content = await readStorageText(file.key);

          if (!content) {
            return null;
          }

          const data = JSON.parse(content);
          return {
            id: file.key.replace(/^projects\//, "").replace(".json", ""),
            ...data,
          };
        } catch {
          return null;
        }
      }),
    );

    const valid = projects
      .filter((project) => project && project.userId === user.id)
      .sort((a, b) => {
      const dateA = a && a.savedAt ? new Date(a.savedAt).getTime() : 0;
      const dateB = b && b.savedAt ? new Date(b.savedAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ success: true, projects: valid });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lecture projets.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// POST /api/projects — sauvegarder un projet
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      titre,
      storyboard,
      storyboardStructure,
      audioAnalysis,
      clips,
      config,
      remapStrategy,
      manualOrderLocked,
      aiProvider,
      aiModel,
      aiModelByProvider,
    } = body;

    if (!titre) {
      return NextResponse.json(
        { success: false, error: "Le titre est requis." },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const id = `${slugify(titre)}-${timestamp}`;
    const storageKey = `projects/${id}.json`;

    const project = {
      id,
      userId: user.id,
      titre,
      savedAt: new Date().toISOString(),
      aiProvider: isAiProvider(aiProvider)
        ? (aiProvider as AiProvider)
        : "ollama",
      aiModel: typeof aiModel === "string" ? aiModel : null,
      aiModelByProvider:
        aiModelByProvider && typeof aiModelByProvider === "object"
          ? aiModelByProvider
          : null,
      storyboard: storyboard || null,
      storyboardStructure: storyboardStructure || null,
      audioAnalysis: audioAnalysis || null,
      clips: clips || null,
      config: config || null,
      remapStrategy:
        remapStrategy === "conservative" ||
        remapStrategy === "balanced" ||
        remapStrategy === "aggressive"
          ? remapStrategy
          : "balanced",
      manualOrderLocked: Boolean(manualOrderLocked),
    };

    await putStorageText(storageKey, JSON.stringify(project, null, 2), {
      contentType: "application/json; charset=utf-8",
    });

    return NextResponse.json({ success: true, id, savedAt: project.savedAt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur sauvegarde projet.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
