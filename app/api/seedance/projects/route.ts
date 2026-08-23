import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBytePlusDemoMode } from "@/lib/seedance/client";

const projectSchema = z.object({
  title: z.string().trim().min(2).max(120),
  artistName: z.string().trim().min(2).max(120),
  musicGenre: z.string().trim().max(80).optional(),
  bpm: z.number().int().min(30).max(300).optional(),
  durationSeconds: z.number().int().min(5).max(1800).optional(),
  finalFormat: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  summary: z.string().trim().max(3000).optional(),
  mood: z.string().trim().max(300).optional(),
  visualStyle: z.string().trim().max(500).optional(),
  maxBudgetCredits: z.number().int().positive().max(1_000_000).optional(),
  maxBudgetUsd: z.number().positive().max(100_000).optional(),
  artistIdentity: z.object({
    physicalDescription: z.string().trim().max(1000).optional(),
    hairstyle: z.string().trim().max(300).optional(),
    mainOutfit: z.string().trim().max(500).optional(),
    accessories: z.array(z.string().trim().max(100)).max(20).optional(),
    colorPalette: z.array(z.string().trim().max(30)).max(12).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification persistante requise." }, { status: 401 });
    const projects = await prisma.videoProject.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { _count: { select: { scenes: true, generationTasks: true, mediaAssets: true, finalExports: true } } },
    });
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error("Seedance project list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible de charger les projets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification persistante requise." }, { status: 401 });
    const parsed = projectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ success: false, error: "Informations du projet invalides.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const data = parsed.data;
    const project = await prisma.videoProject.create({
      data: {
        userId: user.id,
        title: data.title,
        artistName: data.artistName,
        musicGenre: data.musicGenre,
        bpm: data.bpm,
        durationSeconds: data.durationSeconds,
        finalFormat: data.finalFormat,
        summary: data.summary,
        mood: data.mood,
        visualStyle: data.visualStyle,
        maxBudgetCredits: data.maxBudgetCredits,
        maxBudgetUsd: data.maxBudgetUsd,
        demoMode: isBytePlusDemoMode(),
        artistIdentity: data.artistIdentity ? { create: data.artistIdentity } : undefined,
        budgetLimit: {
          create: {
            projectCredits: data.maxBudgetCredits,
            projectUsd: data.maxBudgetUsd,
            perGenerationCredits: 40,
            dailyCredits: data.maxBudgetCredits,
            monthlyCredits: data.maxBudgetCredits,
          },
        },
      },
      include: { artistIdentity: true, budgetLimit: true },
    });
    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error("Seedance project creation failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible de créer le projet." }, { status: 500 });
  }
}
