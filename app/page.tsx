import { headers } from "next/headers";
import Link from "next/link";
import StudioHome from "./StudioHome";
export const dynamic = "force-dynamic";
export default async function Home() {
 const host=(await headers()).get("host")?.split(":")[0];
 if(host!=="rudyoai.com"&&host!=="www.rudyoai.com")return <StudioHome/>;
 return <main className="mx-auto max-w-4xl px-6 py-20 text-white"><p>RudyoAI · Farozik production</p><h1 className="mt-6 text-4xl font-bold">Préparez vos clips et vidéos avec RudyoAI.</h1><p className="mt-6 text-lg">Storyboard, intentions visuelles et prompts pour vos projets musicaux et promotionnels. La production vidéo dépend des services disponibles et des médias du projet.</p><div className="mt-8 flex gap-6"><a href="https://app.rudyoai.com/" className="rounded-xl bg-blue-600 px-5 py-3">Ouvrir l’application</a><Link href="/offres">Consulter les offres</Link></div></main>;
}
