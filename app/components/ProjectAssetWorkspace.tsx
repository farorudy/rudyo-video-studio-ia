"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProjectAssetUploader from "@/app/components/ProjectAssetUploader";
import ProjectAssetGallery, { type ProjectAsset } from "@/app/components/ProjectAssetGallery";
import { fetchJson } from "@/lib/client-api";

type Project = { id: string; title: string; artistName: string };

export default function ProjectAssetWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("Chargement de vos projets…");
  const [assets, setAssets] = useState<ProjectAsset[]>([]);

  async function loadAssets(id: string, signal?: AbortSignal) {
    const body = await fetchJson<{ project: { mediaAssets?: ProjectAsset[] } }>(`/api/seedance/projects/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal,
    });
    setAssets(body.project.mediaAssets || []);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchJson<{ projects?: Project[] }>("/api/seedance/projects", { cache: "no-store", signal: controller.signal })
      .then(async (body) => {
        const next = (body.projects || []) as Project[];
        setProjects(next);
        setProjectId(next[0]?.id || "");
        setStatus(next.length ? "" : "Créez d’abord un projet pour importer vos fichiers.");
        if (next[0]) await loadAssets(next[0].id, controller.signal);
      })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setStatus(error instanceof Error ? error.message : "Impossible de charger vos projets."); });
    return () => controller.abort();
  }, []);

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-black text-white">Médias du projet</h2>
        {projects.length ? (
          <select aria-label="Projet pour l’import" value={projectId} onChange={(event) => { const id = event.target.value; setProjectId(id); setAssets([]); void loadAssets(id); }} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white">
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title} · {project.artistName}</option>)}
          </select>
        ) : null}
      </div>
      {status ? <div role="status" className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-300">{status} {status.startsWith("Vous devez") ? <Link href="/login" className="font-bold text-cyan-300">Connexion</Link> : null}</div> : null}
      {projectId ? <ProjectAssetUploader projectId={projectId} onUploaded={async () => loadAssets(projectId)} /> : null}
      {projectId ? <ProjectAssetGallery projectId={projectId} assets={assets} /> : null}
    </section>
  );
}
