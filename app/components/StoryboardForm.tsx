"use client";

import { Copy, Loader2, Wand2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  StoryboardApiResponse,
  StoryboardRequest,
  StoryboardResult,
  VideoType,
} from "@/lib/types";

const videoTypes: Array<{ value: VideoType; label: string }> = [
  { value: "clip_musical", label: "Clip musical" },
  { value: "clip_lyrics", label: "Clip lyrics" },
  { value: "flyer_anime", label: "Flyer anime" },
  { value: "video_promotionnelle", label: "Video promotionnelle" },
];

const initialForm: StoryboardRequest = {
  titre: "",
  typeVideo: "Clip musical",
  duree: "30 secondes",
  format: "9:16 TikTok / Reels / Shorts",
  style: "cinematique moderne",
  langue: "francais",
  publicCible: "",
  nombrePlans: "5",
  description: "",
};

function getErrorMessage(response: StoryboardApiResponse) {
  if (response.success) {
    return "";
  }

  const byCode: Record<string, string> = {
    AUTH_REQUIRED: "Connectez-vous avant de generer un storyboard.",
    INVALID_JSON: "La requete envoyee au serveur est invalide.",
    VALIDATION_ERROR: response.error,
    AI_CONFIG_MISSING: response.error,
    CREDITS_INSUFFICIENTS: response.error,
    AI_EMPTY_RESPONSE: "Le modele IA n'a pas retourne de contenu.",
    AI_INVALID_JSON:
      "La reponse IA n'a pas respecte la structure JSON attendue.",
    SERVER_ERROR: response.error,
  };

  return byCode[response.code] ?? response.error;
}

type SceneListProps = {
  result: StoryboardResult;
  onCopy: (text: string, label: string) => void;
};

