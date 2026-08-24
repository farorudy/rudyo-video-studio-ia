import Navigation from "@/app/components/Navigation";
import SimpleCreations from "@/app/components/SimpleCreations";

export default function CreationsPage() {
  return <main className="min-h-screen text-slate-100"><Navigation /><section className="mx-auto max-w-6xl px-5 pb-16 pt-28"><p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">Votre espace</p><h1 className="mt-3 text-4xl font-black sm:text-6xl">Mes créations</h1><p className="mt-4 text-slate-400">Regardez, téléchargez ou supprimez vos clips.</p><SimpleCreations /></section></main>;
}
