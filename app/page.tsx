import Link from "next/link";

const offers = [
  {
    title: "Créer avec mes crédits",
    description:
      "Utilisez Rudyo pour générer storyboards, scripts, prompts vidéo, sous-titres et projets de clip.",
    href: "/studio",
    button: "Ouvrir le Studio IA",
  },
  {
    title: "Espace de travail",
    description:
      "Retrouvez vos projets, vos générations, vos crédits, vos exports et vos commandes.",
    href: "/workspace",
    button: "Accéder à mon espace",
  },
  {
    title: "Commander une vidéo",
    description:
      "Confiez votre projet à Farozik : flyer animé, clip lyrics, vidéo promotionnelle ou capsule formation.",
    href: "/order-video",
    button: "Commander une vidéo",
  },
];

const serviceOffers = [
  {
    title: "Flyer animé",
    price: "À partir de 99 €",
    description: "Transformer une affiche ou un événement en vidéo courte.",
  },
  {
    title: "Clip lyrics",
    price: "À partir de 350 €",
    description: "Créer un clip paroles pour une chanson ou une production musicale.",
  },
  {
    title: "Vidéo promotionnelle",
    price: "À partir de 250 €",
    description: "Présenter une formation, un service, un événement ou une entreprise.",
  },
  {
    title: "Capsule formation",
    price: "À partir de 450 €",
    description: "Transformer un contenu pédagogique en vidéo de formation.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="max-w-4xl">
          <p className="mb-5 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            Farozik  Rudyo Video Studio IA
          </p>

          <h1 className="text-4xl font-black tracking-tight md:text-7xl">
            Votre idée devient une vidéo professionnelle.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 md:text-xl">
            Transformez une idée, une chanson, une affiche, une formation ou un
            événement en storyboard, script, prompts vidéo, sous-titres et projet
            vidéo prêt à produire.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/studio"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Créer une vidéo
            </Link>

            <Link
              href="/workspace"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 font-bold text-white hover:border-cyan-400"
            >
              Espace de travail
            </Link>

            <Link
              href="/pricing"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 font-bold text-white hover:border-cyan-400"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {offers.map((offer) => (
            <div
              key={offer.title}
              className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6"
            >
              <h2 className="text-2xl font-black">{offer.title}</h2>
              <p className="mt-4 leading-7 text-slate-300">
                {offer.description}
              </p>
              <Link
                href={offer.href}
                className="mt-6 inline-flex rounded-2xl bg-slate-800 px-5 py-3 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-slate-950"
              >
                {offer.button}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section
        id="offres"
        className="border-y border-slate-800 bg-slate-950/80"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
                Offres Farozik
              </p>
              <h2 className="mt-3 text-3xl font-black md:text-5xl">
                Créez avec lIA ou commandez une vidéo clé en main.
              </h2>
            </div>

            <Link
              href="/pricing"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Voir tous les tarifs
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {serviceOffers.map((offer) => (
              <div
                key={offer.title}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-5"
              >
                <h3 className="text-xl font-black">{offer.title}</h3>
                <p className="mt-3 text-lg font-bold text-cyan-300">
                  {offer.price}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {offer.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
