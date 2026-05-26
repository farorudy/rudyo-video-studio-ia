import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import OrderVideoForm from "@/app/components/OrderVideoForm";

const services = [
  "Flyer anime : 49 a 99 EUR",
  "Vidéo promotionnelle : 149 à 399 EUR",
  "Clip lyrics : 199 a 499 EUR",
  "Clip IA complet : 499 a 1 500 EUR",
  "Capsule de formation : 149 a 499 EUR",
  "Pack reseaux sociaux : 99 a 299 EUR",
];

export default function OrderVideoPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navigation />
      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-24 md:px-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            Service Farozik cle en main
          </p>
          <h1 className="text-4xl font-black md:text-6xl">
            Commandez une video realisee pour vous.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Decrivez votre projet, vos supports et votre date limite. Farozik
            peut transformer votre brief en flyer anime, clip lyrics, video
            promotionnelle ou capsule de formation.
          </p>

          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-2xl font-black">Reperes tarifaires</h2>
            <div className="mt-5 grid gap-3">
              {services.map((service) => (
                <p
                  key={service}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200"
                >
                  {service}
                </p>
              ))}
            </div>
            <Link
              href="/studio"
              className="mt-6 inline-flex rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 font-bold text-cyan-300 hover:border-cyan-400"
            >
              Preparer le brief avec l'IA
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 md:p-8">
          <h2 className="text-3xl font-black">Demande de devis</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Plus le brief est clair, plus le devis et le delai seront precis.
          </p>
          <div className="mt-7">
            <OrderVideoForm />
          </div>
        </div>
      </section>
    </main>
  );
}
