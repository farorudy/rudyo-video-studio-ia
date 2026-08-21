"use client";

import {
  BadgeCheck,
  Clapperboard,
  Copy,
  Download,
  Film,
  Loader2,
  Mic2,
  Music2,
  Play,
  Radio,
  Sparkles,
  Upload,
  Wand2,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import SystemStatus from "@/app/components/SystemStatus";
import type { RudyoUser, StoryboardResult, VideoType } from "@/lib/types";

const videoTypes: Array<{
  id: VideoType;
  title: string;
  description: string;
  icon: typeof Music2;
}> = [
  {
    id: "clip_musical",
    title: "Clip musical",
    description: "Un concept visuel complet pour Suno, Udio, Spotify ou YouTube.",
    icon: Music2,
  },
  {
    id: "clip_lyrics",
    title: "Clip lyrics",
    description: "Paroles, refrains et émotions synchronisés plan par plan.",
    icon: Mic2,
  },
  {
    id: "flyer_anime",
    title: "Flyer animé",
    description: "Une affiche qui devient une vidéo courte pour les réseaux.",
    icon: Sparkles,
  },
  {
    id: "video_promotionnelle",
    title: "Vidéo promo",
    description: "Une offre, une formation ou un événement structuré en vidéo.",
    icon: Clapperboard,
  },
];

const initialProject = {
  titre: "Bod lanme pa lwen",
  description:
    "Créer un clip musical court en Guadeloupe, au bord de mer, avec une ambiance zouk romantique. Le clip montre l'amour, la pluie, le soleil, la mer, l'espoir et le lanbeli.",
  duree: "30 secondes",
  format: "9:16 TikTok / Reels / Shorts",
  style: "cinématique moderne caribéen, lumière naturelle, grain film",
  langue: "français / créole guadeloupéen",
  publicCible: "artistes, chorales, public antillais",
  nombrePlans: "5",
};

const productionSteps = [
  "Brief artiste",
  "Direction visuelle",
  "Storyboard",
  "Prompts IA",
  "Montage MP4",
];

const sampleShots = [
  { label: "Intro", tone: "Mer au lever du soleil", bars: "w-[64%]" },
  { label: "Refrain", tone: "Danse, pluie chaude, émotion", bars: "w-[88%]" },
  { label: "Final", tone: "Lanmou, lanbeli, horizon", bars: "w-[72%]" },
];

export default function HomePage() {
  const [email, setEmail] = useState("rudy.faro@gmail.com");
  const [name, setName] = useState("FARO MIRVAL");
  const [user, setUser] = useState<RudyoUser | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<VideoType>("clip_musical");
  const [project, setProject] = useState(initialProject);
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const selectedTypeLabel = useMemo(
    () => videoTypes.find((type) => type.id === selectedType)?.title ?? "",
    [selectedType],
  );

  const allPrompts =
    storyboard?.storyboard
      .map(
        (plan) =>
          `Plan ${plan.plan} - ${plan.titre_etape || "Scene"}:\n${plan.prompt_video_ia}${
            plan.negative_prompt
              ? `\nNegative prompt: ${plan.negative_prompt}`
              : ""
          }`,
      )
      .join("\n\n") ?? "";

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = await response.json();

        if (!active || !response.ok || !data.success) return;

        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          credits: data.credits,
        });
      } catch {
        // Session absente ou expirée.
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoginLoading(true);

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Connexion impossible.");
      }

      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        credits: data.credits,
      });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Connexion impossible.",
      );
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied("");

    if (!user) {
      setError("Connectez-vous avec votre email avant de générer le storyboard.");
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          ...project,
          typeVideo: selectedTypeLabel,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Génération impossible.");
      }

      setStoryboard(data.result);
      setVideoUrl("");
      setEmailStatus("");

      if (typeof data.creditsUsed === "number") {
        const balanceResponse = await fetch("/api/credits/balance", {
          cache: "no-store",
        });
        const balanceData = await balanceResponse.json();
        if (balanceResponse.ok && balanceData.success) {
          setUser((currentUser) =>
            currentUser
              ? {
                  ...currentUser,
                  credits: balanceData.credits,
                }
              : currentUser,
          );
        }
      }
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Génération impossible.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateVideo() {
    if (!storyboard) {
      setError("Générez un storyboard avant de créer la vidéo.");
      return;
    }

    setError("");
    setEmailStatus("");
    setCreatingVideo(true);

    try {
      const response = await fetch("/api/create-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboard }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Création vidéo impossible.");
      }

      const finalVideoUrl = data.result.dataUrl || data.result.url;
      setVideoUrl(finalVideoUrl);

      const emailResponse = await fetch("/api/send-result-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          to: "rudy.faro@gmail.com",
          title: storyboard.titre,
          videoUrl: finalVideoUrl,
        }),
      });
      const emailData = await emailResponse.json();

      if (!emailResponse.ok || !emailData.success) {
        setEmailStatus(
          emailData.error ??
            "Vidéo créée, mais l'email n'a pas pu être envoyé.",
        );
        return;
      }

      setEmailStatus(`Lien vidéo envoyé à ${emailData.to}.`);
    } catch (videoError) {
      setError(
        videoError instanceof Error
          ? videoError.message
          : "Création vidéo impossible.",
      );
    } finally {
      setCreatingVideo(false);
    }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#05070f] text-slate-100">
      <section className="relative min-h-[92svh] border-b border-white/10">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(8,13,31,0.66),rgba(5,7,15,0.88)),url('/globe.svg')] bg-[length:cover,44rem] bg-[position:center,right_-8rem_top_3rem] bg-no-repeat opacity-90" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05070f] to-transparent" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
          <div className="flex min-h-[82svh] flex-col justify-between">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg border border-emerald-300/40 bg-emerald-300 text-slate-950">
                  <Waves className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-base font-black text-white">
                    Rudyo Video Studio IA
                  </span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    Farozik production
                  </span>
                </span>
              </Link>

              <nav className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-1 text-sm">
                <a className="rounded-md px-3 py-2 text-slate-200" href="#studio">
                  Studio
                </a>
                <Link
                  className="rounded-md px-3 py-2 text-slate-400 hover:text-white"
                  href="/offres"
                >
                  Offres
                </Link>
                <Link
                  className="rounded-md px-3 py-2 text-slate-400 hover:text-white"
                  href="/credits"
                >
                  Crédits
                </Link>
              </nav>
            </header>

            <div className="max-w-4xl py-14 lg:py-20">
              <p className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100">
                <Sparkles className="h-4 w-4" />
                Agent IA pour clips musicaux, lyrics et vidéos courtes
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Transformez un son en clip prêt à produire.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Rudyo analyse votre idée comme un directeur artistique: mood,
                plans, texte écran, caméra, prompts IA et montage MP4. Une
                alternative plus complète pour artistes Suno, Udio, Spotify,
                associations et formations.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#studio"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-200"
                >
                  <Wand2 className="h-5 w-5" />
                  Créer un storyboard
                </a>
                <Link
                  href="/studio"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-5 py-4 font-bold text-white transition hover:bg-white/[0.08]"
                >
                  <Radio className="h-5 w-5" />
                  Ouvrir le studio avancé
                </Link>
              </div>
            </div>

            <div className="grid gap-3 pb-4 sm:grid-cols-3">
              {[
                ["9:16", "Reels, TikTok, Shorts"],
                ["5 plans", "Storyboard exploitable"],
                ["MP4", "Génération et email"],
              ].map(([metric, label]) => (
                <div
                  key={metric}
                  className="rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur"
                >
                  <p className="text-2xl font-black text-white">{metric}</p>
                  <p className="mt-1 text-sm text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="self-center rounded-lg border border-white/10 bg-[#0c1220]/88 p-5 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                  Apercu agent
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  Clip board Rudyo
                </h2>
              </div>
              <Film className="h-7 w-7 text-emerald-200" />
            </div>

            <div className="mt-5 aspect-[9/14] overflow-hidden rounded-lg border border-white/10 bg-slate-950">
              <div className="flex h-full flex-col justify-between bg-[linear-gradient(180deg,rgba(16,185,129,0.12),transparent_32%),linear-gradient(145deg,#101827,#05070f)] p-5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Rudyo timeline</span>
                  <span>00:30</span>
                </div>

                <div className="space-y-4">
                  {sampleShots.map((shot, index) => (
                    <div key={shot.label} className="rounded-lg bg-white/[0.06] p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-white">
                          {index + 1}. {shot.label}
                        </p>
                        <BadgeCheck className="h-4 w-4 text-emerald-200" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {shot.tone}
                      </p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full rounded-full bg-emerald-300 ${shot.bars}`} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4">
                  <p className="text-sm font-bold text-emerald-100">
                    Direction IA prête
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Caméra, lumière, rythme musical, texte écran et prompts
                    vidéo exportables.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section
        id="studio"
        className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8"
      >
        <aside className="space-y-6">
          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-300 text-slate-950">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Session Rudyo</h2>
                <p className="text-sm text-slate-400">
                  Connectez-vous pour générer
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
                  placeholder="rudy.faro@gmail.com"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Nom</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
                  placeholder="FARO MIRVAL"
                />
              </label>
              <button
                type="submit"
                disabled={loginLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-3 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
              >
                {loginLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Se connecter
              </button>
            </form>

            {user ? (
              <div className="mt-5 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4">
                <p className="font-bold text-emerald-100">
                  {user.name || "Utilisateur Rudyo"}
                </p>
                <p className="mt-1 break-all text-sm text-slate-300">
                  {user.email}
                </p>
                <p className="mt-3 text-3xl font-black text-white">
                  {user.credits.balance} crédits
                </p>
              </div>
            ) : null}
          </section>

          <SystemStatus />

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-black text-white">Type de vidéo</h2>
            <div className="mt-4 grid gap-3">
              {videoTypes.map((type) => {
                const Icon = type.icon;
                const selected = selectedType === type.id;

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={[
                      "rounded-lg border p-4 text-left transition",
                      selected
                        ? "border-emerald-300 bg-emerald-300/12"
                        : "border-white/10 bg-slate-950 hover:border-sky-300/70",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={[
                          "mt-1 h-5 w-5",
                          selected ? "text-emerald-200" : "text-sky-200",
                        ].join(" ")}
                      />
                      <div>
                        <p className="font-bold text-white">{type.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-400">
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="space-y-6">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="grid gap-2 sm:grid-cols-5">
              {productionSteps.map((step, index) => (
                <div key={step} className="rounded-lg bg-slate-950 p-3">
                  <p className="text-xs font-bold text-emerald-200">
                    0{index + 1}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleGenerate}
            className="rounded-lg border border-white/10 bg-[#0c1220] p-5 shadow-2xl shadow-black/30"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">Brief video</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Décrivez le son, l'ambiance, le public et le format.
                </p>
              </div>
              <span className="rounded-lg border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-sm font-bold text-sky-100">
                {selectedTypeLabel}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-sm font-medium text-slate-300">
                  Titre du projet
                </span>
                <input
                  value={project.titre}
                  onChange={(event) =>
                    setProject({ ...project, titre: event.target.value })
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
                  required
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-medium text-slate-300">
                  Description artistique
                </span>
                <textarea
                  value={project.description}
                  onChange={(event) =>
                    setProject({ ...project, description: event.target.value })
                  }
                  rows={5}
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-emerald-300"
                  required
                />
              </label>

              {[
                ["duree", "Durée"],
                ["style", "Style visuel"],
                ["langue", "Langue"],
                ["publicCible", "Public cible"],
                ["nombrePlans", "Nombre de plans"],
              ].map(([key, label]) => (
                <label key={key}>
                  <span className="text-sm font-medium text-slate-300">
                    {label}
                  </span>
                  <input
                    value={project[key as keyof typeof project]}
                    onChange={(event) =>
                      setProject({ ...project, [key]: event.target.value })
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
                  />
                </label>
              ))}

              <label>
                <span className="text-sm font-medium text-slate-300">
                  Format
                </span>
                <select
                  value={project.format}
                  onChange={(event) =>
                    setProject({ ...project, format: event.target.value })
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
                >
                  <option>9:16 TikTok / Reels / Shorts</option>
                  <option>16:9 YouTube</option>
                  <option>1:1 Instagram / WhatsApp</option>
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-5 rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={generating || !user}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            >
              {generating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="h-5 w-5" />
              )}
              {generating
              ? "Rudyo prépare votre clip..."
                : user
                  ? "Générer le storyboard"
                  : "Connectez-vous pour générer"}
            </button>
          </form>

          <section className="rounded-lg border border-white/10 bg-[#0c1220] p-5">
            {!storyboard ? (
              <div className="grid min-h-[380px] place-items-center rounded-lg border border-dashed border-white/15 bg-slate-950/70 p-8 text-center">
                <div>
                  <Film className="mx-auto h-12 w-12 text-emerald-200" />
                  <h2 className="mt-4 text-2xl font-black text-white">
                    Le storyboard Rudyo apparaîtra ici
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    Connectez-vous, choisissez un type de vidéo, puis lancez la
                    génération pour obtenir les plans, prompts et intentions de
                    montage.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-white">
                      {storyboard.titre}
                    </h2>
                    <p className="mt-3 max-w-3xl leading-7 text-slate-300">
                      {storyboard.resume}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-lg bg-emerald-300/10 px-3 py-2 text-emerald-100">
                        {storyboard.format}
                      </span>
                      <span className="rounded-lg bg-sky-300/10 px-3 py-2 text-sky-100">
                        {storyboard.style}
                      </span>
                      <span className="rounded-lg bg-white/10 px-3 py-2 text-slate-200">
                        {storyboard.duree_totale}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(allPrompts, "Tous les prompts")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-300 hover:text-slate-950"
                  >
                    <Copy className="h-4 w-4" />
                    Copier tous les prompts
                  </button>
                </div>

                {copied ? (
                  <p className="mt-4 text-sm font-semibold text-emerald-200">
                    {copied} copie.
                  </p>
                ) : null}

                <div className="mt-6 grid gap-4">
                  {storyboard.storyboard.map((plan) => (
                    <article
                      key={plan.plan}
                      className="rounded-lg border border-white/10 bg-slate-950 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-emerald-200">
                            Plan {plan.plan} / {plan.duree}
                          </p>
                          <h3 className="mt-1 text-xl font-black text-white">
                            {plan.titre_etape || "Scène"}
                          </h3>
                          <p className="mt-3 leading-7 text-slate-300">
                            {plan.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              plan.prompt_video_ia,
                              `Prompt du plan ${plan.plan}`,
                            )
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-300 hover:text-slate-950"
                        >
                          <Copy className="h-4 w-4" />
                          Copier
                        </button>
                      </div>

                      <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <dt className="text-slate-500">Caméra</dt>
                          <dd className="mt-1 text-slate-200">{plan.camera}</dd>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <dt className="text-slate-500">Texte écran</dt>
                          <dd className="mt-1 text-slate-200">
                            {plan.texte_ecran || "Aucun"}
                          </dd>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <dt className="text-slate-500">Transition</dt>
                          <dd className="mt-1 text-slate-200">
                            {plan.transition}
                          </dd>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] p-3">
                          <dt className="text-slate-500">Media / statut</dt>
                          <dd className="mt-1 text-slate-200">
                            {plan.type_media} - {plan.statut}
                          </dd>
                        </div>
                        {plan.rythme_musical ? (
                          <div className="rounded-lg bg-white/[0.04] p-3">
                            <dt className="text-slate-500">Rythme musical</dt>
                            <dd className="mt-1 text-slate-200">
                              {plan.rythme_musical}
                            </dd>
                          </div>
                        ) : null}
                        {plan.objectif_pedagogique ? (
                          <div className="rounded-lg bg-white/[0.04] p-3">
                            <dt className="text-slate-500">Objectif</dt>
                            <dd className="mt-1 text-slate-200">
                              {plan.objectif_pedagogique}
                            </dd>
                          </div>
                        ) : null}
                      </dl>

                      {plan.direction_artistique || plan.dialogue ? (
                        <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                          {plan.direction_artistique ? (
                            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                                Direction artistique
                              </p>
                              <p className="mt-3 leading-6 text-slate-200">
                                {plan.direction_artistique}
                              </p>
                            </div>
                          ) : null}
                          {plan.dialogue ? (
                            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
                                Dialogue / intention
                              </p>
                              <p className="mt-3 leading-6 text-slate-200">
                                {plan.dialogue}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
                          Prompt vidéo IA
                        </p>
                        <p className="mt-3 break-words text-sm leading-7 text-slate-200">
                          {plan.prompt_video_ia}
                        </p>
                        {plan.negative_prompt ? (
                          <p className="mt-3 break-words text-sm leading-7 text-slate-400">
                            Negative prompt: {plan.negative_prompt}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-4 py-3 font-bold text-slate-300">
                    <Download className="h-4 w-4" />
                    Export PDF
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-4 py-3 font-bold text-slate-300">
                    <Upload className="h-4 w-4" />
                    Préparer le montage
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateVideo}
                    disabled={creatingVideo}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 font-bold text-emerald-100 disabled:cursor-wait disabled:opacity-70"
                  >
                    {creatingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Film className="h-4 w-4" />
                    )}
                    {creatingVideo ? "Création MP4..." : "Créer mon clip MP4"}
                  </button>
                </div>

                {videoUrl ? (
                  <div className="mt-6 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-4">
                    <p className="font-bold text-emerald-100">Vidéo MP4 créée</p>
                    <video
                      className="mt-4 aspect-video w-full rounded-lg bg-black"
                      src={videoUrl}
                      controls
                    />
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-lg bg-emerald-300 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-200"
                    >
                      Ouvrir la vidéo
                    </a>
                    {emailStatus ? (
                      <p className="mt-3 text-sm text-emerald-100">
                        {emailStatus}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
