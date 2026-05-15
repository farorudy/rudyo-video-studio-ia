"use client";

import type { CreditTool } from "@/lib/credit-costs";

type ModelCardProps = {
  tool: CreditTool;
  title: string;
  description: string;
  credits: number;
  selected?: boolean;
  onSelect: (tool: CreditTool) => void;
};

export function ModelCard({
  tool,
  title,
  description,
  credits,
  selected = false,
  onSelect,
}: ModelCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      className={[
        "group w-full rounded-3xl border p-5 text-left transition",
        "bg-slate-900/80 hover:bg-slate-800/90",
        selected
          ? "border-cyan-400 shadow-lg shadow-cyan-500/20"
          : "border-slate-700 hover:border-cyan-500/60",
      ].join(" ")}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {description}
          </p>
        </div>

        <div className="shrink-0 rounded-2xl bg-cyan-400/10 px-3 py-2 text-center">
          <p className="text-lg font-black text-cyan-300">{credits}</p>
          <p className="text-[11px] uppercase tracking-wide text-cyan-100">
            crédits
          </p>
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-cyan-300 group-hover:bg-cyan-400 group-hover:text-slate-950">
        Choisir ce modèle
      </div>
    </button>
  );
}
