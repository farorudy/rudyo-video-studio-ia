import Link from "next/link";
import CreditDashboard from "@/app/components/CreditDashboard";
import Navigation from "@/app/components/Navigation";

const stats = [
  {
    label: "Projets",
    value: "0",
    detail: "Storyboards, clips et formations sauvegardes.",
  },
  {
    label: "Exports",
    value: "0",
    detail: "PDF, JSON, scripts et prompts generes.",
  },
  {
    label: "Commandes",
    value: "0",
    detail: "Videos Farozik en devis ou en production.",
  },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navigation />
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-24 md:px-8">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
              Tableau de bord
            </p>
            <h1 className="text-4xl font-black md:text-6xl">
              Pilotez votre studio vidéo IA.
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Retrouvez vos credits, projets, exports, commandes et actions
              rapides depuis un espace unique.
            </p>
          </div>
          <Link
            href="/studio"
            className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
          >
            Nouveau projet
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-slate-800 bg-slate-950 p-6"
            >
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className="mt-3 text-5xl font-black text-cyan-300">
                {stat.value}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {stat.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <CreditDashboard />
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-2xl font-black">Actions rapides</h2>
            <div className="mt-6 grid gap-3">
              <Link
                href="/studio"
                className="rounded-2xl bg-slate-900 px-5 py-4 font-bold text-cyan-300 hover:bg-slate-800"
              >
                Générer un storyboard
              </Link>
              <Link
                href="/projects"
                className="rounded-2xl bg-slate-900 px-5 py-4 font-bold text-cyan-300 hover:bg-slate-800"
              >
                Voir mes projets
              </Link>
              <Link
                href="/pricing"
                className="rounded-2xl bg-slate-900 px-5 py-4 font-bold text-cyan-300 hover:bg-slate-800"
              >
                Acheter des credits
              </Link>
              <Link
                href="/order-video"
                className="rounded-2xl bg-slate-900 px-5 py-4 font-bold text-cyan-300 hover:bg-slate-800"
              >
                Commander une video
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
