import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const classicProjectSchema = z.object({
  titre: z.string().trim().min(2).max(120),
  artistName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(3000).optional(),
  durationSeconds: z.number().int().min(5).max(1800).optional(),
  finalFormat: z.enum(["16:9", "9:16", "1:1"]).optional(),
  style: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });

    const projects = await prisma.videoProject.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        _count: {
          select: {
            scenes: true,
            generationTasks: true,
            mediaAssets: true,
            finalExports: { where: { status: "COMPLETED", OR: [{ storageKey: { not: null } }, { url: { not: null } }] } },
          },
        },
        mediaAssets: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({
      success: true,
      projects: projects.map((project) => ({
        id: project.id,
        title: project.title,
        titre: project.title,
        artistName: project.artistName,
        category: "Studio Clip Seedance",
        status: project.status,
        finalFormat: project.finalFormat,
        savedAt: project.updatedAt,
        createdAt: project.createdAt,
        counts: project._count,
        mediaAssets: project.mediaAssets.map((asset) => ({
          id: asset.id,
          type: asset.type,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          createdAt: asset.createdAt,
          downloadUrl: `/api/projects/${encodeURIComponent(project.id)}/assets/${encodeURIComponent(asset.id)}/download`,
        })),
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Project list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible de charger vos projets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const parsed = classicProjectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ success: false, error: "Informations du projet invalides.", details: parsed.error.flatten().fieldErrors }, { status: 400 });

    const data = parsed.data;
    const project = await prisma.videoProject.create({
      data: {
        userId: user.id,
        title: data.titre,
        artistName: data.artistName || user.name || "Artiste Rudyo",
        durationSeconds: data.durationSeconds,
        finalFormat: data.finalFormat || "16:9",
        summary: data.description,
        visualStyle: data.style,
        demoMode: true,
        budgetLimit: { create: {} },
      },
    });
    return NextResponse.json({ success: true, id: project.id, project, savedAt: project.updatedAt }, { status: 201 });
  } catch (error) {
    console.error("Project creation failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible d’enregistrer le projet." }, { status: 500 });
  }
}
