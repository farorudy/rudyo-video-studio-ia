"use client";

import { useMemo, useState } from "react";
import CreditPackCard from "./components/CreditPackCard";
import OfferCard from "./components/OfferCard";
import StoryboardPlanCard from "./components/StoryboardPlanCard";
import ModeCard from "./components/ModeCard";
import VideoTypeCard from "./components/VideoTypeCard";

type VideoTypeValue =
  | "clip"
  | "flyer"
  | "promo"
  | "training"
  | "event"
  | "social";

type ModeValue = "express" | "guided" | "pro";

const videoTypes = [
  {
    icon: "🎵",
    title: "Clip musical",
    description:
      "Créez un storyboard, des prompts vidéo et un clip lyrics ou semi-IA pour votre chanson.",
    value: "clip" as VideoTypeValue,
  },
  {
    icon: "📣",
    title: "Flyer animé",
    description:
      "Transformez votre affiche en vidéo courte pour WhatsApp, TikTok, Instagram et Facebook.",
    value: "flyer" as VideoTypeValue,
  },
  {
    icon: "🎬",
    title: "Vidéo promotionnelle",
    description:
      "Présentez une formation, un service, une entreprise ou un événement.",
    value: "promo" as VideoTypeValue,
  },
  {
    icon: "🎓",
    title: "Capsule formation",
    description:
      "Transformez un cours en vidéo pédagogique prête pour Moodle ou e-learning.",
    value: "training" as VideoTypeValue,
  },
  {
    icon: "📅",
    title: "Vidéo événement",
    description:
      "Annoncez un concert, une conférence, une soirée ou une manifestation.",
    value: "event" as VideoTypeValue,
  },
  {
    icon: "📱",
    title: "Contenu réseaux sociaux",
    description:
      "Créez des vidéos courtes pour TikTok, Reels, Shorts et Facebook.",
    value: "social" as VideoTypeValue,
  },
];

const modes = [
  {
    tag: "Express",
    title: "Mode Express",
    description:
      "Rudyo prépare automatiquement une proposition de vidéo à partir de votre idée.",
    note: "Idéal pour débutants, flyers animés, vidéos rapides.",
    value: "express" as ModeValue,
  },
  {
    tag: "Guidé",
    title: "Mode Guidé",
    description:
      "Vous validez chaque étape : storyboard, prompts, médias, sous-titres et export.",
    note: "Idéal pour artistes, formateurs, projets importants.",
    value: "guided" as ModeValue,
  },
  {
    tag: "Pro / Farozik",
    title: "Mode Pro",
    description:
      "Vous nous confiez le projet et Farozik réalise la vidéo pour vous.",
    note: "Idéal pour clients qui veulent une vidéo clé en main.",
    value: "pro" as ModeValue,
  },
];

const creditPacks = [
  {
    name: "Pack Découverte",
    credits: 10,
    price: "9 €",
    description: "Idéal pour tester le studio.",
  },
  {
    name: "Pack Créateur",
    credits: 50,
    price: "39 €",
    description: "Pour créer plusieurs clips et promos.",
  },
  {
    name: "Pack Pro",
    credits: 150,
    price: "99 €",
    description: "Pour les projets réguliers.",
  },
  {
    name: "Pack Studio",
    credits: 500,
    price: "249 €",
    description: "Pour les créateurs ambitieux.",
  },
];

const projectOffers = [
  {
    title: "Flyer animé",
    price: "99 €",
    duration: "15 à 30 secondes",
    description: "Format WhatsApp / TikTok / Instagram",
  },
  {
    title: "Vidéo promotionnelle",
    price: "250 €",
    duration: "30 à 60 secondes",
    description: "Script + montage + sous-titres",
  },
  {
    title: "Clip lyrics",
    price: "350 €",
    duration: "Paroles animées",
    description: "Fond vidéo ou visuel animé",
  },
  {
    title: "Capsule formation",
    price: "450 €",
    duration: "Pédagogique",
    description: "Script, voix off, sous-titres, compatible Moodle",
  },
];

const projectTimeline = [
  {
    step: "Brouillon",
    summary: "Vous avez commencé le projet et sélectionné les paramètres.",
    status: "Done",
  },
  {
    step: "Storyboard généré",
    summary: "Storyboard et prompts sont prêts à être validés.",
    status: "En cours",
  },
  {
    step: "En attente de médias",
    summary: "Importez ou générez vos médias pour chaque plan.",
    status: "À venir",
  },
  {
    step: "Médias importés",
    summary: "Médias associés et prêts au montage.",
    status: "À venir",
  },
  {
    step: "Vidéo exportée",
    summary: "Export MP4 disponible dans la livraison.",
    status: "À venir",
  },
];

