"use client";
import { useState } from "react";

async function startCheckout(productId: string) {
  const res = await fetch("/api/checkout", {
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
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-900/40 border border-purple-500/30 rounded-full px-4 py-1.5 text-sm text-purple-300 mb-6">
          🎬 Studio IA propulsé par FFmpeg &amp; Ollama
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-4">
          Votre idée devient une{" "}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-500">
            vidéo prête à publier
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
          Concerts, formations, associations, artistes, commerces, événements —
          envoyez votre affiche, texte ou musique. Je vous livre une vidéo
          professionnelle en MP4.
        </p>
        <a
          href="mailto:contact@cipfaro.com?subject=Demande%20de%20vidéo%20IA"
          className="inline-block bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-purple-900/40"
        >
          Demander un devis gratuit →
        </a>
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
          publient régulièrement.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {abonnements.map((ab) => (
            <AbonnementCard key={ab.nom} {...ab} />
          ))}
        </div>
      </section>

      {/* Credits iApwsh */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-2xl font-bold text-center mb-3">
          Achats de credit iApwsh
        </h2>
        <p className="text-center text-slate-400 mb-10 text-sm">
          Rechargez vos credits iApwsh pour commander vos prochaines creations.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {creditsIapwsh.map((credit) => (
            <div
              key={credit.productId}
              className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-6"
            >
              <p className="text-xs uppercase tracking-wide text-emerald-300 mb-2">
                Credits iApwsh
              </p>
              <h3 className="text-lg font-bold text-white mb-1">
                {credit.title}
              </h3>
              <p className="text-3xl font-extrabold text-white mb-2">
                {credit.price}
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {credit.description}
              </p>
              <StripeButton productId={credit.productId} className="w-full" />
            </div>
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
    emoji: "🎪",
    title: "Flyer animé événement",
    price: "à partir de 39 €",
    priceNote: "15 sec · 39 € — 30 sec · 79 €",
    productId: "flyer",
    items: [
      "Animation de votre affiche",
      "Musique de fond",
      "Logo + sous-titres",
      "Formats WhatsApp / Instagram / TikTok",
    ],
    mailto: "Pack Flyer animé événement",
  },
  {
    emoji: "🎓",
    title: "Vidéo promo formation",
    price: "à partir de 120 €",
    priceNote: "30 sec · 120–180 € — 1 min · 250–350 €",
    productId: "promo",
    items: [
      "Script professionnel",
      "Voix off",
      "Visuels + logo",
      "Sous-titres + appel à l'action",
    ],
    mailto: "Pack Vidéo promo formation",
  },
  {
    emoji: "🎤",
    title: "Clip lyrics créole / français",
    price: "à partir de 250 €",
    priceNote: "Clip paroles animé · 250–500 €",
    productId: "lyrics",
    items: [
      "Fond animé",
      "Paroles synchronisées",
      "Logo artiste",
      "Export HD MP4",
    ],
    mailto: "Pack Clip lyrics",
  },
  {
    emoji: "🎬",
    title: "Storyboard clip musical",
    price: "à partir de 80 €",
    priceNote: "Storyboard PDF · 80–150 €",
    productId: "storyboard",
    items: [
      "20 à 30 plans décrits",
      "Prompts Runway / Pika / Sora",
      "Structure musicale intelligente",
      "Livraison PDF + JSON",
    ],
    mailto: "Pack Storyboard clip musical",
  },
  {
    emoji: "📚",
    title: "Capsule pédagogique Moodle",
    price: "à partir de 250 €",
    priceNote: "2-3 min · 250–450 € — 5-8 min · 600–1 200 €",
    productId: "moodle",
    items: [
      "Script pédagogique",
      "Voix off + visuels",
      "Sous-titres",
      "Quiz associé + intégration Moodle",
    ],
    mailto: "Pack Capsule pédagogique Moodle",
  },
  {
    emoji: "🎥",
    title: "Clip semi-IA complet",
    price: "à partir de 500 €",
    priceNote: "1 min · 500–900 € — 3 min · 1 200–2 500 €",
    productId: "clip",
    items: [
      "Storyboard + plans IA",
      "Montage professionnel",
      "Grading cinématique",
      "Paroles animées + musique",
    ],
    mailto: "Pack Clip semi-IA complet",
  },
];

const abonnements = [
  {
    nom: "Starter",
    prix: "99 €/mois",
    videos: "2 vidéos courtes / mois",
    productId: "starter",
    features: [
      "2 vidéos 15–30 sec",
      "Formats réseaux inclus",
      "Logo + sous-titres",
    ],
  },
  {
    nom: "Pro",
    prix: "249 €/mois",
    videos: "6 vidéos / mois",
    productId: "pro",
    features: [
      "6 vidéos jusqu'à 60 sec",
      "Sous-titres inclus",
      "Formats réseaux",
      "Priorité 24 h",
    ],
    highlight: true,
  },
  {
    nom: "Premium",
    prix: "499 €/mois",
    videos: "12 vidéos / mois",
    productId: "premium",
    features: [
      "12 vidéos + montage avancé",
      "Stratégie de contenu",
      "Clips lyrics inclus",
      "Suivi dédié",
    ],
  },
];

const creditsIapwsh = [
  {
    title: "Pack 50 credits",
    price: "10 €",
    description: "Pour petits tests et generations rapides.",
    productId: "iapwsh_50",
  },
  {
    title: "Pack 150 credits",
    price: "25 €",
    description: "Le meilleur compromis pour usage regulier.",
    productId: "iapwsh_150",
  },
  {
    title: "Pack 400 credits",
    price: "60 €",
    description: "Pour la production intensive et les equipes.",
    productId: "iapwsh_400",
  },
];
