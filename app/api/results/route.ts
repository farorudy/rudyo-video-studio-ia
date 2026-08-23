import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const projects = await prisma.videoProject.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { scenes: true } },
      generationTasks: {
        where: { status: "SUCCEEDED", permanentVideoUrl: { not: null } },
        orderBy: { completedAt: "desc" },
        include: { scene: { select: { order: true, title: true } } },
      },
      finalExports: { where: { status: "COMPLETED", OR: [{ storageKey: { not: null } }, { url: { not: null } }] }, orderBy: { updatedAt: "desc" } },
      mediaAssets: { where: { type: { in: ["GENERATED_VIDEO", "FINAL_EXPORT"] } }, orderBy: { createdAt: "desc" } },
    },
  });
    const results = projects.flatMap((project) => [
    ...project.generationTasks.map((task) => ({
      id: task.id, projectId: project.id, project: project.title, name: `${task.scene.title} · scène ${task.scene.order}`,
      mimeType: "video/mp4", sizeBytes: null, createdAt: task.completedAt || task.updatedAt, status: "TERMINÉ",
    })),
    ...project.finalExports.map((item) => ({
      id: item.id, projectId: project.id, project: project.title, name: "Export final", mimeType: "video/mp4",
      sizeBytes: null, createdAt: item.updatedAt, status: "TERMINÉ",
    })),
    ...project.mediaAssets.map((asset) => ({
      id: asset.id, projectId: project.id, project: project.title, name: asset.fileName, mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes, createdAt: asset.createdAt, status: "TERMINÉ", downloadUrl: `/api/assets/${encodeURIComponent(asset.id)}/download`,
    })),
    ...(project._count.scenes > 0 ? [
      { id: `${project.id}:storyboard-json`, projectId: project.id, project: project.title, name: "Storyboard JSON", mimeType: "application/json", sizeBytes: null, createdAt: project.updatedAt, status: "TERMINÉ", downloadUrl: `/api/projects/${encodeURIComponent(project.id)}/export?format=json` },
      { id: `${project.id}:storyboard-pdf`, projectId: project.id, project: project.title, name: "Storyboard PDF", mimeType: "application/pdf", sizeBytes: null, createdAt: project.updatedAt, status: "TERMINÉ", downloadUrl: `/api/projects/${encodeURIComponent(project.id)}/export?format=pdf` },
    ] : []),
  ]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ success: true, results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Result list failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Impossible de charger les résultats." }, { status: 500 });
  }
}
