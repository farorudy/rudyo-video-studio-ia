import type { Metadata } from "next";
import Link from "next/link";
import SignupForm from "@/app/inscription/SignupForm";
import { getFirstPurchaseBonusTokens } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Inscription | Rudyo AI",
  description: "Créez gratuitement votre compte Rudyo AI et accédez au studio vidéo.",
};

const benefits = [
  "Compte protégé par vérification e-mail",
  "Crédits centralisés dans votre tableau de bord",
  "Paiement sécurisé avec Stripe Checkout",
  "Historique complet des achats et utilisations",
];

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#020617] px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-cyan-300 hover:text-cyan-200">
          <span aria-hidden="true">←</span> Rudyo AI
        </Link>

        <section className="grid min-h-[calc(100vh-6rem)] gap-12 py-10 lg:grid-cols-[1fr_460px] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
              Inscription gratuite et sans carte bancaire
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
              Créez, financez et suivez vos vidéos IA au même endroit.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Créez votre espace Rudyo en quelques secondes. Après vérification de votre e-mail, vous pourrez choisir un pack de crédits et commencer vos productions.
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm font-semibold text-slate-200">
                  <span className="text-emerald-300" aria-hidden="true">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm text-slate-500">
              Les crédits Rudyo sont des unités internes à la plateforme et ne sont pas des crédits OpenAI.
            </p>
          </div>

          <SignupForm firstPurchaseBonus={getFirstPurchaseBonusTokens()} />
        </section>
      </div>
    </main>
  );
}
