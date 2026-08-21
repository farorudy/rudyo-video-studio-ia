"use client";

export default function SeedanceStudioError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><div className="max-w-lg rounded-3xl border border-red-400/30 bg-red-950/30 p-8 text-center"><h1 className="text-2xl font-black">Le studio a rencontré une erreur</h1><p className="mt-3 text-red-100">Vos projets et générations sont sauvegardés. Vous pouvez relancer l’affichage sans créer une nouvelle tâche.</p><button onClick={unstable_retry} className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-950">Réessayer</button></div></main>;
}
