"use client";

type Props = {
  icon: string;
  title: string;
  description: string;
  selected?: boolean;
  onSelect: () => void;
};

export default function VideoTypeCard({
  icon,
  title,
  description,
  selected,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-3xl border px-6 py-7 text-left transition ${
        selected
          ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
          : "border-slate-700 bg-slate-900/80 hover:border-cyan-400 hover:bg-slate-900/95"
      }`}
    >
      <div className="text-4xl">{icon}</div>
      <div className="mt-5">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-xs font-semibold text-cyan-300">
        {selected ? "Sélectionné" : "Choisir"}
        <span aria-hidden="true">→</span>
      </div>
    </button>
  );
}
