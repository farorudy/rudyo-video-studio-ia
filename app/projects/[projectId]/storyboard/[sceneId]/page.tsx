import { notFound, redirect } from "next/navigation";
import Navigation from "@/app/components/Navigation";
import StoryboardStudio from "@/app/components/StoryboardStudio";
import { getPageUser } from "@/lib/page-auth";
import { loadStoryboardPageData } from "@/lib/storyboard-data";

export const dynamic = "force-dynamic";

export default async function StoryboardPage({ params }: { params: Promise<{ projectId: string; sceneId: string }> }) {
  const user = await getPageUser();
  if (!user || user.localSession) redirect("/login");
  const { projectId, sceneId } = await params;
  const data = await loadStoryboardPageData(projectId, sceneId, user.id);
  if (!data) notFound();
  return <main className="min-h-screen text-slate-100"><Navigation /><section className="mx-auto max-w-6xl px-4 pb-16 pt-24"><div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/90 shadow-2xl"><StoryboardStudio data={data} /></div></section></main>;
}
