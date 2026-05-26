"use client";

import { useState } from "react";

type StoryboardPlan = {
  plan: number;
  duree: string;
  description: string;
  camera: string;
  texte_ecran: string;
  prompt_video_ia: string;
  transition: string;
};

type StoryboardResultProps = {
  titre: string;
  type_video: string;
  format: string;
  style: string;
  duree_totale: string;
  resume: string;
  storyboard: StoryboardPlan[];
  onCopyPrompt?: (prompt: string) => void;
  onCopyAllPrompts?: () => void;
  onExportPDF?: () => void;
  onPrepareEditing?: () => void;
};

export default function StoryboardResult({
  titre,
  type_video,
  format,
  style,
  duree_totale,
  resume,
  storyboard,
  onCopyPrompt,
  onCopyAllPrompts,
  onExportPDF,
  onPrepareEditing,
}: StoryboardResultProps) {
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);

  const handleCopyPrompt = (planId: number, prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(planId);
    onCopyPrompt?.(prompt);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 mb-6">
            <span className="text-sm font-semibold text-emerald-400">
              Storyboard généré
            </span>
          </div>

          <h2 className="text-4xl font-bold text-white mb-4">{titre}</h2>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl">{resume}</p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Type", value: type_video },
              { label: "Format", value: format },
              { label: "Style", value: style },
              { label: "Durée", value: duree_totale },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-slate-800/50 border border-slate-700 p-4"
              >
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                  {item.label}
                </div>
                <div className="text-sm font-semibold text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onCopyAllPrompts}
              className="px-6 py-3 rounded-lg border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-all"
            >
              Copier tous les prompts
            </button>
            <button
              onClick={onExportPDF}
              className="px-6 py-3 rounded-lg border border-slate-600 bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-all"
            >
              Exporter en PDF
            </button>
            <button
              onClick={onPrepareEditing}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              Préparer mon montage
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-white mb-6">
            Les {storyboard.length} plans
          </h3>

          {storyboard.map((plan) => (
            <div
              key={plan.plan}
              className="rounded-xl border border-slate-700 bg-slate-900/50 overflow-hidden hover:border-slate-600 transition-all"
            >
              {/* Plan Header */}
              <button
                onClick={() =>
                  setExpandedPlan(expandedPlan === plan.plan ? null : plan.plan)
                }
                className="w-full text-left p-6 flex items-start justify-between hover:bg-slate-900 transition-all"
              >
                <div className="flex gap-4 flex-1">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-cyan-400">
                        #{plan.plan}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-white">
                        {plan.description}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-800 text-xs text-slate-300">
                        {plan.duree}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400">
                      <strong>Caméra:</strong> {plan.camera} •{" "}
                      <strong>Transition:</strong> {plan.transition}
                    </div>
                  </div>
                </div>
                <div className="text-slate-400 ml-4">
                  {expandedPlan === plan.plan ? "Masquer" : "Voir"}
                </div>
              </button>

              {/* Expanded Content */}
              {expandedPlan === plan.plan && (
                <div className="border-t border-slate-700 bg-slate-950/50 p-6 space-y-4">
                  {/* Text on Screen */}
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                      Texte écran
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 italic">
                      "{plan.texte_ecran}"
                    </div>
                  </div>

                  {/* Prompt Video */}
                  <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">
                      Prompt vidéo IA
                    </div>
                    <div className="p-4 rounded-lg bg-slate-900 border border-slate-700">
                      <p className="text-slate-300 text-sm leading-relaxed mb-3">
                        {plan.prompt_video_ia}
                      </p>
                      <button
                        onClick={() =>
                          handleCopyPrompt(plan.plan, plan.prompt_video_ia)
                        }
                        className={`inline-block px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          copiedPrompt === plan.plan
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20"
                        }`}
                      >
                        {copiedPrompt === plan.plan
                          ? "✓ Copié !"
                          : "Copier le prompt"}
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 transition-all">
                      Modifier
                    </button>
                    <button className="flex-1 px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white font-semibold text-sm hover:bg-slate-700 transition-all">
                      Aperçu
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
