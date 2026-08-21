"use client";

import { useState } from "react";
import type {
  StoryboardGenerateRequest,
  StoryboardGenerateResponse,
} from "@/lib/ai/generate";
import type { Tone, VisualStyle } from "@/lib/ai/types";

interface AIModeMeta {
  label: string;
  emoji: string;
  description: string;
  color: string;
}

const MODES: Record<string, AIModeMeta> = {
  creative: {
    label: "Mode Créatif",
    emoji: "🎨",
    description: "OpenAI - Rapide, imaginatif et structuré",
    color: "bg-gradient-to-r from-orange-500 to-pink-500",
  },
  expert: {
    label: "Mode Expert",
    emoji: "🧠",
    description: "Claude - Narratif, cohérent et détaillé",
    color: "bg-gradient-to-r from-blue-500 to-cyan-500",
  },
  sovereign: {
    label: "Mode Souverain",
    emoji: "🇫🇷",
    description: "Mistral - Clair, français et RGPD compatible",
    color: "bg-gradient-to-r from-purple-500 to-indigo-500",
  },
};

export function StoryboardGeneratorForm() {
  const [mode, setMode] = useState<"creative" | "expert" | "sovereign">(
    "creative",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StoryboardGenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawJSON, setShowRawJSON] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const request: StoryboardGenerateRequest = {
      mode,
      contentType: "storyboard",
      topic: formData.get("topic") as string,
      objective: formData.get("objective") as string,
      targetAudience: formData.get("targetAudience") as string,
      duration: parseInt(formData.get("duration") as string) || 60,
      format:
        (formData.get("format") as "vertical" | "horizontal" | "square") ||
        "horizontal",
      style: (formData.get("style") as VisualStyle) || "cinéma",
      tone: (formData.get("tone") as Tone) || "professionnel",
      customInstructions: formData.get("instructions") as string,
    };

    try {
      const response = await fetch("/api/ai/storyboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP ${response.status}: Generation failed`,
        );
      }

      const data = (await response.json()) as StoryboardGenerateResponse;
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error("[Form] Error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">
            🎬 Rudyo Storyboard Generator
          </h1>
          <p className="text-slate-400">
            Générez des storyboards professionnels avec OpenAI, Claude ou
            Mistral
          </p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Sidebar */}
          <div className="lg:col-span-1">
            <form
              onSubmit={handleSubmit}
              className="space-y-4 bg-slate-800 rounded-lg p-6 border border-slate-700 sticky top-6"
            >
              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-white">
                  Mode IA
                </label>
                <div className="space-y-2">
                  {Object.entries(MODES).map(([key, meta]) => (
                    <label
                      key={key}
                      className="flex items-start p-3 rounded-lg border-2 cursor-pointer transition-all"
                      style={{
                        borderColor: mode === key ? "#3b82f6" : "#475569",
                        backgroundColor:
                          mode === key ? "#1e293b" : "transparent",
                      }}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={key}
                        checked={mode === key}
                        onChange={(e) => setMode(e.target.value as typeof mode)}
                        className="mt-1"
                      />
                      <div className="ml-3">
                        <div className="font-semibold text-white">
                          {meta.emoji} {meta.label}
                        </div>
                        <div className="text-xs text-slate-400">
                          {meta.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Topic */}
              <div>
                <label
                  htmlFor="topic"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Sujet *
                </label>
                <input
                  id="topic"
                  name="topic"
                  placeholder="Ex: Un tuto sur la photographie de paysage"
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Objective */}
              <div>
                <label
                  htmlFor="objective"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Objectif
                </label>
                <input
                  id="objective"
                  name="objective"
                  placeholder="Ex: Enseigner les bases du cadrage"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label
                  htmlFor="targetAudience"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Public cible
                </label>
                <input
                  id="targetAudience"
                  name="targetAudience"
                  placeholder="Ex: Amateurs en photographie"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Duration */}
              <div>
                <label
                  htmlFor="duration"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Durée (secondes)
                </label>
                <input
                  id="duration"
                  name="duration"
                  type="number"
                  defaultValue="60"
                  min="30"
                  max="600"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Format */}
              <div>
                <label
                  htmlFor="format"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Format
                </label>
                <select
                  id="format"
                  name="format"
                  defaultValue="horizontal"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="horizontal">Horizontal (16:9)</option>
                  <option value="vertical">Vertical (9:16)</option>
                  <option value="square">Carré (1:1)</option>
                </select>
              </div>

              {/* Style */}
              <div>
                <label
                  htmlFor="style"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Style visuel
                </label>
                <select
                  id="style"
                  name="style"
                  defaultValue="cinéma"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="cinéma">Cinéma</option>
                  <option value="documentaire">Documentaire</option>
                  <option value="animation">Animation</option>
                  <option value="motion-design">Motion Design</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>

              {/* Tone */}
              <div>
                <label
                  htmlFor="tone"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Ton
                </label>
                <select
                  id="tone"
                  name="tone"
                  defaultValue="professionnel"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="professionnel">Professionnel</option>
                  <option value="ludique">Ludique</option>
                  <option value="dramatique">Dramatique</option>
                  <option value="informatif">Informatif</option>
                  <option value="inspirant">Inspirant</option>
                </select>
              </div>

              {/* Custom Instructions */}
              <div>
                <label
                  htmlFor="instructions"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Instructions spéciales
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  placeholder="Ajoutez des détails spécifiques..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> Génération en
                    cours...
                  </span>
                ) : (
                  "Générer le storyboard"
                )}
              </button>
            </form>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-red-400 text-xl">❌</span>
                  <div>
                    <h3 className="font-semibold text-red-300">Erreur</h3>
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                {/* Result Header */}
                <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {result.content.project.title}
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        {MODES[mode].emoji} {MODES[mode].label} •{" "}
                        {result.provider.toUpperCase()} •{" "}
                        {result.content.scenes.length} scènes
                      </p>
                    </div>
                    <button
                      onClick={() => setShowRawJSON(!showRawJSON)}
                      className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition"
                    >
                      {showRawJSON ? "Vue tableau" : "JSON"}
                    </button>
                  </div>
                </div>

                {/* Result Content */}
                <div className="p-4 max-h-96 overflow-y-auto">
                  {showRawJSON ? (
                    <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded overflow-x-auto">
                      {JSON.stringify(result.content, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-slate-200 text-sm space-y-4">
                      <div>
                        <h3 className="font-semibold text-white mb-2">
                          📌 Détails du projet
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400">Objectif:</span>
                            <p>{result.content.project.objective}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Public:</span>
                            <p>{result.content.project.targetAudience}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Durée:</span>
                            <p>{result.content.project.recommendedDuration}s</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Format:</span>
                            <p>{result.content.project.recommendedFormat}</p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-700 pt-4">
                        <h3 className="font-semibold text-white mb-3">
                          🎬 Scènes ({result.content.scenes.length})
                        </h3>
                        <div className="space-y-3">
                          {result.content.scenes.map((scene, idx) => (
                            <div
                              key={scene.id}
                              className="bg-slate-700/30 p-3 rounded border border-slate-600"
                            >
                              <div className="font-semibold text-blue-300">
                                Scène {scene.id}: {scene.title}
                              </div>
                              <div className="text-xs mt-2 space-y-1">
                                <p>
                                  <strong className="text-slate-300">
                                    Durée:
                                  </strong>{" "}
                                  {scene.duration}s
                                </p>
                                <p>
                                  <strong className="text-slate-300">
                                    Texte écran:
                                  </strong>{" "}
                                  {scene.onScreenText}
                                </p>
                                <p>
                                  <strong className="text-slate-300">
                                    Voix:
                                  </strong>{" "}
                                  {scene.voiceOver.substring(0, 50)}...
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!result && !loading && !error && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
                <div className="text-5xl mb-4">🎥</div>
                <p className="text-slate-400">
                  Remplissez le formulaire et cliquez sur "Générer le
                  storyboard"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
