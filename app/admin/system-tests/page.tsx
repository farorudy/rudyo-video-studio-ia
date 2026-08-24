"use client";

import { Activity, CheckCircle2, Download, Loader2, Play, ShieldAlert, Video } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Worker = {
  available: boolean;
  state: "ONLINE" | "DEGRADED" | "OFFLINE";
  pendingJobs: number;
  latest: null | {
    id: string; version: string; lastSeenAt: string; ffmpegAvailable: boolean;
    databaseAvailable: boolean; storageAvailable: boolean; tempAvailableBytes: number | null;
  };
};

type Run = {
  id: string; scenario: string; status: string; createdAt: string; completedAt: string | null;
  errorMessage: string | null; balanceBefore: number; balanceAfter: number | null;
  billingVerified: boolean; bytePlusCallVerified: boolean; diagnostics: Record<string, unknown> | null;
  progress: number; attemptCount: number; downloadUrl: string | null;
  steps: Array<{ name: string; status: string; at?: string; durationMs?: number; message: string }>;
};

type Dashboard = { success: boolean; enabled: boolean; worker: Worker; runs: Run[]; error?: string };

const scenarios = [
  ["SUCCESS", "Test normal"], ["INVALID_VIDEO", "Vidéo invalide"], ["MISSING_AUDIO", "Musique absente"],
  ["INTERRUPTED_WORKER", "Interruption simulée"], ["EXPIRED_LEASE", "Verrou expiré"],
  ["STORAGE_FAILURE", "Échec stockage temporaire"], ["DOUBLE_CLAIM", "Double prise concurrente"],
  ["IDEMPOTENCY_REPLAY", "Rejeu idempotent"],
];