const storyboardPlans = [
  {
    plan: 1,
    duration: "6 secondes",
    description: "Vue du bord de mer au lever du soleil.",
    camera: "Travelling lent vers l’océan.",
    screenText: "Bòd lanmè pa lwen",
    prompt:
      "Cinematic Caribbean seaside in Guadeloupe at sunrise, golden light, calm ocean, emotional music video style",
    transition: "Fondu lent",
    mediaType: "Vidéo IA",
    status: "Prompt prêt",
  },
  {
    plan: 2,
    duration: "5 secondes",
    description: "Le chanteur marche seul près de la mer.",
    camera: "Plan moyen avec mouvement latéral.",
    screenText: "An nou rivé gadé",
    prompt:
      "A Caribbean male singer walking near the ocean, thoughtful mood, realistic cinematic look, soft wind, music video",
    transition: "Cut doux",
    mediaType: "Image / Vidéo",
    status: "À créer",
  },
  {
    plan: 3,
    duration: "7 secondes",
    description: "Gros plan sur les mains et la mélodie.",
    camera: "Travelling sur la guitare.",
    screenText: "Chak pose en vwa",
    prompt:
      "Close-up on hands playing guitar in a warm Caribbean room, intimate music video atmosphere",
    transition: "Dissolve",
    mediaType: "Texte animé",
    status: "Prêt au montage",
  },
];

