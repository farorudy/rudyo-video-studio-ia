import { NextRequest, NextResponse } from "next/server";
import { deleteStorage, readStorageText } from "@/lib/storage";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/projects/[id] — supprimer un projet
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 },
      );
    }

    const { id } = await params;

    // Sanitize : rejeter les id contenant des chemins traversants
    if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
      return NextResponse.json(
        { success: false, error: "Identifiant de projet invalide." },
        { status: 400 },
      );
    }

    // Autoriser uniquement les caractères alphanum, tirets
    if (!/^[a-z0-9\-]+$/i.test(id)) {
      return NextResponse.json(
        { success: false, error: "Identifiant de projet invalide." },
        { status: 400 },
      );
    }

    const projectText = await readStorageText(`projects/${id}.json`);
    if (!projectText) {
      return NextResponse.json(
        { success: false, error: "Projet introuvable." },
        { status: 404 },
      );
    }

    const project = JSON.parse(projectText) as { userId?: string };
    if (project.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Permission refusee." },
        { status: 403 },
      );
    }

    const deleted = await deleteStorage(`projects/${id}.json`);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Projet introuvable." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur suppression projet.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
