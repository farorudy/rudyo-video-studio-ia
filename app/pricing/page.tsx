import Link from "next/link";
import CheckoutButton from "@/app/components/CheckoutButton";
import Navigation from "@/app/components/Navigation";
import ClipPlanCards from "@/app/components/ClipPlanCards";
import {
  MODEL_CREDIT_CATEGORIES,
  MODEL_CREDIT_CATEGORY_LABELS,
  getModelCreditRatesByCategory,
  type ModelCreditUnit,
} from "@/lib/model-credit-rates";
import {
  getAllCreditPacks,
  getAllSubscriptionPlans,
  getFirstPurchaseBonusTokens,
} from "@/lib/stripe";

const serviceOffers = [
  {
    title: "Flyer anime",
    price: "49 a 99 EUR",
    delivery: "2 a 3 jours",
    included: "Animation courte, texte, musique simple, formats reseaux.",
  },
  {
    title: "Vidéo promotionnelle",
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

const unitLabels: Record<ModelCreditUnit, string> = {
  "per image": "par image",
  "per second": "par seconde",
  "per request": "par requete",
  "per shot": "par plan",
};

export default function PricingPage() {
  const packs = getAllCreditPacks();
  const plans = getAllSubscriptionPlans();
  const firstPurchaseBonus = getFirstPurchaseBonusTokens();

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navigation />
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-24 md:px-8">
        <div className="max-w-4xl">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            Tarifs Rudyo AI
          </p>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Commencez gratuitement, payez quand le projet prend de la valeur.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Achetez des crédits Rudyo pour générer des livrables vidéo, prenez un
            abonnement si vous produisez regulierement, ou confiez la realisation
            à Rudyo AI.
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

      <ClipPlanCards />

      <section className="mx-auto max-w-7xl px-4 pb-14 md:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Packs de crédits Rudyo
            </p>
            <h2 className="mt-2 text-3xl font-black md:text-5xl">
              Recharge securisee par Stripe Checkout.
            </h2>
          </div>
          {firstPurchaseBonus > 0 ? (
            <p className="max-w-sm rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              Bonus premier achat : +{firstPurchaseBonus} crédits Rudyo ajoutés par le
              webhook apres paiement.
            </p>
          ) : null}
        </div>
        <div className="grid gap-5 md:grid-cols-4">
        {packs.map((pack) => (
          <div
            key={pack.id}
            className="group rounded-lg border border-slate-800 bg-slate-950 p-6 transition duration-200 hover:-translate-y-1 hover:border-cyan-400/80 hover:shadow-xl hover:shadow-cyan-950/20"
          >
            <h2 className="text-2xl font-black">{pack.name}</h2>
            <p className="mt-3 text-4xl font-black text-cyan-300">
              {formatEuros(pack.amount)}
            </p>
            <p className="mt-2 font-bold text-white">
              {pack.credits.toLocaleString("fr-FR")} crédits Rudyo
            </p>
            <p className="mt-4 min-h-20 text-sm leading-6 text-slate-300">
              {pack.description}
            </p>
            <CheckoutButton productId={pack.id} mode="credit">
              Acheter ce pack
            </CheckoutButton>
          </div>
        ))}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950/70">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8">
          <div className="mb-8 max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Catalogue credits IA
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Coût par modèle, résolution et unité.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Cette grille sert de référence pour les générations image, vidéo,
              avatar, audio et analyses. Les modèles facturés à la seconde
              respectent leur durée minimale indiquée.
            </p>
          </div>

          <div className="space-y-8">
            {MODEL_CREDIT_CATEGORIES.map((category) => {
              const rates = getModelCreditRatesByCategory(category);

              return (
                <div key={category}>
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <h3 className="text-2xl font-black text-white">
                      {MODEL_CREDIT_CATEGORY_LABELS[category]}
                    </h3>
                    <p className="text-sm font-semibold text-slate-400">
                      {rates.length} modèles / variantes
                    </p>
                  </div>

                  <div className="overflow-x-auto border border-slate-800">
                    <table className="min-w-[760px] w-full border-collapse bg-slate-950 text-left text-sm">
                      <thead className="bg-slate-900 text-xs uppercase tracking-[0.16em] text-slate-400">
                        <tr>
                          <th className="px-4 py-3 font-bold">Modèle</th>
                          <th className="px-4 py-3 font-bold">Résolution</th>
                          <th className="px-4 py-3 text-right font-bold">
                            Crédits
                          </th>
                          <th className="px-4 py-3 font-bold">Unité</th>
                          <th className="px-4 py-3 font-bold">
                            Minimum requis
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {rates.map((rate) => (
                          <tr
                            key={`${rate.category}-${rate.model}-${rate.resolution}`}
                            className="text-slate-200"
                          >
                            <td className="px-4 py-3 font-semibold text-white">
                              {rate.model}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {rate.resolution}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-cyan-300">
                              {rate.credits}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {unitLabels[rate.unit]}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {rate.requirement}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
              Services Rudyo AI
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
