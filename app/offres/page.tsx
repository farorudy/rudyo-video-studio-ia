"use client";
import { useState } from "react";
import Navigation from "../components/Navigation";

async function startCheckout(productId: string) {
  const res = await fetch("/api/billing/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });

  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
    return;
  }

  throw new Error(data.error ?? "Impossible de lancer le paiement.");
}

function StripeButton({
  productId,
  label = "Payer par carte 💳",
  className = "",
}: {
  productId: string;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          setLoading(true);
          await startCheckout(productId);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Erreur de paiement.";
          alert(message);
          setLoading(false);
        }
      }}
      disabled={loading}
      className={`text-center text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-all ${className}`}
    >
      {loading ? "Redirection..." : label}
    </button>
  );
}

export default function OffresPage() {
  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 font-sans">
      <Navigation />
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center mt-16">
        <div className="inline-flex items-center gap-2 bg-purple-900/40 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-6">
          🎬 Rudyo Video Studio IA — crédits internes et abonnements
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
          Achetez des crédits Rudyo ou abonnez-vous pour générer vos storyboards
          IA.
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
          Les crédits Rudyo sont des crédits internes utilisables uniquement sur
          la plateforme Rudyo Video Studio IA. Ils ne constituent pas des
          crédits OpenAI et ne donnent pas accès directement aux services
          OpenAI.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/credits"
            className="inline-block bg-emerald-500 text-slate-950 font-semibold px-8 py-3 rounded-xl transition hover:bg-emerald-400"
          >
            Voir mon solde de crédits
          </a>
          <a
            href="/login"
            className="inline-block bg-slate-900 border border-slate-700 text-white font-semibold px-8 py-3 rounded-xl transition hover:bg-slate-800"
          >
            Se connecter
          </a>
        </div>
      </section>

      {/* Pack vedette */}
      <section className="max-w-4xl mx-auto px-6 mb-16">
        <div className="relative bg-linear-to-br from-purple-900/60 to-pink-900/40 border border-purple-400/40 rounded-2xl p-8 text-center shadow-xl">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-linear-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest">
            ⭐ Offre phare
          </span>
          <h2 className="text-2xl font-bold mb-1">Pack Vidéo IA Express</h2>
          <p className="text-5xl font-extrabold text-white my-4">
            99 <span className="text-2xl text-slate-300">€</span>
          </p>
          <ul className="text-slate-300 space-y-2 text-sm mb-6 max-w-xs mx-auto text-left">
            {[
              "Vidéo animée 30 secondes",
              "Format WhatsApp + Instagram + TikTok",
              "Animation de l'affiche ou visuel",
              "Logo inclus",
              "Sous-titres inclus",
              "Musique libre ou fournie",
              "Livraison MP4 sous 48 h",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span> {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:contact@cipfaro.com?subject=Pack%20Vidéo%20IA%20Express%2099€"
              className="inline-block bg-white text-purple-900 font-bold px-8 py-3 rounded-xl hover:bg-purple-50 transition-all"
            >
              Commander par email
            </a>
            <StripeButton
              productId="express"
              label="Payer par carte 💳 - 99 €"
              className="px-8 py-3 text-base"
            />
          </div>
        </div>
      </section>

      {/* Packs détaillés */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-2xl font-bold text-center mb-10">
          Tous nos services
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {packs.map((pack) => (
            <PackCard key={pack.title} {...pack} />
          ))}
        </div>
      </section>

      {/* Abonnements */}
      <section className="max-w-4xl mx-auto px-6 mb-20">
        <h2 className="text-2xl font-bold text-center mb-3">
          Abonnements mensuels
        </h2>
        <p className="text-center text-slate-400 mb-10 text-sm">
          Pour associations, artistes, centres de formation et commerces qui
          publient régulièrement. Une fois que vous aurez des clients réguliers,
          vous pourrez vendre l’accès à la plateforme Rudyo Video Studio IA en
          abonnement.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {abonnements.map((ab) => (
            <AbonnementCard key={ab.nom} {...ab} />
          ))}
        </div>
      </section>

      {/* Clientèle cible */}
      <section className="max-w-4xl mx-auto px-6 mb-20 text-center">
        <h2 className="text-2xl font-bold mb-8">Pour qui ?</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            "🎵 Artistes & chorales",
            "🎓 Organismes de formation",
            "⛪ Paroisses & associations",
            "🏪 Commerces & indépendants",
            "🗳️ Équipes de campagne",
            "🎪 Organisateurs d'événements",
            "📚 Formateurs Moodle",
            "📣 Petites entreprises",
          ].map((c) => (
            <span
              key={c}
              className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-full text-sm"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold mb-3">Prêt à créer votre vidéo ?</h2>
        <p className="text-slate-400 mb-6">
          Envoyez votre affiche, logo, texte ou musique. Je m'occupe du reste.
        </p>
        <a
          href="mailto:contact@cipfaro.com?subject=Demande%20de%20vidéo%20IA"
          className="inline-block bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold px-10 py-4 rounded-xl transition-all text-lg shadow-lg shadow-purple-900/40"
        >
          Demander un devis gratuit →
        </a>
        <p className="text-slate-500 text-xs mt-4">
          Réponse sous 24 h · Devis gratuit et sans engagement
        </p>
      </section>

      {/* Paiement par virement */}
      <section className="max-w-2xl mx-auto px-6 mb-16">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-md">
          <h3 className="text-lg font-bold text-white mb-1">
            💳 Paiement par virement bancaire (SWIFT)
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Règlement accepté par virement SEPA ou international.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500 font-medium">Titulaire</dt>
            <dd className="text-slate-200 font-semibold">FARO RUDY</dd>

            <dt className="text-slate-500 font-medium">IBAN</dt>
            <dd className="text-slate-200 font-mono tracking-wide">
              FR76 1695 8000 0111 8558 0557 133
            </dd>

            <dt className="text-slate-500 font-medium">BIC / SWIFT</dt>
            <dd className="text-slate-200 font-mono">QNTOFRP1XXX</dd>

            <dt className="text-slate-500 font-medium">Adresse</dt>
            <dd className="text-slate-300 leading-5">
              Rue Coulée Zebsi, beausoleil, 97139 Les abymes
            </dd>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Indiquez votre nom et l'intitulé de la prestation en référence du
            virement. Confirmation sous 24 h après réception.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
        <p>
          <strong className="text-slate-300">Rudyo Video Studio IA</strong> ·
          Vidéos professionnelles express pour artistes, formations et
          événements
        </p>
        <p className="mt-1">
          Propulsé par IA locale · FFmpeg · Ollama · CIP FARO
        </p>
      </footer>
    </main>
  );
}

/* ─── Composants ─────────────────────────────────────────── */

function PackCard({
  emoji,
  title,
  price,
  priceNote,
  items,
  mailto,
  productId,
}: {
  emoji: string;
  title: string;
  price: string;
  priceNote?: string;
  items: string[];
  mailto: string;
  productId: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-6 flex flex-col">
      <div className="text-3xl mb-3">{emoji}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-2xl font-extrabold text-purple-300 mb-0.5">{price}</p>
      {priceNote && <p className="text-xs text-slate-500 mb-3">{priceNote}</p>}
      <ul className="text-slate-400 text-sm space-y-1.5 flex-1 mb-5 mt-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">·</span> {item}
          </li>
        ))}
      </ul>
      <a
        href={`mailto:contact@cipfaro.com?subject=${encodeURIComponent(mailto)}`}
        className="block text-center text-sm font-semibold bg-purple-900/40 hover:bg-purple-800/50 border border-purple-600/40 text-purple-200 px-4 py-2 rounded-lg transition-all"
      >
        Commander par email →
      </a>
      <StripeButton productId={productId} className="w-full mt-2" />
    </div>
  );
}

function AbonnementCard({
  nom,
  prix,
  videos,
  features,
  highlight,
  productId,
}: {
  nom: string;
  prix: string;
  videos: string;
  features: string[];
  highlight?: boolean;
  productId: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 border flex flex-col ${
        highlight
          ? "bg-linear-to-br from-purple-900/60 to-pink-900/40 border-purple-400/50 shadow-lg"
          : "bg-slate-900/60 border-slate-700/60"
      }`}
    >
      <h3 className="font-bold text-lg mb-1">{nom}</h3>
      <p className="text-3xl font-extrabold text-white mb-0.5">{prix}</p>
      <p className="text-xs text-slate-400 mb-4">{videos}</p>
      <ul className="text-slate-300 text-sm space-y-1.5 flex-1 mb-5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span> {f}
          </li>
        ))}
      </ul>
      <a
        href={`mailto:contact@cipfaro.com?subject=Abonnement%20${encodeURIComponent(nom)}%20${encodeURIComponent(prix)}`}
        className={`block text-center text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
          highlight
            ? "bg-white text-purple-900 hover:bg-purple-50"
            : "bg-purple-900/40 hover:bg-purple-800/50 border border-purple-600/40 text-purple-200"
        }`}
      >
        S'abonner par email →
      </a>
      <StripeButton productId={productId} className="w-full mt-2" />
    </div>
  );
}

/* ─── Données ─────────────────────────────────────────────── */

const packs = [
  {
    emoji: "✨",
    title: "Pack Découverte",
    price: "9 €",
    priceNote: "10 crédits Rudyo",
    productId: "rudyo_10",
    items: [
      "Idéal pour tester le storyboard IA",
      "Générations rapides de prompts video",
      "Export PDF et TXT",
      "Clé IA personnelle disponible",
    ],
    mailto: "Pack Découverte 10 crédits",
  },
  {
    emoji: "🚀",
    title: "Pack Créateur",
    price: "39 €",
    priceNote: "50 crédits Rudyo",
    productId: "rudyo_50",
    items: [
      "Pour créateurs réguliers",
      "Storyboards complets et exports avancés",
      "Réserves pour prompts et sous-titres",
      "Accès à la plateforme Rudyo",
    ],
    mailto: "Pack Créateur 50 crédits",
  },
  {
    emoji: "🎬",
    title: "Pack Pro",
    price: "99 €",
    priceNote: "150 crédits Rudyo",
    productId: "rudyo_150",
    items: [
      "Usage intensif IA",
      "Préparation clip complet",
      "Boost pour exports MP4 futurs",
      "Crédits à consommer quand vous voulez",
    ],
    mailto: "Pack Pro 150 crédits",
  },
  {
    emoji: "🏆",
    title: "Pack Studio",
    price: "249 €",
    priceNote: "500 crédits Rudyo",
    productId: "rudyo_500",
    items: [
      "Pour studios et équipes vidéo",
      "Large inventaire de générations IA",
      "Sob-resources pour exports et prompts",
      "Support de plateforme en priorité",
    ],
    mailto: "Pack Studio 500 crédits",
  },
];

const abonnements = [
  {
    nom: "Starter",
    prix: "19 €/mois",
    videos: "20 générations IA / mois",
    productId: "starter_monthly",
    features: [
      "Storyboards simples",
      "Prompts vidéo",
      "Export PDF",
      "Accès logiciel Rudyo",
    ],
  },
  {
    nom: "Créateur",
    prix: "49 €/mois",
    videos: "80 générations IA / mois",
    productId: "createur_monthly",
    features: [
      "Storyboards complets",
      "Prompts Runway / Pika / Sora",
      "Sous-titres",
      "Templates IA",
    ],
    highlight: true,
  },
  {
    nom: "Studio",
    prix: "99 €/mois",
    videos: "200 générations IA / mois",
    productId: "studio_monthly",
    features: [
      "Projets illimités raisonnables",
      "Exports avancés",
      "Support prioritaire",
      "Accès à la plateforme Rudyo IA",
    ],
  },
];