function SceneList({ result, onCopy }: SceneListProps) {
  const allPrompts = useMemo(
    () =>
      result.storyboard
        .map(
          (scene) =>
            `Plan ${scene.plan} - ${scene.titre_etape ?? "Scene"}\n${scene.prompt_video_ia}\nNegative prompt: ${scene.negative_prompt ?? ""}`,
        )
        .join("\n\n"),
    [result],
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-emerald-200">
            Storyboard genere
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            {result.titre}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            {result.resume}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-emerald-300/10 px-3 py-2 text-emerald-100">
              {result.type_video}
            </span>
            <span className="rounded-lg bg-sky-300/10 px-3 py-2 text-sky-100">
              {result.format}
            </span>
            <span className="rounded-lg bg-white/10 px-3 py-2 text-slate-200">
              {result.duree_totale}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCopy(allPrompts, "Tous les prompts")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-300 hover:text-slate-950"
        >
          <Copy className="h-4 w-4" />
          Copier les prompts
        </button>
      </div>

      <div className="grid gap-4">
        {result.storyboard.map((scene) => (
          <article
            key={scene.plan}
            className="rounded-lg border border-white/10 bg-slate-950 p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-emerald-200">
                  Plan {scene.plan} / {scene.duree}
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  {scene.titre_etape ?? "Scene"}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {scene.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onCopy(scene.prompt_video_ia, `Prompt du plan ${scene.plan}`)
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-300 hover:text-slate-950"
              >
                <Copy className="h-4 w-4" />
                Copier
              </button>
            </div>

            <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-lg bg-white/[0.04] p-3">
                <dt className="text-slate-500">Camera</dt>
                <dd className="mt-1 text-slate-200">{scene.camera}</dd>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3">
                <dt className="text-slate-500">Texte ecran</dt>
                <dd className="mt-1 text-slate-200">
                  {scene.texte_ecran || "Aucun"}
                </dd>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3">
                <dt className="text-slate-500">Transition</dt>
                <dd className="mt-1 text-slate-200">{scene.transition}</dd>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-3">
                <dt className="text-slate-500">Media / statut</dt>
                <dd className="mt-1 text-slate-200">
                  {scene.type_media} - {scene.statut}
                </dd>
              </div>
            </dl>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
                Prompt video IA
              </p>
              <p className="mt-3 break-words text-sm leading-7 text-slate-200">
                {scene.prompt_video_ia}
              </p>
              {scene.negative_prompt ? (
                <p className="mt-3 break-words text-sm leading-7 text-slate-400">
                  Negative prompt: {scene.negative_prompt}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function StoryboardForm() {
  const [form, setForm] = useState<StoryboardRequest>(initialForm);
  const [selectedType, setSelectedType] = useState<VideoType>("clip_musical");
  const [sessionState, setSessionState] = useState<
    "checking" | "authenticated" | "anonymous"
  >("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [result, setResult] = useState<StoryboardResult | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (active) {
          setSessionState(response.ok ? "authenticated" : "anonymous");
        }
      } catch {
        if (active) {
          setSessionState("anonymous");
        }
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(`${label} copie.`);
    window.setTimeout(() => setCopied(""), 2000);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied("");

    if (sessionState !== "authenticated") {
      setError("Connectez-vous avant de generer un storyboard.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as StoryboardApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data));
      }

      setResult(data.result);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Generation impossible pour le moment.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: keyof StoryboardRequest, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateVideoType(value: VideoType) {
    const label = videoTypes.find((type) => type.value === value)?.label ?? "";
    setSelectedType(value);
    updateField("typeVideo", label);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form
        onSubmit={handleSubmit}
        className="h-fit rounded-lg border border-white/10 bg-[#0c1220] p-5 shadow-2xl shadow-black/30"
      >
        <div>
          <p className="text-sm font-bold text-emerald-200">
            Nouveau storyboard
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Decrivez votre idee video
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Rudyo transforme votre brief en scenes structurees, avec camera,
            texte ecran, rythme, transitions et prompts video IA.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Titre du projet
            </span>
            <input
              value={form.titre}
              onChange={(event) => updateField("titre", event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
              placeholder="Ex: Clip Bod lanme pa lwen"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Idee de video
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              rows={6}
              className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-emerald-300"
              placeholder="Ambiance, lieu, message, paroles, cible, emotion..."
              required
            />
          </label>

          <div>
            <span className="text-sm font-medium text-slate-300">
              Type de video
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {videoTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateVideoType(type.value)}
                  className={[
                    "rounded-lg border px-3 py-3 text-left text-sm font-bold transition",
                    selectedType === type.value
                      ? "border-emerald-300 bg-emerald-300/12 text-emerald-100"
                      : "border-white/10 bg-slate-950 text-slate-300 hover:border-sky-300/70",
                  ].join(" ")}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-300">Duree</span>
              <input
                value={form.duree}
                onChange={(event) => updateField("duree", event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-300">
                Nombre de plans
              </span>
              <input
                value={form.nombrePlans}
                onChange={(event) =>
                  updateField("nombrePlans", event.target.value)
                }
                inputMode="numeric"
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">Format</span>
            <select
              value={form.format}
              onChange={(event) => updateField("format", event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
            >
              <option>9:16 TikTok / Reels / Shorts</option>
              <option>16:9 YouTube</option>
              <option>1:1 Instagram / WhatsApp</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Style visuel
            </span>
            <input
              value={form.style}
              onChange={(event) => updateField("style", event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-300">
                Langue
              </span>
              <input
                value={form.langue}
                onChange={(event) => updateField("langue", event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
              />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-300">
                Public cible
              </span>
              <input
                value={form.publicCible}
                onChange={(event) =>
                  updateField("publicCible", event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-300"
                placeholder="Artistes, clients, apprenants..."
              />
            </label>
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {sessionState === "anonymous" ? (
          <div className="mt-5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
            <p className="font-bold">Connexion requise</p>
            <p className="mt-1">
              La generation consomme des credits Rudyo et necessite une session.
            </p>
            <Link
              href="/login"
              className="mt-3 inline-flex rounded-lg bg-amber-200 px-3 py-2 font-black text-slate-950 hover:bg-amber-100"
            >
              Se connecter
            </Link>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            loading ||
            sessionState !== "authenticated" ||
            !form.titre.trim() ||
            !form.description.trim()
          }
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Wand2 className="h-5 w-5" />
          )}
          {loading
            ? "Generation en cours..."
            : sessionState === "checking"
              ? "Verification de la session..."
              : sessionState === "authenticated"
                ? "Generer le storyboard"
                : "Connexion requise"}
        </button>
      </form>

      <section className="min-h-[640px] rounded-lg border border-white/10 bg-[#0c1220] p-5">
        {copied ? (
          <p className="mb-4 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {copied}
          </p>
        ) : null}

        {result ? (
          <SceneList result={result} onCopy={copyText} />
        ) : (
          <div className="grid min-h-[590px] place-items-center rounded-lg border border-dashed border-white/15 bg-slate-950/70 p-8 text-center">
            <div>
              <Wand2 className="mx-auto h-12 w-12 text-emerald-200" />
              <h2 className="mt-4 text-2xl font-black text-white">
                Le storyboard apparaitra ici
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                La reponse JSON contient un tableau `storyboard`, chaque entree
                representant une scene exploitable par la production.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
