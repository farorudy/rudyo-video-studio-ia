"use client";

import { useMemo, useState } from "react";
import {
  CREDIT_COSTS,
  CREDIT_TOOL_DESCRIPTIONS,
  CREDIT_TOOL_LABELS,
  CREDIT_TOOLS,
  type CreditTool,
} from "@/lib/credit-costs";
import { ModelCard } from "@/components/ModelCard";
import { StepProgress } from "@/components/StepProgress";

type GenerationResult = {
  success: boolean;
  provider?: string;
  result?: string;
  error?: string;
  redirectTo?: string;
  requiredCredits?: number;
  currentCredits?: number;
};

export default function StudioPage() {
  const [selectedTool, setSelectedTool] = useState<CreditTool>("storyboard");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30 secondes");
  const [style, setStyle] = useState("cinématique moderne");
  const [audience, setAudience] = useState("");
  const [platform, setPlatform] = useState("TikTok / Reels / Shorts");
  const [language, setLanguage] = useState("français");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const fakeCreditBalance = 18;

  const selectedCost = CREDIT_COSTS[selectedTool];
  const hasEnoughCredits = fakeCreditBalance >= selectedCost;

  const currentStep = useMemo(() => {
    if (result?.success) return 4;
    if (loading) return 3;
    if (!hasEnoughCredits) return 2;
    if (selectedTool) return 2;
    return 0;
  }, [result, loading, hasEnoughCredits, selectedTool]);

  async function handleGenerate() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool: selectedTool,
          input: {
            title,
            description,
            duration,
            style,
            audience,
            platform,
            language,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          error: data.error || "Erreur lors de la génération.",
          redirectTo: data.redirectTo,
          requiredCredits: data.requiredCredits,
          currentCredits: data.currentCredits,
        });
        return;
      }

      setResult(data);
    } catch {
      setResult({
        success: false,
        error: "Impossible de contacter le serveur IA.",
      });
    } finally {
      setLoading(false);
    }
  }

  function copyResult() {
    if (!result?.result) return;
    navigator.clipboard.writeText(result.result);
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
                Rudyo Video Studio IA
              </p>

              <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
                Votre idée devient une vidéo.
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Choisissez un modèle, utilisez vos crédits Rudyo, puis générez
                un storyboard, un script, des prompts vidéo, des sous-titres ou
                un projet de clip complet.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200">
                  Storyboard IA
                </span>
                <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200">
                  Prompts vidéo
                </span>
                <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200">
                  Sous-titres
                </span>
                <span className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-200">
                  Clip lyrics
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-400/30 bg-slate-900 p-6">
              <p className="text-sm text-slate-400">Crédits disponibles</p>
              <p className="mt-2 text-5xl font-black text-cyan-300">
                {fakeCreditBalance}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                Vos crédits servent à générer vos contenus IA.
              </p>
              <a
                href="/credits"
                className="mt-5 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300"
              >
                Acheter des crédits
              </a>
            </div>
          </div>
        </section>

        <div className="mb-8">
          <StepProgress currentStep={currentStep} />
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-black">1. Choisissez un modèle</h2>
              <p className="mt-2 text-slate-400">
                Vidmusic génère un clip. Rudyo prépare tout votre projet vidéo :
                storyboard, script, prompts, sous-titres et organisation.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {CREDIT_TOOLS.map((tool) => (
                <ModelCard
                  key={tool}
                  tool={tool}
                  title={CREDIT_TOOL_LABELS[tool]}
                  description={CREDIT_TOOL_DESCRIPTIONS[tool]}
                  credits={CREDIT_COSTS[tool]}
                  selected={selectedTool === tool}
                  onSelect={setSelectedTool}
                />
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-[2rem] border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-2xl font-black">2. Préparez votre projet</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Titre du projet
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Clip Bòd lanmè pa lwen"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez votre idée, chanson, affiche, formation ou événement..."
                  rows={6}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    Durée
                  </label>
                  <input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    Langue
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                  >
                    <option>français</option>
                    <option>créole guadeloupéen</option>
                    <option>anglais</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Style visuel
                </label>
                <input
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Public cible
                </label>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex : artistes, associations, centres de formation"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Plateforme
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  <option>TikTok / Reels / Shorts</option>
                  <option>YouTube 16:9</option>
                  <option>Instagram 1:1</option>
                  <option>WhatsApp</option>
                  <option>Moodle / formation</option>
                </select>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <p className="text-slate-300">Modèle choisi</p>
                <p className="font-bold text-cyan-300">
                  {CREDIT_TOOL_LABELS[selectedTool]}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-slate-300">Coût</p>
                <p className="font-bold text-white">{selectedCost} crédits</p>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-slate-300">Solde après génération</p>
                <p
                  className={[
                    "font-bold",
                    hasEnoughCredits ? "text-emerald-300" : "text-red-300",
                  ].join(" ")}
                >
                  {fakeCreditBalance - selectedCost} crédits
                </p>
              </div>
            </div>

            {!hasEnoughCredits ? (
              <a
                href="/credits"
                className="mt-6 flex w-full justify-center rounded-2xl bg-emerald-400 px-5 py-4 text-center font-black text-slate-950 hover:bg-emerald-300"
              >
                Acheter des crédits
              </a>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !description.trim()}
                className="mt-6 w-full rounded-2xl bg-cyan-400 px-5 py-4 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Rudyo prépare votre contenu..."
                  : "Lancer la génération"}
              </button>
            )}

            <div className="mt-5 space-y-2 text-sm text-slate-400">
              <p>✓ Votre clé OpenAI ou Mistral n’est pas nécessaire.</p>
              <p>✓ Rudyo utilise l’IA côté serveur.</p>
              <p>✓ Les crédits sont débités au moment de la génération.</p>
              <p>✓ Si la génération échoue, les crédits sont recrédités.</p>
            </div>
          </aside>
        </section>

        {result && (
          <section className="mt-10 rounded-[2rem] border border-slate-800 bg-slate-950 p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black">Résultat IA</h2>
                <p className="mt-2 text-slate-400">
                  Résultat généré par Rudyo Video Studio IA.
                </p>
              </div>

              {result.success && (
                <button
                  type="button"
                  onClick={copyResult}
                  className="rounded-2xl bg-slate-800 px-5 py-3 font-bold text-cyan-300 hover:bg-slate-700"
                >
                  Copier le résultat
                </button>
              )}
            </div>

            {!result.success ? (
              <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-950/40 p-5 text-red-200">
                <p className="font-bold">Erreur</p>
                <p className="mt-2">{result.error}</p>

                {result.redirectTo && (
                  <a
                    href={result.redirectTo}
                    className="mt-4 inline-flex rounded-xl bg-red-300 px-4 py-2 font-bold text-red-950"
                  >
                    Continuer
                  </a>
                )}
              </div>
            ) : (
              <pre className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm leading-7 text-slate-100">
                {result.result}
              </pre>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
