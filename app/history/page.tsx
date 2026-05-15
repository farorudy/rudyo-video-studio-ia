import Link from "next/link";
import CreditHistory from "@/app/components/CreditHistory";
import Navigation from "@/app/components/Navigation";

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navigation />
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-24 md:px-8">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
              Historique
            </p>
            <h1 className="text-4xl font-black md:text-6xl">
              Suivez votre activite Rudyo.
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Retrouvez les achats, usages de credits et operations liees a vos
              generations IA.
            </p>
          </div>
          <Link
            href="/pricing"
            className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
          >
            Acheter des credits
          </Link>
        </div>
        <CreditHistory />
      </section>
    </main>
  );
}
