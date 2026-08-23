import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPublicGenerationTask } from "@/lib/seedance/public-task";

const updateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  artistName: z.string().trim().min(2).max(120).optional(),
  musicGenre: z.string().trim().max(80).nullable().optional(),
  bpm: z.number().int().min(30).max(300).nullable().optional(),
  durationSeconds: z.number().int().min(5).max(1800).nullable().optional(),
  finalFormat: z.enum(["16:9", "9:16", "1:1"]).optional(),
  summary: z.string().trim().max(3000).nullable().optional(),
  mood: z.string().trim().max(300).nullable().optional(),
  visualStyle: z.string().trim().max(500).nullable().optional(),
  maxBudgetCredits: z.number().int().positive().max(1_000_000).nullable().optional(),
  maxBudgetUsd: z.number().positive().max(100_000).nullable().optional(),
});

async function ownedProject(id: string, userId: string) {
  return prisma.videoProject.findFirst({
    where: { id, userId },
    include: {
      artistIdentity: true, mediaAssets: { orderBy: { createdAt: "desc" } },
      scenes: { orderBy: { order: "asc" }, include: { variants: true, generationTasks: { orderBy: { createdAt: "desc" }, take: 5 } } },
      budgetLimit: true, consentRecords: { orderBy: { consentedAt: "desc" } },
      finalExports: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const { id } = await params;
    const project = await ownedProject(id, user.id);
    if (!project) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 });
    return NextResponse.json({
      success: true,
      project: {
        ...project,
        mediaAssets: project.mediaAssets.map((asset) => ({
          ...asset,
          storageKey: undefined,
          url: undefined,
          downloadUrl: `/api/projects/${encodeURIComponent(project.id)}/assets/${encodeURIComponent(asset.id)}/download`,
        })),
        scenes: project.scenes.map((scene) => ({
          ...scene,
          generationTasks: scene.generationTasks.map(toPublicGenerationTask),
          variants: scene.variants.map((variant) => ({
            ...variant,
            videoUrl: `/api/seedance/tasks/${encodeURIComponent(variant.taskId)}/download`,
            thumbnailUrl: null,
          })),
        })),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Seedance project read failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible de charger le projet." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  if (!(await prisma.videoProject.findFirst({ where: { id, userId: user.id }, select: { id: true } }))) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  const project = await prisma.videoProject.update({ where: { id }, data: parsed.data });
  if ("maxBudgetCredits" in parsed.data || "maxBudgetUsd" in parsed.data) {
    await prisma.budgetLimit.upsert({
      where: { projectId: id },
      update: { projectCredits: parsed.data.maxBudgetCredits, projectUsd: parsed.data.maxBudgetUsd },
      create: { projectId: id, projectCredits: parsed.data.maxBudgetCredits, projectUsd: parsed.data.maxBudgetUsd },
    });
  }
  return NextResponse.json({ success: true, project });
}
