import Link from "next/link";

export default function AnnulePage() {
  return (
    <main className="min-h-screen bg-[#050816] px-6 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center py-16">
        <div className="w-full rounded-lg border border-slate-800 bg-slate-950/90 p-8 text-center shadow-2xl shadow-slate-950/30">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
            Paiement annule
          </p>
          <h1 className="mt-4 text-3xl font-black text-white">
            Aucun montant n'a ete debite.
          </h1>
          <p className="mt-4 leading-7 text-slate-300">
            Vous pouvez reprendre l'achat de tokens quand vous le souhaitez.
          </p>
          <Link
            href="/pricing"
            className="mt-8 inline-flex rounded-lg bg-cyan-400 px-6 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
          >
            Retour aux packs
          </Link>
        </div>
      </section>
    </main>
  );
}
