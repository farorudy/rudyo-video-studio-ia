"use client";

type Props = {
  plan: number;
  duration: string;
  description: string;
  camera: string;
  screenText: string;
  prompt: string;
  transition: string;
  mediaType: string;
  status: string;
};

export default function StoryboardPlanCard({
  plan,
  duration,
  description,
  camera,
  screenText,
  prompt,
  transition,
  mediaType,
  status,
}: Props) {
  return (
    <article className="rounded-3xl border border-slate-700 bg-slate-950/80 p-6 shadow-xl shadow-slate-950/20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-cyan-400">
            Plan {plan}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">{duration}</h3>
        </div>
        <span className="rounded-full border border-cyan-500/20 bg-slate-900/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {status}
        </span>
      </div>

      <div className="mt-5 space-y-4 text-sm text-slate-300">
        <p>
          <span className="font-semibold text-white">Description :</span>{" "}
          {description}
        </p>
        <p>
          <span className="font-semibold text-white">Mouvement :</span> {camera}
        </p>
        <p>
          <span className="font-semibold text-white">Texte écran :</span>{" "}
          {screenText}
        </p>
        <p>
          <span className="font-semibold text-white">Prompt IA :</span> {prompt}
        </p>
        <p>
          <span className="font-semibold text-white">Transition :</span>{" "}
          {transition}
        </p>
        <p>
          <span className="font-semibold text-white">Média attendu :</span>{" "}
          {mediaType}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {[
          { label: "Copier prompt", style: "bg-slate-900/90 text-slate-100" },
          { label: "Modifier", style: "bg-slate-800 text-cyan-300" },
          { label: "Ajouter après", style: "bg-slate-800 text-cyan-300" },
          { label: "Valider", style: "bg-cyan-500 text-slate-950" },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            className={`${action.style} rounded-full px-4 py-2 text-sm font-semibold transition hover:brightness-110`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}
