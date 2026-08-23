"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";

type Project = { counts?: { finalExports?: number } };
type Result = { id: string };

export default function DashboardStats() {
  const [values, setValues] = useState({ projects: 0, exports: 0, results: 0 });
  const [message, setMessage] = useState("Chargement des compteurs…");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchJson<{ projects?: Project[] }>("/api/projects", { cache: "no-store", signal: controller.signal }),
      fetchJson<{ results?: Result[] }>("/api/results", { cache: "no-store", signal: controller.signal }),
    ]).then(([projectPayload, resultPayload]) => {
      const projects = projectPayload.projects || [];
      const results = resultPayload.results || [];
      setValues({
        projects: projects.length,
        exports: projects.reduce((total, project) => total + (project.counts?.finalExports || 0), 0),
        results: results.length,
      });
      setMessage("");
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Impossible de charger les compteurs.");
    });
    return () => controller.abort();
  }, []);

  const stats = [
    { label: "Projets", value: values.projects, detail: "Projets Studio et Seedance enregistrés." },
    { label: "Exports finaux", value: values.exports, detail: "Montages finaux enregistrés dans PostgreSQL." },
    { label: "Résultats", value: values.results, detail: "Vidéos terminées disponibles au téléchargement." },
  ];

  return (
    <div>
      {message ? <p role="status" className="mb-4 text-sm text-slate-400">{message}</p> : null}
      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="mt-3 text-5xl font-black text-cyan-300">{stat.value}</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">{stat.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
