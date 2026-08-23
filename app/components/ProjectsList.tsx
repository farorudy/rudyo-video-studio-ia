"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProjectAssetGallery, { type ProjectAsset } from "@/app/components/ProjectAssetGallery";
import SecureDownloadButton from "@/app/components/SecureDownloadButton";
import { fetchJson } from "@/lib/client-api";

type Project = {
  id: string;
  titre?: string;
  savedAt?: string;
  aiProvider?: string;
  title?: string;
  artistName?: string;
  category?: string;
  status?: string;
  counts?: { scenes: number; generationTasks: number; mediaAssets: number; finalExports: number };
  mediaAssets?: ProjectAsset[];
};

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await fetchJson<{ projects?: Project[] }>("/api/projects", { cache: "no-store" });
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
        <article key={project.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">
                {project.title || project.titre || "Projet vidéo"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {project.category || "Studio Rudyo"} · {project.artistName || "Artiste Rudyo"} · {project.status || "DRAFT"}
              </p>
              {project.counts ? <p className="mt-2 text-xs text-slate-500">{project.counts.scenes} scène(s) · {project.counts.mediaAssets} média(s) · {project.counts.finalExports} export(s)</p> : null}
            </div>
            <p className="text-sm font-semibold text-cyan-300">
              {project.savedAt
                ? new Date(project.savedAt).toLocaleDateString("fr-FR")
                : "Date inconnue"}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/studio-clip-seedance?project=${encodeURIComponent(project.id)}`} className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">Ouvrir le projet</Link>
            <SecureDownloadButton href={`/api/projects/${encodeURIComponent(project.id)}/export?format=json`} fallbackName={`rudyo-${project.id}-storyboard.json`} label="Storyboard JSON" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 font-bold text-slate-200 disabled:opacity-60" />
            <SecureDownloadButton href={`/api/projects/${encodeURIComponent(project.id)}/export?format=pdf`} fallbackName={`rudyo-${project.id}-storyboard.pdf`} label="Storyboard PDF" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 font-bold text-slate-200 disabled:opacity-60" />
          </div>
          <ProjectAssetGallery projectId={project.id} assets={project.mediaAssets || []} />
        </article>
      ))}
    </div>
  );
}
