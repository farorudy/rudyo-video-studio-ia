import Link from "next/link";

const cards = [
  {
    title: "Mes projets",
    value: "0",
    description: "Storyboards, clips, formations et vidéos en préparation.",
  },
  {
    title: "Mes crédits",
    value: "18",
    description: "Crédits disponibles pour générer avec lIA.",
  },
  {
    title: "Mes exports",
    value: "0",
    description: "PDF, prompts, scripts, sous-titres et fichiers générés.",
  },
  {
    title: "Mes commandes",
    value: "0",
    description: "Vidéos commandées ou devis en attente.",
  },
];

export default function WorkspacePage() {
  return (
    <main className="min-h-screen bg-[#020617] px-4 py-10 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
              Espace de travail
            </p>
            <h1 className="text-4xl font-black md:text-6xl">
              Pilotez vos projets vidéo.
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Retrouvez vos projets, crédits, générations, exports et commandes
              Farozik depuis un seul tableau de bord.
            </p>
          </div>

          <Link
            href="/studio"
            className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
          >
            Nouveau projet
          </Link>
        </div>

        <section className="grid gap-5 md:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6"
            >
              <p className="text-sm text-slate-400">{card.title}</p>
              <p className="mt-3 text-5xl font-black text-cyan-300">
                {card.value}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {card.description}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-2xl font-black">Projets récents</h2>
            <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
              Aucun projet pour le moment.
              <br />
              Lancez votre premier projet depuis le Studio IA.
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-2xl font-black">Actions rapides</h2>
            <div className="mt-6 grid gap-3">
              <Link
                href="/studio"
                className="rounded-2xl bg-slate-900 px-5 py-4 font-bold text-cyan-300 hover:bg-slate-800"
              >
                Créer un storyboard
              </Link>
              <Link
                href="/credits"
                className="rounded-2xl bg-slate-900 px-5 py-4 font-bold text-cyan-300 hover:bg-slate-800"
              >
                Acheter des crédits
              </Link>
              <Link
                href="/offres"
                className="rounded-2xl bg-slate-900 px-5 py-4 font-bold text-cyan-300 hover:bg-slate-800"
              >
                Commander une vidéo
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
