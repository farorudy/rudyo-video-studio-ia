import type { Metadata } from "next";
import Link from "next/link";
import CheckoutButton from "@/app/components/CheckoutButton";
import Navigation from "@/app/components/Navigation";
import { getAllCreditPacks, getFirstPurchaseBonusTokens } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Acheter des crédits | Rudyo AI",
  description: "Rechargez votre compte Rudyo AI avec un pack de crédits sécurisé par Stripe.",
};

function formatEuros(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export default function BuyCreditsPage() {
  const packs = getAllCreditPacks();
  const bonus = getFirstPurchaseBonusTokens();

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navigation />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">Recharge de crédits</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Choisissez votre pack Rudyo.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Paiement unique, sans renouvellement automatique. Les crédits sont ajoutés à votre compte après confirmation sécurisée de Stripe.
            </p>
          </div>
          <Link href="/credits" className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-center text-sm font-bold hover:border-cyan-400">
            Voir mon solde
          </Link>
        </div>

        {bonus > 0 ? (
          <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
            Offre de bienvenue : +{bonus} crédits ajoutés automatiquement lors de votre premier achat.
          </div>
        ) : null}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack, index) => (
            <article
              key={pack.id}
              className={`relative flex flex-col rounded-3xl border p-6 ${index === 1 ? "border-cyan-400 bg-cyan-950/30 shadow-xl shadow-cyan-950/30" : "border-slate-800 bg-slate-950"}`}
            >
              {index === 1 ? (
                <span className="absolute -top-3 left-6 rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-slate-950">Le plus choisi</span>
              ) : null}
              <h2 className="text-2xl font-black">{pack.name}</h2>
              <p className="mt-4 text-4xl font-black text-cyan-300">{formatEuros(pack.amount)}</p>
              <p className="mt-2 text-lg font-bold">{pack.credits.toLocaleString("fr-FR")} crédits</p>
              <p className="mb-6 mt-4 flex-1 text-sm leading-6 text-slate-300">{pack.description}</p>
              <CheckoutButton productId={pack.id} mode="credit" unauthenticatedHref="/inscription">
                Acheter ce pack
              </CheckoutButton>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-4 border-t border-slate-800 pt-8 text-sm text-slate-400 md:grid-cols-3">
          <p><strong className="block text-slate-100">Paiement sécurisé</strong>La carte est traitée directement par Stripe.</p>
          <p><strong className="block text-slate-100">Crédit automatique</strong>Le webhook crédite le compte après paiement confirmé.</p>
          <p><strong className="block text-slate-100">Besoin d’aide ?</strong>Consultez votre historique ou contactez l’équipe Rudyo.</p>
        </div>
      </section>
    </main>
  );
}
