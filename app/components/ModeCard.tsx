"use client";

type Props = {
  title: string;
  description: string;
  tag: string;
  note: string;
  selected?: boolean;
  onSelect: () => void;
};

export default function ModeCard({
  title,
  description,
  tag,
  note,
  selected,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-3xl border p-7 text-left transition ${
        selected
          ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
          : "border-slate-700 bg-slate-900/80 hover:border-cyan-400 hover:bg-slate-900/95"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {tag}
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900/80 text-cyan-300 transition group-hover:bg-cyan-500/20">
          ✓
        </span>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-400">{description}</p>
      <p className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
        {note}
      </p>
    </button>
  );
}
