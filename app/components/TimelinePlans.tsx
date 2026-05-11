"use client";

import { useState, useRef } from "react";

export type TimelineClip = {
  id: number;
  nom: string;
  duree: string;
  description: string;
  promptVideo: string;
  promptImage: string;
  imageTestUrl: string;
  subtitleText?: string;
  startSec?: number;
  endSec?: number;
  sectionLabel?: string;
  sectionEnergy?: "low" | "medium" | "high";
};

type Props = {
  clips: TimelineClip[];
  onChange: (clips: TimelineClip[]) => void;
  activeSectionId?: string | null;
};

function getEnergyTone(energy: TimelineClip["sectionEnergy"]) {
  if (energy === "high") {
    return {
      badge: "border-rose-400/40 bg-rose-400/15 text-rose-200",
      rail: "border-l-rose-400/50",
      dot: "bg-rose-300",
      label: "Haute",
    };
  }

  if (energy === "low") {
    return {
      badge: "border-sky-400/40 bg-sky-400/15 text-sky-200",
      rail: "border-l-sky-400/50",
      dot: "bg-sky-300",
      label: "Basse",
    };
  }

  return {
    badge: "border-amber-400/40 bg-amber-400/15 text-amber-200",
    rail: "border-l-amber-400/50",
    dot: "bg-amber-300",
    label: "Moyenne",
  };
}

export default function TimelinePlans({
  clips,
  onChange,
  activeSectionId,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNode = useRef<EventTarget | null>(null);

  // ── Drag and drop handlers ──────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, index: number) {
    dragNode.current = e.currentTarget;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnter(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragNode.current !== e.currentTarget) {
      setDragOverIndex(index);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newClips = [...clips];
    const [dragged] = newClips.splice(dragIndex, 1);
    newClips.splice(dropIndex, 0, dragged);
    onChange(newClips);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
    dragNode.current = null;
  }

  // ── Boutons ↑ / ↓ (accessibilité) ──────────────────────────────────────

  function moveUp(index: number) {
    if (index === 0) return;
    const newClips = [...clips];
    [newClips[index - 1], newClips[index]] = [
      newClips[index],
      newClips[index - 1],
    ];
    onChange(newClips);
  }

  function moveDown(index: number) {
    if (index === clips.length - 1) return;
    const newClips = [...clips];
    [newClips[index], newClips[index + 1]] = [
      newClips[index + 1],
      newClips[index],
    ];
    onChange(newClips);
  }

  // ── Édition du sous-titre ───────────────────────────────────────────────

  function updateSubtitle(index: number, value: string) {
    const newClips = [...clips];
    newClips[index] = { ...newClips[index], subtitleText: value };
    onChange(newClips);
  }

  if (clips.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
        Aucun clip dans la timeline. Générez d'abord les prompts vidéo.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/50 p-3 shadow-xl shadow-black/20 backdrop-blur-xl sm:p-4">
      <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-400">
        Glissez-déposez les plans pour réorganiser l'ordre du montage.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
          Mode snap sections
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-1 text-sky-200">
          <span className="h-2 w-2 rounded-full bg-sky-300" />
          Basse
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-1 text-amber-200">
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          Moyenne
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-400/10 px-2 py-1 text-rose-200">
          <span className="h-2 w-2 rounded-full bg-rose-300" />
          Haute
        </span>
      </div>

      {clips.map((clip, index) => {
        const energyTone = getEnergyTone(clip.sectionEnergy);
        const prev = clips[index - 1];
        const sectionChanged =
          index === 0 || prev?.sectionLabel !== clip.sectionLabel;
        const sectionId = clip.sectionLabel
          ? clip.sectionLabel.toLowerCase().replace(/\s+/g, "-")
          : null;
        const isActiveSection = Boolean(
          activeSectionId && sectionId && activeSectionId === sectionId,
        );

        return (
          <div key={clip.id} className="space-y-2">
            {clip.sectionLabel && sectionChanged ? (
              <div
                className={`rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs ${energyTone.rail} ${
                  isActiveSection ? "ring-1 ring-emerald-400/60" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold uppercase tracking-[0.16em] text-slate-200">
                    {clip.sectionLabel}
                  </p>
                  {isActiveSection ? (
                    <span className="rounded-full border border-emerald-400/50 bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                      En lecture
                    </span>
                  ) : null}
                  {Number.isFinite(clip.startSec) &&
                  Number.isFinite(clip.endSec) ? (
                    <p className="text-slate-400">
                      {clip.startSec?.toFixed(2)}s → {clip.endSec?.toFixed(2)}s
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-start gap-4 rounded-2xl border p-4 transition-all cursor-grab active:cursor-grabbing ${
                dragIndex === index
                  ? "opacity-40 border-white/10 bg-white/5"
                  : dragOverIndex === index
                    ? "border-emerald-400/60 bg-emerald-400/10 scale-[1.01]"
                    : isActiveSection
                      ? "border-emerald-400/55 bg-emerald-400/8"
                      : "border-white/10 bg-white/5 hover:border-emerald-400/30"
              }`}
            >
              {/* Numéro + poignée */}
              <div className="flex flex-col items-center gap-1 pt-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
                  {index + 1}
                </span>
                <span className="select-none text-slate-500">⠿</span>
              </div>

              {/* Image de prévisualisation */}
              {clip.imageTestUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clip.imageTestUrl}
                  alt={clip.nom}
                  className="h-16 w-28 shrink-0 rounded-xl border border-white/10 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              )}

              {/* Contenu */}
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {clip.nom}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {clip.duree}
                  </span>
                </div>
                {clip.sectionLabel &&
                Number.isFinite(clip.startSec) &&
                Number.isFinite(clip.endSec) ? (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded-full border px-2 py-0.5 ${energyTone.badge}`}
                    >
                      Énergie {energyTone.label}
                    </span>
                    <span className="text-slate-400">
                      {clip.startSec?.toFixed(2)}s → {clip.endSec?.toFixed(2)}s
                    </span>
                  </div>
                ) : null}
                <p className="text-xs text-slate-400 line-clamp-2">
                  {clip.description}
                </p>
                <input
                  type="text"
                  value={clip.subtitleText ?? ""}
                  onChange={(e) => updateSubtitle(index, e.target.value)}
                  placeholder="Sous-titre affiché à l'écran (optionnel)"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Boutons ↑ ↓ */}
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  title="Monter"
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 bg-slate-700 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={index === clips.length - 1}
                  title="Descendre"
                  className="flex h-6 w-6 items-center justify-center rounded border border-slate-600 bg-slate-700 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
