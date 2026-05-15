import Link from "next/link";
import CheckoutButton from "@/app/components/CheckoutButton";
import Navigation from "@/app/components/Navigation";
import { getAllCreditPacks, getAllSubscriptionPlans } from "@/lib/stripe";

const serviceOffers = [
  {
    title: "Flyer anime",
    price: "49 a 99 EUR",
    delivery: "2 a 3 jours",
    included: "Animation courte, texte, musique simple, formats reseaux.",
  },
  {
    title: "Video promotionnelle",
    price: "149 a 399 EUR",
    delivery: "5 a 7 jours",
    included: "Script, montage, voix off IA possible et declinaisons.",
  },
  {
    title: "Clip lyrics",
    price: "199 a 499 EUR",
    delivery: "7 a 10 jours",
    included: "Paroles animees, ambiance visuelle et teaser vertical.",
  },
  {
    title: "Clip IA complet",
    price: "499 a 1 500 EUR",
    delivery: "10 a 21 jours",
    included: "Concept, prompts IA, generation, montage et habillage.",
  },
];

function formatEuros(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export default function PricingPage() {
  const packs = getAllCreditPacks();
  const plans = getAllSubscriptionPlans();

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navigation />
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-24 md:px-8">
        <div className="max-w-4xl">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            Tarifs Rudyo Video Studio IA
          </p>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Commencez gratuitement, payez quand le projet prend de la valeur.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Utilisez des credits pour generer des livrables video, prenez un
            abonnement si vous produisez regulierement, ou confiez la realisation
            a Farozik.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/studio"
              className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
            >
              Essayer le Studio
            </Link>
            <Link
              href="/order-video"
              className="rounded-2xl border border-slate-700 bg-slate-900 px-6 py-4 font-bold text-white hover:border-cyan-400"
            >
              Commander une video
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-14 md:grid-cols-4 md:px-8">
        {packs.map((pack) => (
          <div
            key={pack.id}
            className="rounded-3xl border border-slate-800 bg-slate-950 p-6"
          >
            <h2 className="text-2xl font-black">{pack.name}</h2>
            <p className="mt-3 text-4xl font-black text-cyan-300">
              {formatEuros(pack.amount)}
            </p>
            <p className="mt-2 font-bold text-white">
              {pack.credits.toLocaleString("fr-FR")} credits
            </p>
            <p className="mt-4 min-h-20 text-sm leading-6 text-slate-300">
              {pack.description}
            </p>
            <CheckoutButton productId={pack.id} mode="credit">
              Acheter ce pack
            </CheckoutButton>
          </div>
        ))}
      </section>

      <section className="border-y border-slate-800 bg-slate-950/70">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Abonnements
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Pour produire tous les mois.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-6"
              >
                <h3 className="text-2xl font-black">{plan.name}</h3>
                <p className="mt-3 text-4xl font-black text-cyan-300">
                  {formatEuros(plan.price)}
                  <span className="text-base text-slate-400"> / mois</span>
                </p>
                <p className="mt-3 font-bold text-white">
                  {plan.monthlyLimit.toLocaleString("fr-FR")} credits / mois
                </p>
                <p className="mt-4 min-h-16 text-sm leading-6 text-slate-300">
                  {plan.description}
                </p>
                <CheckoutButton productId={plan.id} mode="subscription">
                  Choisir cet abonnement
                </CheckoutButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Services Farozik
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Besoin d'une video livree cle en main ?
            </h2>
          </div>
          <Link
            href="/order-video"
            className="rounded-2xl bg-cyan-400 px-6 py-4 font-black text-slate-950 hover:bg-cyan-300"
          >
            Demander un devis
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-4">
          {serviceOffers.map((offer) => (
            <div
              key={offer.title}
              className="rounded-3xl border border-slate-800 bg-slate-950 p-6"
            >
              <h3 className="text-xl font-black">{offer.title}</h3>
              <p className="mt-3 text-2xl font-black text-cyan-300">
                {offer.price}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                Livraison : {offer.delivery}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {offer.included}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
