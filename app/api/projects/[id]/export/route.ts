import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTextPdf } from "@/lib/simple-pdf";

function safeBaseName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "projet-rudyo";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.localSession) return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    const { id } = await params;
    const project = await prisma.videoProject.findFirst({
      where: { id, userId: user.id },
      include: {
        scenes: { orderBy: { order: "asc" } },
        mediaAssets: { select: { id: true, type: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
        finalExports: true,
        scenarioVersions: { where: { status: "VALIDATED" }, orderBy: { version: "desc" }, take: 1, include: { references: true, scenes: { orderBy: { position: "asc" }, include: { shots: { orderBy: { position: "asc" }, include: { storyboard: true } } } } } },
      },
    });
    if (!project) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 });

    const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "json";
    const scenario = project.scenarioVersions[0];
    if (!scenario) return NextResponse.json({ success: false, error: "Validez le scénario avant de l'exporter." }, { status: 409 });
    const baseName = safeBaseName(project.title);
    if (format === "pdf") {
      const pdf = createTextPdf(`Rudyo AI - ${project.title}`, [
        `Artiste: ${project.artistName}`,
        `Format: ${project.finalFormat}`,
        `Version validee: ${scenario.version}`,
        `Duree audio: ${(scenario.audioDurationMs / 1000).toFixed(3)} s`,
        ...scenario.scenes.flatMap((scene) => [
          `Scene ${scene.position}: ${scene.title}`,
          `Narration: ${scene.narrativeContent}`,
          ...scene.shots.flatMap((shot) => [`Plan ${shot.position} (${(shot.endMs - shot.startMs) / 1000} s): ${shot.shotFunction}`, `Prompt Seedance: ${shot.seedancePrompt}`]),
        ]),
      ]);
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="rudyo-${baseName}-storyboard.pdf"`,
          "Content-Length": String(pdf.length),
          "Cache-Control": "private, no-store",
        },
      });
    }

    return NextResponse.json({ success: true, exportedAt: new Date().toISOString(), project: { id: project.id, title: project.title, artistName: project.artistName, finalFormat: project.finalFormat }, scenarioVersion: scenario }, {
      headers: {
        "Content-Disposition": `attachment; filename="rudyo-${baseName}-storyboard.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Project export failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Export impossible pour le moment." }, { status: 500 });
  }
}
