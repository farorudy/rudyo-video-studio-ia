import Link from "next/link";

const creditPacks = [
  {
    name: "Découverte",
    credits: "10 crédits",
    price: "5 €",
    description: "Idéal pour tester Rudyo.",
  },
  {
    name: "Créateur",
    credits: "50 crédits",
    price: "19 €",
    description: "Pour créer plusieurs storyboards, scripts et prompts.",
  },
  {
    name: "Pro",
    credits: "150 crédits",
    price: "49 €",
    description: "Pour artistes, formateurs et associations.",
  },
  {
    name: "Studio",
    credits: "500 crédits",
    price: "149 €",
    description: "Pour un usage régulier ou professionnel.",
  },
];

const services = [
  {
    title: "Flyer animé",
    price: "À partir de 99 €",
    description:
      "Transformez une affiche, un événement ou une annonce en vidéo courte prête pour WhatsApp, Instagram ou Facebook.",
  },
  {
    title: "Vidéo promotionnelle",
    price: "À partir de 250 €",
    description:
      "Présentez une formation, un service, une entreprise, une association ou un événement.",
  },
  {
    title: "Clip lyrics",
    price: "À partir de 350 €",
    description:
      "Créez un clip paroles pour une chanson avec ambiance, textes animés et structure vidéo.",
  },
  {
    title: "Capsule formation",
    price: "À partir de 450 €",
    description:
      "Transformez un cours ou un module pédagogique en vidéo de formation professionnelle.",
  },
];

export default function OffresPage() {
  return (
    <main className="min-h-screen bg-[#020617] px-4 py-10 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-12 rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 md:p-12">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            Offres Rudyo & Farozik
          </p>

          <h1 className="max-w-4xl text-4xl font-black md:text-6xl">
            Créez avec vos crédits ou commandez une vidéo clé en main.
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Rudyo vous permet de créer vous-même avec lIA, mais Farozik peut
            aussi réaliser votre vidéo complète : flyer animé, clip lyrics,
            vidéo promotionnelle ou capsule de formation.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/studio"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Créer avec mes crédits
            </Link>
            <Link
              href="/workspace"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 font-bold text-white hover:border-cyan-400"
            >
              Mon espace de travail
            </Link>
          </div>
        </section>

        <section className="mb-14">
          <div className="mb-6">
            <h2 className="text-3xl font-black">Packs de crédits</h2>
            <p className="mt-2 text-slate-400">
              Utilisez les crédits pour générer storyboards, scripts, prompts,
              sous-titres et projets vidéo.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {creditPacks.map((pack) => (
              <div
                key={pack.name}
                className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6"
              >
                <h3 className="text-2xl font-black">{pack.name}</h3>
                <p className="mt-3 text-3xl font-black text-cyan-300">
                  {pack.price}
                </p>
                <p className="mt-2 font-bold text-white">{pack.credits}</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {pack.description}
                </p>
                <button className="mt-6 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 hover:bg-cyan-300">
                  Acheter ce pack
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-black">Services clé en main</h2>
            <p className="mt-2 text-slate-400">
              Pour les clients qui veulent une vidéo réalisée par Farozik.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {services.map((service) => (
              <div
                key={service.title}
                className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6"
              >
                <h3 className="text-2xl font-black">{service.title}</h3>
                <p className="mt-3 text-2xl font-black text-cyan-300">
                  {service.price}
                </p>
                <p className="mt-4 leading-7 text-slate-300">
                  {service.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/studio"
                    className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
                  >
                    Préparer avec Rudyo
                  </Link>
                  <Link
                    href="/#contact"
                    className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 font-bold text-white hover:border-cyan-400"
                  >
                    Demander un devis
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