export default function SystemTestsPage() {
  const [csrfToken, setCsrfToken] = useState("");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [scenario, setScenario] = useState("SUCCESS");
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const session = await fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" });
    if (!session.ok) { setAuthenticated(false); return; }
    const sessionBody = await session.json() as { csrfToken?: string };
    setAuthenticated(true); setCsrfToken(sessionBody.csrfToken || "");
    const response = await fetch("/api/admin/system-tests", { cache: "no-store", credentials: "same-origin" });
    const body = await response.json() as Dashboard;
    if (!response.ok) throw new Error(body.error || "Diagnostic indisponible.");
    setData(body); setError("");
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load().catch((unknown) => setError(unknown instanceof Error ? unknown.message : "Diagnostic indisponible.")), 0);
    const timer = window.setInterval(() => void load().catch(() => undefined), 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function launch() {
    if (!csrfToken) return;
    setLaunching(true); setError("");
    try {
      const response = await fetch("/api/admin/system-tests", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ scenario }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Le test n’a pas pu démarrer.");
      await load();
    } catch (unknown) {
      setError(unknown instanceof Error ? unknown.message : "Le test n’a pas pu démarrer.");
    } finally { setLaunching(false); }
  }

  if (authenticated === null) return <main className="grid min-h-screen place-items-center text-slate-100"><Loader2 className="animate-spin" /></main>;
  if (!authenticated) return <main className="grid min-h-screen place-items-center px-5 text-slate-100"><div className="text-center"><ShieldAlert className="mx-auto text-amber-300" size={48} /><h1 className="mt-5 text-3xl font-black">Session administrateur requise</h1><Link href="/admin" className="mt-6 inline-block rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Ouvrir l’administration</Link></div></main>;

  const worker = data?.worker;
  return <main className="min-h-screen px-5 pb-16 pt-16 text-slate-100">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold uppercase tracking-[.2em] text-cyan-300">Diagnostic administrateur</p><h1 className="mt-2 text-4xl font-black">Test du parcours de montage</h1></div><Link href="/admin" className="rounded-xl border border-slate-700 px-4 py-3 font-bold">Retour</Link></div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <StatusCard label="Worker" value={worker?.state || "—"} ok={Boolean(worker?.available)} />
        <StatusCard label="FFmpeg" value={worker?.latest?.ffmpegAvailable ? "Disponible" : "Indisponible"} ok={Boolean(worker?.latest?.ffmpegAvailable)} />
        <StatusCard label="PostgreSQL" value={worker?.latest?.databaseAvailable ? "Disponible" : "Indisponible"} ok={Boolean(worker?.latest?.databaseAvailable)} />
        <StatusCard label="Blob privé" value={worker?.latest?.storageAvailable ? "Disponible" : "Indisponible"} ok={Boolean(worker?.latest?.storageAvailable)} />
      </div>
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 text-sm text-slate-300">Version : {worker?.latest?.version || "—"} · Dernier signal : {worker?.latest ? new Date(worker.latest.lastSeenAt).toLocaleString("fr-FR") : "aucun"} · Tâches en attente : {worker?.pendingJobs ?? 0}</div>

      <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/85 p-6">
        <h2 className="text-2xl font-black">Lancer un contrôle non facturable</h2>
        <p className="mt-2 text-slate-400">Le serveur utilise uniquement trois scènes, une image et une musique synthétiques prédéfinies.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><select value={scenario} onChange={(event) => setScenario(event.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">{scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button onClick={() => void launch()} disabled={launching || !data?.enabled || !worker?.available} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{launching ? <Loader2 className="animate-spin" /> : <Play />} Lancer un test de montage non facturable</button></div>
        {!data?.enabled ? <p className="mt-4 text-amber-300">Le mode test est désactivé côté serveur.</p> : null}
        {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-rose-200">{error}</p> : null}
      </section>

      <section className="mt-8 space-y-5">{data?.runs.map((run) => <RunCard key={run.id} run={run} />)}</section>
    </div>
  </main>;
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 flex items-center gap-2 font-black ${ok ? "text-emerald-300" : "text-amber-300"}`}><Activity size={18} /> {value}</p></div>;
}

function RunCard({ run }: { run: Run }) {
  const diagnostics = run.diagnostics || {};
  const totalMs = run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime() : null;
  return <article className="rounded-3xl border border-slate-800 bg-slate-950/85 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">{run.scenario}</h2><p className="mt-1 text-sm text-slate-400">{new Date(run.createdAt).toLocaleString("fr-FR")} · tentative {run.attemptCount}</p></div><span className={`rounded-full px-4 py-2 text-sm font-black ${run.status === "SUCCEEDED" ? "bg-emerald-400/15 text-emerald-300" : run.status === "FAILED" ? "bg-rose-400/15 text-rose-300" : "bg-cyan-400/15 text-cyan-200"}`}>{run.status === "SUCCEEDED" ? "Test réussi" : run.status}</span></div>
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-300" style={{ width: `${run.progress}%` }} /></div>
    <ol className="mt-6 grid gap-3 md:grid-cols-2">{run.steps.map((item, index) => <li key={`${item.name}-${index}`} className="rounded-xl border border-slate-800 p-3"><p className="flex items-center gap-2 font-bold"><CheckCircle2 className="text-emerald-300" size={16} /> {item.message}</p><p className="mt-1 text-xs text-slate-500">{item.at ? new Date(item.at).toLocaleString("fr-FR") : "—"}{item.durationMs ? ` · ${item.durationMs} ms` : ""}</p></li>)}</ol>
    {run.status === "SUCCEEDED" ? <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3"><p>Taille : {String(diagnostics.sizeBytes || "—")} octets</p><p>Vidéo : {String(diagnostics.videoCodec || "—")}</p><p>Audio : {String(diagnostics.audioCodec || "—")}</p><p>Résolution : {String(diagnostics.width || "—")} × {String(diagnostics.height || "—")}</p><p>Durée : {String(diagnostics.durationSeconds || "—")} s</p><p>Total : {totalMs === null ? "—" : `${totalMs} ms`}</p></div> : null}
    <div className="mt-5 flex flex-wrap gap-3">{run.downloadUrl ? <><a href={`${run.downloadUrl}&preview=1`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 font-bold"><Video size={18} /> Lire le MP4 de test</a><a href={run.downloadUrl} download className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950"><Download size={18} /> Télécharger le MP4 de test</a></> : null}<span className="rounded-xl border border-slate-800 px-4 py-3 text-sm">Solde : {run.balanceBefore} → {run.balanceAfter ?? "—"} · facturation {run.billingVerified && run.bytePlusCallVerified ? "vérifiée" : "en attente"}</span></div>
    {run.errorMessage ? <p className="mt-4 text-rose-300">{run.errorMessage}</p> : null}
  </article>;
}
