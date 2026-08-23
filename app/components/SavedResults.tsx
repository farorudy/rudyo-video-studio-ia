"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import SecureDownloadButton from "@/app/components/SecureDownloadButton";

type Result = { id: string; projectId: string; project: string; name: string; mimeType: string; sizeBytes: number | null; createdAt: string; status: string; downloadUrl?: string };

function sizeLabel(value: number | null) {
  return value === null ? "Taille calculée au téléchargement" : `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}

function typeLabel(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/json") return "JSON";
  if (mimeType.startsWith("video/")) return "MP4";
  return mimeType;
}

function extensionFor(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/json") return "json";
  if (mimeType.startsWith("video/")) return "mp4";
  return "bin";
}

export default function SavedResults({ compact = false }: { compact?: boolean }) {
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("Chargement des résultats…");

  useEffect(() => {
    const controller = new AbortController();
    fetchJson<{ results?: Result[] }>("/api/results", { cache: "no-store", signal: controller.signal })
      .then((body) => {
        setResults(body.results || []);
        setMessage(body.results?.length ? "" : "Aucun résultat terminé et sauvegardé pour le moment.");
      })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Impossible de charger les résultats."); });
    return () => controller.abort();
  }, []);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <h2 className="text-2xl font-black text-white">Résultats disponibles</h2>
      {message ? <p className="mt-3 text-sm text-slate-400">{message}</p> : null}
      <div className={`mt-5 grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
        {results.map((result) => (
          <article key={result.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            {!compact && result.mimeType.startsWith("video/") ? <video controls preload="metadata" src={`/api/assets/${encodeURIComponent(result.id)}/download?preview=1`} className="aspect-video w-full rounded-xl bg-black" /> : null}
            <div className={compact ? "" : "mt-4"}>
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-white">{result.name}</h3><p className="mt-1 text-sm text-slate-400">{result.project}</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{result.status}</span></div>
              <p className="mt-3 text-xs text-slate-400">{typeLabel(result.mimeType)} · {sizeLabel(result.sizeBytes)} · {new Date(result.createdAt).toLocaleDateString("fr-FR")}</p>
              <SecureDownloadButton
                href={result.downloadUrl || `/api/assets/${encodeURIComponent(result.id)}/download`}
                fallbackName={`rudyo-${result.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extensionFor(result.mimeType)}`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
