"use client";

import { Download, Eye, FileJson, FileText, Loader2, Plus, ScrollText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Creation = {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  error: string | null;
  progress: number;
  durationSeconds: number;
  sceneCount: number;
  scenarioValid: boolean;
  cost: number;
  scenarioUrl: string;
  scenarioJsonUrl: string;
  scenarioPdfUrl: string;
  downloadUrl: string | null;
};

export default function SimpleCreations() {
  const [creations, setCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/simple-clips", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setCreations(body.creations || []);
      setError("");
    } catch (unknown) {
      setError(unknown instanceof Error ? unknown.message : "Impossible de charger vos créations.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);
  async function remove(creation: Creation) {
    if (!window.confirm(`Supprimer « ${creation.title} » ? Cette action est définitive.`)) return;
    const response = await fetch(`/api/simple-clips/${encodeURIComponent(creation.id)}`, { method: "DELETE" });
    if (response.ok) setCreations((items) => items.filter((item) => item.id !== creation.id));
    else setError("La création n’a pas pu être supprimée.");
  }
  if (loading) return <div className="mt-12 flex items-center gap-3 text-slate-400"><Loader2 className="animate-spin" /> Chargement de vos créations…</div>;
  return <div className="mt-10">
    {error ? <p role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4 text-rose-100">{error}</p> : null}
    {creations.length ? <div className="mb-6 flex justify-end"><Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950"><Plus size={18} /> Créer un autre clip</Link></div> : null}
    {!creations.length && !error ? <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-10 text-center"><p className="text-lg font-bold">Vous n’avez pas encore créé de clip.</p><Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950"><Plus size={18} /> Créer mon premier clip</Link></div> : null}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{creations.map((creation) => {
      const previewUrl = creation.downloadUrl ? `${creation.downloadUrl}${creation.downloadUrl.includes("?") ? "&" : "?"}preview=1` : null;
      return <article key={creation.id} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80">
        {previewUrl ? <video src={previewUrl} preload="metadata" muted playsInline controls className="aspect-[9/16] w-full max-h-[28rem] bg-black object-contain" /> : <div className="grid aspect-video place-items-center bg-gradient-to-br from-cyan-950 to-slate-900"><span className="rounded-full bg-slate-950/70 px-4 py-2 text-sm font-bold text-cyan-200">{creation.status}</span></div>}
        <div className="p-5">
          <h2 className="truncate text-lg font-black">{creation.title}</h2>
          <p className="mt-2 text-sm text-slate-400">{new Date(creation.createdAt).toLocaleDateString("fr-FR")} · {creation.durationSeconds} s · {creation.cost.toLocaleString("fr-FR")} crédits</p>
          <p className="mt-1 text-sm text-slate-400">{creation.sceneCount} plans · {creation.progress}% · {creation.scenarioValid ? "scénario validé" : "scénario incomplet"}</p>
          {creation.error ? <p className="mt-3 rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200">{creation.error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={creation.scenarioUrl} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${creation.scenarioValid ? "border border-emerald-400/40 text-emerald-200" : "bg-cyan-300 text-slate-950"}`}><ScrollText size={16} /> {creation.scenarioValid ? "Voir le scénario validé" : "Voir et valider mon scénario"}</Link>
            <a href={creation.scenarioJsonUrl} className="rounded-lg border border-slate-700 p-2.5" aria-label="Télécharger le scénario JSON"><FileJson size={17} /></a>
            <a href={creation.scenarioPdfUrl} className="rounded-lg border border-slate-700 p-2.5" aria-label="Télécharger le scénario PDF"><FileText size={17} /></a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {creation.downloadUrl ? <><a href={previewUrl!} target="_blank" className="rounded-lg border border-slate-700 p-2.5" aria-label="Regarder"><Eye size={18} /></a><a href={creation.downloadUrl} download className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 font-black text-slate-950"><Download size={17} /> Télécharger MP4</a></> : <span className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-sm text-slate-400">{creation.status}</span>}
            <button onClick={() => void remove(creation)} className="rounded-lg border border-rose-500/30 p-2.5 text-rose-300" aria-label="Supprimer"><Trash2 size={18} /></button>
          </div>
        </div>
      </article>;
    })}</div>
  </div>;
}
