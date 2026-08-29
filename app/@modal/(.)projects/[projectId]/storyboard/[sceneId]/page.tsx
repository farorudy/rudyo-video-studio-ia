import { notFound } from "next/navigation";
import RouteModal from "@/app/components/RouteModal";
import StoryboardStudio from "@/app/components/StoryboardStudio";
import { getPageUser } from "@/lib/page-auth";
import { loadStoryboardPageData } from "@/lib/storyboard-data";

export default async function StoryboardModalPage({ params }: { params: Promise<{ projectId: string; sceneId: string }> }) {
  const user = await getPageUser();
  if (!user || user.localSession) notFound();
  const { projectId, sceneId } = await params;
  const data = await loadStoryboardPageData(projectId, sceneId, user.id);
  if (!data) notFound();
  return <RouteModal><StoryboardStudio data={data} modal /></RouteModal>;
}
