"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <div className="max-w-lg rounded-3xl border border-rose-400/30 bg-rose-950/20 p-8 text-center">
        <h1 className="text-2xl font-black">Une erreur empêche l’affichage</h1>
        <p className="mt-3 text-slate-300">Vos données n’ont pas été supprimées. Vous pouvez relancer cette étape.</p>
        <button type="button" onClick={reset} className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-slate-950">Réessayer</button>
      </div>
    </main>
  );
}
