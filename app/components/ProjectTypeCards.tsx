"use client";

import { ReactNode } from "react";

type ProjectType = {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  duration?: string;
};

const projectTypes: ProjectType[] = [
  {
    id: "clip",
    icon: "🎬",
    title: "Clip musical",
    description: "Paroles animées ou plans IA",
    duration: "1-3 min",
  },
  {
    id: "flyer",
    icon: "🎪",
    title: "Flyer animé",
    description: "Transformez votre affiche",
    duration: "15-30 sec",
  },
  {
    id: "promo",
    icon: "📺",
    title: "Vidéo promo",
    description: "Formation, service, événement",
    duration: "30-60 sec",
  },
  {
    id: "formation",
    icon: "📚",
    title: "Capsule formation",
    description: "Prête pour Moodle",
    duration: "2-8 min",
  },
  {
    id: "event",
    icon: "🎪",
    title: "Vidéo événement",
    description: "Concert, conférence, soirée",
    duration: "30-120 sec",
  },
  {
    id: "social",
    icon: "📱",
    title: "Contenu réseaux",
    description: "TikTok, Instagram, Facebook",
    duration: "15-60 sec",
  },
];

type ProjectTypeCardsProps = {
  selectedType?: string;
  onSelect?: (type: string) => void;
};

export default function ProjectTypeCards({
  selectedType,
  onSelect,
}: ProjectTypeCardsProps) {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-3xl font-bold text-white mb-3">
          Quel type de vidéo créez-vous ?
        </h2>
        <p className="text-slate-400 mb-12">
          Sélectionnez un type pour commencer. Vous pourrez toujours l'ajuster
          après.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => onSelect?.(type.id)}
              className={`text-left p-6 rounded-xl border-2 transition-all ${
                selectedType === type.id
                  ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20"
                  : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900"
              }`}
            >
              <div className="text-4xl mb-3">{type.icon}</div>
              <h3 className="font-bold text-white mb-1">{type.title}</h3>
              <p className="text-sm text-slate-400 mb-3">{type.description}</p>
              {type.duration && (
                <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-xs text-slate-300">
                  {type.duration}
                </div>
              )}
              {selectedType === type.id && (
                <div className="mt-4 flex items-center gap-2 text-cyan-400 font-semibold text-sm">
                  <span>✓ Sélectionné</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export { projectTypes, type ProjectType };
