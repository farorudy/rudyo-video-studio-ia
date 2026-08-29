import { notFound, redirect } from "next/navigation";
import { getPageUser } from "@/lib/page-auth";
import { prisma } from "@/lib/prisma";
import { createScenarioVersionFromLegacyProject } from "@/lib/scenario-studio-service";

export const dynamic = "force-dynamic";

export default async function StoryboardEntryPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getPageUser();
  if (!user || user.localSession) redirect("/login");

  const { projectId } = await params;
  const project = await prisma.videoProject.findFirst({
    where: { id: projectId, userId: user.id },
    select: {
      scenarioVersions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { scenes: { orderBy: { position: "asc" }, take: 1, select: { id: true } } },
      },
    },
  });
  if (!project) notFound();

  let firstSceneId = project.scenarioVersions[0]?.scenes[0]?.id || null;
  if (!firstSceneId) {
    const version = await createScenarioVersionFromLegacyProject(projectId, user.id);
    firstSceneId = version.firstSceneId;
  }

  if (!firstSceneId) notFound();
  redirect(`/projects/${encodeURIComponent(projectId)}/storyboard/${encodeURIComponent(firstSceneId)}`);
}