export default function Home() {
  const [selectedVideoType, setSelectedVideoType] = useState<VideoTypeValue>("clip");
  const [selectedMode, setSelectedMode] = useState<ModeValue>("guided");
  const [userCredits] = useState(18);
  const [creditEstimate] = useState(5);
  const [storyboardGenerated, setStoryboardGenerated] = useState(false);
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [storyboardStage, setStoryboardStage] = useState("Analyse du projet...");

  const hasEnoughCredits = useMemo(
    () => selectedMode !== "pro" && userCredits >= creditEstimate,
    [selectedMode, userCredits, creditEstimate],
  );

  const qualitySummary = useMemo(() => {
    if (selectedMode === "express") return "Rapide et simple";
    if (selectedMode === "guided") return "Contrôle et personnalisation";
    return "Production clé en main";
  }, [selectedMode]);

  const startStoryboard = () => {
    setStoryboardLoading(true);
    setStoryboardStage("Analyse du projet...");

    setTimeout(() => setStoryboardStage("Création des plans..."), 800);
    setTimeout(() => setStoryboardStage("Préparation des prompts vidéo..."), 1600);
    setTimeout(() => {
      setStoryboardStage("Structuration de la timeline...");
      setStoryboardGenerated(true);
    }, 2400);
    setTimeout(() => setStoryboardLoading(false), 3200);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-950 text-white">
      <section className="relative overflow-hidden px-4 py-20 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300">
                Studio vidéo assisté par IA
              </div>
              <h1 className="mt-8 text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
                Votre idée devient une vidéo professionnelle prête à publier.
              </h1>
              <p className="mt-6 text-xl leading-8 text-slate-300">
                Transformez une affiche, une chanson, une formation ou un événement
                en vidéo pour WhatsApp, TikTok, Instagram, Facebook, YouTube ou Moodle.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href="#formulaire"
                  className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-7 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  Créer une vidéo
                </a>
                <a
                  href="#offres"
                  className="inline-flex items-center justify-center rounded-full border border-cyan-500/40 bg-slate-900/90 px-7 py-4 text-sm font-semibold text-cyan-300 transition hover:bg-slate-900"
                >
                  Voir les offres
                </a>
                <a
                  href="#devis"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/90 px-7 py-4 text-sm font-semibold text-slate-300 transition hover:border-cyan-400"
                >
                  Demander un devis
                </a>
              </div>

              <div className="mt-8 rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-6 text-sm text-slate-300">
                <p>
                  3 portes d’entrée : créer soi-même avec des crédits Rudyo, commander une vidéo clé en main ou demander un devis professionnel.
                </p>
              </div>
            </div>

            <div className="grid gap-5 rounded-4xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30 lg:w-[420px]">
              <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Crédits Rudyo</p>
                <p className="mt-4 text-3xl font-semibold text-white">18 crédits disponibles</p>
                <p className="mt-2 text-sm text-slate-400">
                  Utilisez-les pour générer storyboard, prompts, sous-titres et exports.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Offre pro</p>
                <p className="mt-4 text-3xl font-semibold text-cyan-300">Clip Lyrics</p>
                <p className="mt-2 text-sm text-slate-400">350 € — Paroles animées + montage YouTube.</p>
              </div>
              <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Pilier</p>
                <p className="mt-4 text-3xl font-semibold text-white">Votre vidéo est prête</p>
                <p className="mt-2 text-sm text-slate-400">Aucun montage complexe nécessaire.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                badge: "Créer soi-même",
                title: "Crédits Rudyo",
                description: "Générez votre storyboard et vos prompts IA sans quitter la plateforme.",
                cta: "Commencer avec des crédits",
                href: "#formulaire",
              },
              {
                badge: "Commande clé en main",
                title: "Farozik réalise",
                description: "Confiez la création complète et recevez un MP4 livré.",
                cta: "Commander une vidéo",
                href: "#devis",
              },
              {
                badge: "Demande de devis",
                title: "Projet sur mesure",
                description: "Recevez un tarif et un plan de production personnalisé.",
                cta: "Demander un devis",
                href: "#devis",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{item.badge}</p>
                <h3 className="mt-5 text-2xl font-semibold text-white">{item.title}</h3>
                <p className="mt-4 text-slate-400">{item.description}</p>
                <a href={item.href} className="mt-8 inline-flex rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                  {item.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20 sm:py-24" id="formulaire">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Choisissez votre vidéo</p>
            <h2 className="text-4xl font-bold text-white">Choisissez le type de vidéo</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">
              Sélectionnez le format qui correspond à votre projet et passez à la création.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {videoTypes.map((item) => (
              <VideoTypeCard
                key={item.value}
                icon={item.icon}
                title={item.title}
                description={item.description}
                selected={item.value === selectedVideoType}
                onSelect={() => setSelectedVideoType(item.value)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Choix du mode de création</p>
            <h2 className="text-4xl font-bold text-white">Mode de création</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">
              Adoptez le parcours qui correspond à votre confort : Express, Guidé ou Pro.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {modes.map((mode) => (
              <ModeCard
                key={mode.value}
                tag={mode.tag}
                title={mode.title}
                description={mode.description}
                note={mode.note}
                selected={mode.value === selectedMode}
                onSelect={() => setSelectedMode(mode.value)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="flex flex-col gap-4 text-center lg:text-left">
                <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Formulaire projet vidéo</p>
                <h2 className="text-4xl font-bold text-white">Décrivez votre projet</h2>
                <p className="max-w-3xl text-slate-400">
                  Remplissez les informations clés en quelques minutes. Rudyo s'occupe de structurer le reste.
                </p>
              </div>

              <div className="mt-10 space-y-8 rounded-4xl border border-slate-700 bg-slate-900/80 p-8">
                <div className="grid gap-6 lg:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-300">
                    Titre du projet
                    <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Titre de votre vidéo" />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Type de vidéo
                    <select className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400">
                      <option>Clip musical</option>
                      <option>Flyer animé</option>
                      <option>Vidéo promotionnelle</option>
                      <option>Capsule formation</option>
                      <option>Vidéo événement</option>
                      <option>Contenu réseaux sociaux</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <label className="space-y-2 text-sm text-slate-300">
                    Durée souhaitée
                    <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="30s, 45s, 1m" />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Format vidéo
                    <select className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400">
                      <option>9:16 TikTok / Reels / Shorts</option>
                      <option>16:9 YouTube / projection</option>
                      <option>1:1 Instagram / WhatsApp</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Style visuel
                    <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Ciné, moderne, chaleureux" />
                  </label>
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <label>Ambiance</label>
                  <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Émotionnelle, énergique, pédagogique" />
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <label>Décrivez votre vidéo</label>
                  <textarea rows={5} className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-4 text-white outline-none focus:border-cyan-400" placeholder="Expliquez simplement ce que vous voulez montrer. Rudyo structurera le reste." />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-300">
                    Public cible
                    <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Jeunes, clients, apprenants" />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Objectif
                    <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Informer, vendre, fidéliser" />
                  </label>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-300">
                    Appel à l’action final
                    <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="Réservez maintenant, découvrez..." />
                  </label>
                  <label className="space-y-2 text-sm text-slate-300">
                    Langue
                    <select className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400">
                      <option>Français</option>
                      <option>Créole</option>
                      <option>Anglais</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-6 rounded-4xl border border-slate-700 bg-slate-900/80 p-8">
              <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Médias</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {["Affiche", "Logo", "Musique", "Photos", "Vidéos existantes", "Paroles", "Voix off", "Document de formation"].map((media) => (
                    <div key={media} className="rounded-3xl border border-slate-800 bg-slate-900/90 px-4 py-5 text-sm text-slate-300">
                      <p className="font-semibold text-white">{media}</p>
                      <p className="mt-2 text-xs text-slate-500">Import possible plus tard</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Options IA</p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">Nombre de plans souhaité</p>
                    <p className="mt-2 text-cyan-300">8 plans</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">Qualité</p>
                    <p className="mt-2 text-cyan-300">Équilibrée</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">Coût estimé</p>
                    <p className="mt-2 text-cyan-300">{creditEstimate} crédits</p>
                  </div>
                </div>

                <p className="mt-6 text-sm text-slate-400">
                  Les crédits Rudyo sont des crédits internes utilisables uniquement sur la plateforme Rudyo Video Studio IA. Ils ne constituent pas des crédits OpenAI.
                </p>

                <div className="mt-8 flex flex-col gap-3">
                  <button type="button" onClick={startStoryboard} className="rounded-full bg-cyan-500 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                    Générer le storyboard — {creditEstimate} crédits
                  </button>
                  <button className="rounded-full border border-slate-700 px-6 py-4 text-sm font-semibold text-slate-300 transition hover:border-cyan-400">
                    Acheter des crédits
                  </button>
                  <a href="#offres" className="rounded-full border border-cyan-500 px-6 py-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10">
                    Choisir une offre
                  </a>
                </div>

                {!hasEnoughCredits && selectedMode !== "pro" ? (
                  <p className="mt-4 text-sm text-rose-400">Vous n’avez pas assez de crédits pour cette action.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Génération du storyboard</p>
            <h2 className="text-4xl font-bold text-white">Rudyo prépare votre storyboard</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">
              Analyse du projet, création des plans, prompts vidéo et structuration de la timeline.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {["Rudyo prépare votre storyboard…", "Analyse du projet…", "Création des plans…", "Préparation des prompts vidéo…", "Structuration de la timeline…"].map((label, idx) => (
              <div key={label} className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5 text-sm text-slate-300">
                <p className={`font-semibold ${idx === 0 ? "text-cyan-300" : "text-slate-400"}`}>{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-4xl border border-cyan-500/20 bg-slate-900/80 p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Résumé du projet</p>
                <h3 className="mt-2 text-3xl font-semibold text-white">Storyboard en préparation</h3>
              </div>
              <span className="rounded-full bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                {storyboardLoading ? storyboardStage : storyboardGenerated ? "Storyboard prêt" : "Prêt à lancer"}
              </span>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {[
                { label: "Type de vidéo", value: videoTypes.find((item) => item.value === selectedVideoType)?.title || "—" },
                { label: "Mode choisi", value: qualitySummary },
                { label: "Format", value: "16:9 YouTube" },
                { label: "Nombre de plans", value: "8" },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5 text-sm text-slate-300">
                  <p className="font-semibold text-white">{item.label}</p>
                  <p className="mt-2 text-cyan-300">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Storyboard</p>
            <h2 className="text-4xl font-bold text-white">Validation du storyboard</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">
              Chaque plan est présenté avec les prompts, le média attendu et les actions disponibles.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {storyboardPlans.map((plan) => (
              <StoryboardPlanCard key={plan.plan} {...plan} />
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">Actions globales</p>
                <p className="mt-2 text-sm text-slate-400">Copier tous les prompts, exporter le storyboard ou demander une correction IA.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Copier tous les prompts</button>
                <button className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400">Exporter prompts TXT</button>
                <button className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400">Demander une correction IA</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Timeline vidéo</p>
            <h2 className="text-4xl font-bold text-white">Chronologie du projet</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Suivez visuellement l’état du projet de la génération au montage.</p>
          </div>

          <div className="mt-12 space-y-5">
            {projectTimeline.map((item, index) => (
              <div key={item.step} className="grid gap-4 rounded-3xl border border-slate-700 bg-slate-900/80 p-6 sm:grid-cols-[160px_minmax(0,1fr)_120px]">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Étape {index + 1}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{item.step}</h3>
                </div>
                <p className="text-sm leading-6 text-slate-400">{item.summary}</p>
                <span className="inline-flex h-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950/90 px-4 text-xs uppercase tracking-[0.18em] text-slate-300">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Médias</p>
            <h2 className="text-4xl font-bold text-white">Import ou génération média</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Deux options : importer vos fichiers ou utiliser les prompts IA pour créer vos vidéos.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-3xl border border-slate-700 bg-slate-950/90">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Prompt</th>
                  <th className="px-6 py-4">Média attendu</th>
                  <th className="px-6 py-4">Média importé</th>
                  <th className="px-6 py-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { plan: 1, prompt: "Côte caribéenne au lever du soleil", media: "Vidéo IA", imported: "-", status: "Prompt prêt" },
                  { plan: 2, prompt: "Chanteur marchant au bord de l’eau", media: "Image / Vidéo", imported: "-", status: "À créer" },
                  { plan: 3, prompt: "Gros plan mains guitare", media: "Vidéo IA", imported: "-", status: "À créer" },
                ].map((row) => (
                  <tr key={row.plan} className="border-t border-slate-800">
                    <td className="px-6 py-4 text-white">Plan {row.plan}</td>
                    <td className="px-6 py-4">{row.prompt}</td>
                    <td className="px-6 py-4">{row.media}</td>
                    <td className="px-6 py-4">{row.imported}</td>
                    <td className="px-6 py-4 text-cyan-300">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Importer mes médias</button>
            <button className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400">Utiliser les prompts IA</button>
            <button className="rounded-full border border-cyan-500 px-6 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10">Réimporter les vidéos générées</button>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Sous-titres</p>
            <h2 className="text-4xl font-bold text-white">Sous-titres / paroles</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Collez vos paroles, générez des sous-titres et exportez en SRT.</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
              <label className="text-sm font-semibold text-white">Paroles / script voix-off</label>
              <textarea rows={8} className="mt-4 w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-4 text-white outline-none focus:border-cyan-400" placeholder="Bòd lanmè pa lwen\nAn nou rivé gadé\nSi on jou nou ké pé..." />
            </div>
            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-white">Actions</p>
                  <p className="mt-2 text-sm text-slate-400">Générez les sous-titres, exportez la SRT et associez-les à vos plans.</p>
                </div>
                {[
                  "Générer les sous-titres",
                  "Exporter SRT",
                  "Associer aux plans",
                  "Passer au montage",
                ].map((button) => (
                  <button key={button} type="button" className="w-full rounded-full border border-slate-700 bg-slate-900/90 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400 hover:bg-slate-950">
                    {button}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Montage</p>
            <h2 className="text-4xl font-bold text-white">Montage automatique</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Rudyo assemble votre vidéo avec les éléments validés.</p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {["Plans vidéo", "Images", "Logo", "Musique", "Sous-titres", "Format choisi", "Transitions"].map((item) => (
              <div key={item} className="rounded-3xl border border-slate-700 bg-slate-950/90 p-6 text-sm text-slate-300">{item}</div>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-cyan-500/20 bg-slate-950/80 p-8 text-center">
            <p className="text-xl font-semibold text-white">Fonction en préparation</p>
            <p className="mt-4 text-slate-400">Vous pouvez déjà exporter le storyboard, les prompts et les sous-titres.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Préparer le montage</button>
              <button className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400">Créer mon clip MP4</button>
            </div>
          </div>
        </div>
      </section>

      <section id="livraison" className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Livraison</p>
            <h2 className="text-4xl font-bold text-white">Votre vidéo est prête</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Téléchargez le MP4, le storyboard, les prompts et les sous-titres.</p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Télécharger MP4", accent: true },
              { label: "Télécharger PDF storyboard" },
              { label: "Télécharger sous-titres SRT" },
              { label: "Créer une version TikTok" },
              { label: "Créer une version YouTube" },
              { label: "Créer une version WhatsApp" },
            ].map((item) => (
              <button key={item.label} type="button" className={`rounded-3xl border px-6 py-6 text-left text-sm font-semibold transition ${item.accent ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400"}`}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap justify-between gap-4 rounded-3xl border border-cyan-500/20 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-300">Vous souhaitez une correction ou une version pro ? Farozik vous accompagne jusqu’à la livraison finale.</p>
            <a href="#devis" className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Commander une version pro</a>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Après livraison</p>
            <h2 className="text-4xl font-bold text-white">Relance commerciale</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Proposez une version courte, TikTok, voix off, affiche animée ou abonnement.</p>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            {[
              "Créer une version courte",
              "Créer une version TikTok",
              "Commander une voix off",
              "Commander une affiche animée",
              "Prendre un abonnement",
              "Acheter plus de crédits",
            ].map((item) => (
              <button key={item} type="button" className="rounded-full border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-400 hover:bg-slate-950">{item}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Mon espace</p>
            <h2 className="text-4xl font-bold text-white">Tableau de bord client</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Suivez tous vos projets, crédits, exports et demandes de devis.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[
              { title: "Mes projets vidéo", value: "3 projets actifs" },
              { title: "Mes crédits Rudyo", value: "18 crédits disponibles" },
              { title: "Mes exports", value: "2 MP4, 1 PDF" },
              { title: "Mes factures", value: "2 reçues" },
              { title: "Mes demandes de devis", value: "1 en attente" },
              { title: "Abonnement", value: "Starter" },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
                <p className="text-sm text-slate-400">{item.title}</p>
                <p className="mt-4 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Continuer", primary: true },
              { label: "Exporter", primary: false },
              { label: "Commander version pro", primary: false },
            ].map((button) => (
              <button key={button.label} type="button" className={`rounded-full px-6 py-3 text-sm font-semibold transition ${button.primary ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "border border-slate-700 text-slate-300 hover:border-cyan-400"}`}>{button.label}</button>
            ))}
          </div>
        </div>
      </section>

      <section id="offres" className="border-t border-slate-800 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Offres commerciales</p>
            <h2 className="text-4xl font-bold text-white">Offres Farozik</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Des offres claires pour les vidéos rapides, les promos, les clips et les capsules.</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {projectOffers.map((offer) => (
              <OfferCard key={offer.title} {...offer} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-slate-950/90 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Crédits Rudyo</p>
            <h2 className="text-4xl font-bold text-white">Packs de crédits</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Achetez des crédits pour générer storyboard, prompts, sous-titres et montages.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {creditPacks.map((pack) => (
              <CreditPackCard key={pack.name} {...pack} />
            ))}
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              { name: "Starter", price: "19 €/mois", description: "20 générations IA / mois" },
              { name: "Créateur", price: "49 €/mois", description: "80 générations IA / mois" },
              { name: "Studio", price: "99 €/mois", description: "200 générations IA / mois" },
            ].map((plan) => (
              <div key={plan.name} className="rounded-3xl border border-slate-700 bg-slate-900/80 p-8">
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">{plan.name}</p>
                <p className="mt-4 text-4xl font-bold text-cyan-400">{plan.price}</p>
                <p className="mt-4 text-slate-400">{plan.description}</p>
                <button className="mt-8 rounded-full border border-cyan-500 px-6 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10">Choisir</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="devis" className="border-t border-slate-800 px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">Demande de devis</p>
            <h2 className="text-4xl font-bold text-white">Envoyez votre demande</h2>
            <p className="max-w-3xl text-slate-400 mx-auto">Remplissez le formulaire pour obtenir une proposition personnalisée en 24 à 48h.</p>
          </div>

          <form className="mt-12 grid gap-6 lg:grid-cols-2">
            {[
              { label: "Nom", placeholder: "Votre nom" },
              { label: "Prénom", placeholder: "Votre prénom" },
              { label: "Email", placeholder: "email@exemple.com" },
              { label: "Téléphone", placeholder: "+33 6 00 00 00 00" },
              { label: "Type de vidéo souhaitée", placeholder: "Flyer animé, capsule, clip..." },
              { label: "Objectif de la vidéo", placeholder: "Informer, vendre, engager" },
              { label: "Date limite souhaitée", placeholder: "JJ/MM/AAAA" },
              { label: "Budget estimé", placeholder: "Ex : 250 €" },
            ].map((field) => (
              <label key={field.label} className="space-y-2 text-sm text-slate-300">
                {field.label}
                <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder={field.placeholder} />
              </label>
            ))}

            <label className="space-y-2 text-sm text-slate-300 lg:col-span-2">
              Lien vers affiche, logo, musique ou fichier
              <input className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400" placeholder="URL ou description du fichier" />
            </label>

            <label className="space-y-2 text-sm text-slate-300 lg:col-span-2">
              Message complémentaire
              <textarea rows={4} className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-4 text-white outline-none focus:border-cyan-400" placeholder="Expliquez vos besoins, délais, visuels ou ambiance." />
            </label>

            <button className="lg:col-span-2 rounded-full bg-cyan-500 px-8 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">Envoyer ma demande</button>
          </form>
        </div>
      </section>
    </main>
  );
}
