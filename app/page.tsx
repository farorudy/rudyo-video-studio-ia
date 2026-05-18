"use client";

import {
  Clapperboard,
  Copy,
  Download,
  Film,
  Loader2,
  Mic2,
  Music2,
  Play,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
    description: "Transformez une chanson en sequence video cinematographique.",
    icon: Music2,
  },
  {
    id: "clip_lyrics",
    title: "Clip lyrics",
    description: "Animez paroles, emotions et refrains avec des prompts IA.",
    icon: Mic2,
  },
  {
    id: "flyer_anime",
    title: "Flyer anime",
    description: "Donnez vie a une affiche, un evenement ou une annonce.",
    icon: Sparkles,
  },
  {
    id: "video_promotionnelle",
    title: "Video promotionnelle",
    description: "Presentez une formation, une offre ou un service en video.",
    icon: Clapperboard,
  },
];

const initialProject = {
  titre: "Bod lanme pa lwen",
  description:
    "Creer un clip video musical court en Guadeloupe, au bord de mer, avec une ambiance zouk romantique. Le clip montre l'amour, la pluie, le soleil, la mer, l'espoir et le lanbeli.",
  duree: "30 secondes",
  format: "9:16 TikTok / Reels / Shorts",
  style: "cinematique moderne caribeen",
  langue: "francais / creole guadeloupeen",
  publicCible: "artistes, chorales, public antillais",
  nombrePlans: "5",
};

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

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = await response.json();

        if (!active || !response.ok || !data.success) {
          return;
        }

        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          credits: data.credits,
        });
      } catch {
        // No active session yet.
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
      setError("Connectez-vous avec votre email avant de generer le storyboard.");
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...project,
          typeVideo: selectedTypeLabel,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Generation impossible.");
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
          : "Generation impossible.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateVideo() {
    if (!storyboard) {
      setError("Generez un storyboard avant de creer la video.");
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
        throw new Error(data.error ?? "Creation video impossible.");
      }

      const finalVideoUrl = data.result.dataUrl || data.result.url;
      setVideoUrl(finalVideoUrl);

      const emailResponse = await fetch("/api/send-result-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            "Video creee, mais l'email n'a pas pu etre envoye.",
        );
        return;
      }

      setEmailStatus(`Lien video envoye a ${emailData.to}.`);
    } catch (videoError) {
      setError(
        videoError instanceof Error
          ? videoError.message
          : "Creation video impossible.",
      );
    } finally {
      setCreatingVideo(false);
    }
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
  }

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

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <section className="relative border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Farozik - Rudyo Video Studio IA
            </p>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Votre idee devient une video.
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl">
              Creez des clips video avec l'IA
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              Transformez une chanson, une idee, une affiche ou une formation
              en storyboard, prompts video, paroles animees et projet de clip
              pret a produire.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-400 text-slate-950">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Connexion Rudyo</h2>
                <p className="text-sm text-slate-400">Session locale simple</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  placeholder="rudy.faro@gmail.com"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Nom facultatif
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  placeholder="FARO MIRVAL"
                />
              </label>
              <button
                type="submit"
                disabled={loginLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
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
              <div className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
                <p className="font-bold text-emerald-200">
                  {user.name || "Utilisateur Rudyo"}
                </p>
                <p className="mt-1 break-all text-sm text-slate-300">
                  {user.email}
                </p>
                <p className="mt-3 text-2xl font-black text-white">
                  {user.credits.balance} credits Rudyo
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
            <h2 className="text-lg font-bold">Type de video</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {videoTypes.map((type) => {
                const Icon = type.icon;
                const selected = selectedType === type.id;

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`rounded-lg border p-4 text-left transition ${
                      selected
                        ? "border-cyan-300 bg-cyan-400/15"
                        : "border-slate-800 bg-slate-950 hover:border-violet-400"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`mt-1 h-5 w-5 ${
                          selected ? "text-cyan-200" : "text-violet-300"
                        }`}
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
          <form
            onSubmit={handleGenerate}
            className="rounded-lg border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/40"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Projet video</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Decrivez l'idee, Rudyo prepare le storyboard et les prompts.
                </p>
              </div>
              <span className="rounded-lg border border-violet-400/40 bg-violet-400/10 px-3 py-2 text-sm font-semibold text-violet-200">
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
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                  required
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-medium text-slate-300">
                  Description
                </span>
                <textarea
                  value={project.description}
                  onChange={(event) =>
                    setProject({ ...project, description: event.target.value })
                  }
                  rows={5}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-cyan-400"
                  required
                />
              </label>

              {[
                ["duree", "Duree"],
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
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
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
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400"
                >
                  <option>9:16 TikTok / Reels / Shorts</option>
                  <option>16:9 YouTube</option>
                  <option>1:1 Instagram / WhatsApp</option>
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={generating || !user}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            >
              {generating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="h-5 w-5" />
              )}
              {generating
                ? "Rudyo prepare votre clip..."
                : user
                  ? "Generer le storyboard"
                  : "Connectez-vous pour generer"}
            </button>
          </form>

          <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
            {!storyboard ? (
              <div className="grid min-h-[360px] place-items-center rounded-lg border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center">
                <div>
                  <Film className="mx-auto h-12 w-12 text-cyan-300" />
                  <h2 className="mt-4 text-2xl font-black">
                    Votre storyboard apparaitra ici
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    Connectez-vous, choisissez un type de video, puis lancez la
                    generation pour obtenir les plans et prompts video IA.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-3xl font-black">{storyboard.titre}</h2>
                    <p className="mt-3 max-w-3xl leading-7 text-slate-300">
                      {storyboard.resume}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                      <span className="rounded-lg bg-cyan-400/10 px-3 py-2 text-cyan-200">
                        {storyboard.format}
                      </span>
                      <span className="rounded-lg bg-violet-400/10 px-3 py-2 text-violet-200">
                        {storyboard.style}
                      </span>
                      <span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-emerald-200">
                        {storyboard.duree_totale}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(allPrompts, "Tous les prompts")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-400 hover:text-slate-950"
                  >
                    <Copy className="h-4 w-4" />
                    Copier tous les prompts
                  </button>
                </div>

                {copied ? (
                  <p className="mt-4 text-sm font-semibold text-emerald-300">
                    {copied} copie.
                  </p>
                ) : null}

                <div className="mt-6 grid gap-4">
                  {storyboard.storyboard.map((plan) => (
                    <article
                      key={plan.plan}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-xl font-black">
                            Plan {plan.plan} -{" "}
                            {plan.titre_etape || plan.duree}
                          </h3>
                          {plan.titre_etape ? (
                            <p className="mt-1 text-sm font-semibold text-cyan-300">
                              {plan.duree}
                            </p>
                          ) : null}
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
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-400 hover:text-slate-950"
                        >
                          <Copy className="h-4 w-4" />
                          Copier
                        </button>
                      </div>
                      <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-slate-500">Camera</dt>
                          <dd className="mt-1 text-slate-200">{plan.camera}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Texte ecran</dt>
                          <dd className="mt-1 text-slate-200">
                            {plan.texte_ecran || "Aucun"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Transition</dt>
                          <dd className="mt-1 text-slate-200">
                            {plan.transition}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Media / statut</dt>
                          <dd className="mt-1 text-slate-200">
                            {plan.type_media} - {plan.statut}
                          </dd>
                        </div>
                        {plan.rythme_musical ? (
                          <div>
                            <dt className="text-slate-500">
                              Rythme musical
                            </dt>
                            <dd className="mt-1 text-slate-200">
                              {plan.rythme_musical}
                            </dd>
                          </div>
                        ) : null}
                        {plan.objectif_pedagogique ? (
                          <div>
                            <dt className="text-slate-500">
                              Objectif
                            </dt>
                            <dd className="mt-1 text-slate-200">
                              {plan.objectif_pedagogique}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                      {plan.direction_artistique || plan.dialogue ? (
                        <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                          {plan.direction_artistique ? (
                            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                                Direction artistique
                              </p>
                              <p className="mt-3 leading-6 text-slate-200">
                                {plan.direction_artistique}
                              </p>
                            </div>
                          ) : null}
                          {plan.dialogue ? (
                            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                                Dialogue / intention
                              </p>
                              <p className="mt-3 leading-6 text-slate-200">
                                {plan.dialogue}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
                          Prompt video IA
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
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-slate-300">
                    <Download className="h-4 w-4" />
                    Export PDF
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-slate-300">
                    <Upload className="h-4 w-4" />
                    Preparer le montage
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateVideo}
                    disabled={creatingVideo}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-4 py-3 font-bold text-emerald-200 disabled:cursor-wait disabled:opacity-70"
                  >
                    {creatingVideo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Film className="h-4 w-4" />
                    )}
                    {creatingVideo ? "Creation MP4..." : "Creer mon clip MP4"}
                  </button>
                </div>

                {videoUrl ? (
                  <div className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
                    <p className="font-bold text-emerald-200">
                      Video MP4 creee
                    </p>
                    <video
                      className="mt-4 aspect-video w-full rounded-lg bg-black"
                      src={videoUrl}
                      controls
                    />
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-300"
                    >
                      Ouvrir la video
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
      </div>
    </main>
  );
}
