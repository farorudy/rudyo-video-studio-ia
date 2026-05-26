"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Project = {
  id: string;
  titre?: string;
  savedAt?: string;
  aiProvider?: string;
};

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger les projets.");
        }

        setProjects(data.projects ?? []);
      } catch (projectError) {
        setError(
          projectError instanceof Error
            ? projectError.message
            : "Impossible de charger les projets.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-slate-400">
        Chargement des projets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-500/40 bg-rose-950/30 p-8 text-rose-200">
        {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-10 text-center">
        <h2 className="text-2xl font-black text-white">Aucun projet sauvegarde</h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          Lancez un storyboard, un pack clip ou une video promotionnelle depuis
          le Studio IA, puis sauvegardez le projet pour le retrouver ici.
        </p>
        <Link
          href="/studio"
          className="mt-6 inline-flex rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300"
        >
          Créer un projet
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/studio?project=${encodeURIComponent(project.id)}`}
          className="rounded-3xl border border-slate-800 bg-slate-950 p-6 transition hover:border-cyan-400"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">
                {project.titre || "Projet video"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Fournisseur IA : {project.aiProvider || "non defini"}
              </p>
            </div>
            <p className="text-sm font-semibold text-cyan-300">
              {project.savedAt
                ? new Date(project.savedAt).toLocaleDateString("fr-FR")
                : "Date inconnue"}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
