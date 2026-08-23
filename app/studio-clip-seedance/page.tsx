"use client";

import { useCallback, useEffect, useState } from "react";
import ProjectAssetUploader from "@/app/components/ProjectAssetUploader";
import ProjectAssetGallery, { type ProjectAsset } from "@/app/components/ProjectAssetGallery";
import SavedResults from "@/app/components/SavedResults";
import SecureDownloadButton from "@/app/components/SecureDownloadButton";
import { fetchJson } from "@/lib/client-api";

type Model = { modelId: string; label: string; tier: string; availability: string; capabilities: { resolutions: string[]; durations: number[] }; pricing: Array<{ resolution: string; creditsPerSecond: number }> };
type Task = { id: string; status: string; provider: string; permanentVideoUrl?: string; errorMessage?: string; actualCompletionTokens?: number };
type Scene = { id: string; order: number; title: string; prompt: string; status: string; durationSeconds: number; resolution: string; ratio: string; modelId?: string; locked: boolean; generationTasks: Task[]; variants: Array<{ id: string; videoUrl: string; selected: boolean }> };
type Asset = ProjectAsset & { url?: string };
type Project = { id: string; title: string; artistName: string; musicGenre?: string; bpm?: number; durationSeconds?: number; finalFormat: string; demoMode: boolean; scenes: Scene[]; mediaAssets: Asset[]; consentRecords: Array<{ id: string; personName: string }>; budgetLimit?: { projectCredits?: number }; _count?: { scenes: number; generationTasks: number } };

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"]);
export default function SeedanceClipStudioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [mode, setMode] = useState<"demo" | "production">("demo");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [newProject, setNewProject] = useState({ title: "", artistName: "", musicGenre: "", bpm: "", durationSeconds: "", finalFormat: "16:9", maxBudgetCredits: "200" });
  const [newScene, setNewScene] = useState({ title: "Plan 1", start: "0", end: "5", prompt: "", modelId: "auto", resolution: "720p", ratio: "16:9" });

  const loadProject = useCallback(async (id: string) => {
    try {
      const data = await fetchJson<{ project: Project }>(`/api/seedance/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
      setProject(data.project);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Projet inaccessible.");
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchJson<{ projects: Project[] }>("/api/seedance/projects", { cache: "no-store" });
      setProjects(data.projects || []);
      return data.projects || [];
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de charger vos projets.");
      return [];
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetchJson<{ projects: Project[] }>("/api/seedance/projects", { cache: "no-store", signal: controller.signal }),
      fetchJson<{ models?: Model[]; mode?: "demo" | "production" }>("/api/seedance/models", { signal: controller.signal }),
      fetchJson<{ creditsRemaining: number }>("/api/credits/balance", { cache: "no-store", signal: controller.signal }).catch(() => ({ creditsRemaining: 0 })),
    ]).then(([projectData, modelData, creditData]) => {
      const nextProjects = projectData.projects || [];
      setProjects(nextProjects);
      setModels(modelData.models || []);
      setMode(modelData.mode || "demo");
      setCreditBalance(creditData.creditsRemaining || 0);
      const requestedId = new URLSearchParams(window.location.search).get("project");
      if (requestedId && nextProjects.some((item) => item.id === requestedId)) void loadProject(requestedId);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Impossible de charger le studio.");
    });
    return () => controller.abort();
  }, [loadProject]);

  useEffect(() => {
    if (!project) return;
    const active = project.scenes.flatMap((scene) => scene.generationTasks).filter((task) => !TERMINAL.has(task.status));
    if (!active.length) return;
    const timer = window.setInterval(async () => {
      await Promise.all(active.map((task) => fetch(`/api/seedance/tasks/${task.id}`, { cache: "no-store" })));
      await loadProject(project.id);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [project, loadProject]);

  const consumption = project?.scenes.reduce((sum, scene) => sum + (scene.generationTasks[0]?.actualCompletionTokens || 0), 0) || 0;

  function quoteForScene(scene: Scene, preview = false) {
    const activeModels = models.filter((model) => model.availability === "active");
    const model = scene.modelId
      ? activeModels.find((candidate) => candidate.modelId === scene.modelId)
      : activeModels.find((candidate) => candidate.tier === (preview ? "preview" : "quality")) || activeModels[0];
    const rate = model?.pricing.find((item) => item.resolution.toLowerCase() === scene.resolution.toLowerCase());
    return model && rate ? { model, unitCredits: rate.creditsPerSecond, totalCredits: rate.creditsPerSecond * scene.durationSeconds } : null;
  }

  async function createProject() {
    setBusy(true); setMessage("");
    try {
      const data = await fetchJson<{ project: Project }>("/api/seedance/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...newProject,
        bpm: newProject.bpm ? Number(newProject.bpm) : undefined,
        durationSeconds: newProject.durationSeconds ? Number(newProject.durationSeconds) : undefined,
        maxBudgetCredits: newProject.maxBudgetCredits ? Number(newProject.maxBudgetCredits) : undefined,
      }) });
      await loadProjects(); await loadProject(data.project.id); setMessage("Projet musical créé.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function addScene() {
    if (!project) return;
    setBusy(true); setMessage("");
    try {
      await fetchJson<{ success?: boolean }>(`/api/seedance/projects/${encodeURIComponent(project.id)}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: newScene.title, startTimeSeconds: Number(newScene.start), endTimeSeconds: Number(newScene.end), prompt: newScene.prompt,
        modelId: newScene.modelId === "auto" ? undefined : newScene.modelId, resolution: newScene.resolution, ratio: newScene.ratio,
        generateAudio: false, watermark: false,
      }) });
      await loadProject(project.id); setNewScene((value) => ({ ...value, title: `Plan ${project.scenes.length + 2}`, start: value.end, end: String(Number(value.end) + 5), prompt: "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scène invalide.");
    } finally {
      setBusy(false);
    }
  }

  async function addConsent() {
    if (!project) return;
    const personName = window.prompt("Nom de la personne qui autorise l’utilisation de son image ou de sa voix :", project.artistName);
    if (!personName) return;
    if (!window.confirm("Je confirme disposer des droits nécessaires pour utiliser l’image et la voix de cette personne.")) return;
    try {
      await fetchJson<{ success?: boolean }>(`/api/seedance/projects/${encodeURIComponent(project.id)}/consents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personName, authorizationType: "image_et_voix", consentedAt: new Date().toISOString(), confirmed: true }) });
      await loadProject(project.id); setMessage("Consentement enregistré et horodaté.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Consentement non enregistré.");
    }
  }

  async function generate(scene: Scene, preview = false) {
    if (!project) return;
    const quote = quoteForScene(scene, preview);
    if (mode === "production" && !quote) { setMessage("Aucun tarif actif ne correspond à cette scène. La génération reste bloquée."); return; }
    const total = mode === "demo" ? 0 : quote!.totalCredits;
    const remaining = creditBalance - total;
    if (remaining < 0) { setMessage(`Crédits Rudyo insuffisants : ${creditBalance} disponibles, ${total} requis.`); return; }
    const confirmation = mode === "demo"
      ? `Simuler « ${scene.title} » sans appel BytePlus et sans débit ?`
      : `${preview ? "Créer une prévisualisation" : "Lancer la génération"} « ${scene.title} » ?\n\nModèle : ${quote!.model.label}\nDurée : ${scene.durationSeconds} s\nPrix unitaire : ${quote!.unitCredits} crédits Rudyo/s\nCoût total : ${total} crédits Rudyo\nSolde actuel : ${creditBalance}\nSolde restant : ${remaining}`;
    if (!window.confirm(confirmation)) return;
    setBusy(true); setMessage("");
    try {
      const data = await fetchJson<{ demo?: boolean }>(`/api/seedance/scenes/${encodeURIComponent(scene.id)}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(), requestedModelId: scene.modelId || "auto", preview,
        referenceAssetIds: selectedAssets, confirmCost: true,
      }) });
      await loadProject(project.id);
      if (!data.demo) setCreditBalance(remaining);
      setMessage(data.demo ? "Mode démonstration : simulation terminée, aucune vidéo réelle ni aucun token consommé." : "Tâche BytePlus enregistrée. Le suivi est automatique.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Génération impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#03040a] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[2rem] border border-violet-400/20 bg-[radial-gradient(circle_at_top_right,_#312e81_0,_#0f172a_42%,_#020617_100%)] p-7 md:p-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div><p className="text-sm font-black uppercase tracking-[.25em] text-violet-300">Rudyo AI · Production cinématographique</p><h1 className="mt-3 text-4xl font-black md:text-6xl">Studio Clip Seedance</h1><p className="mt-4 max-w-3xl text-slate-300">De la chanson originale au clip final : identité artiste, storyboard timecodé, références, variantes et suivi réel des tokens.</p></div>
            <div className={`rounded-2xl border px-5 py-4 ${mode === "demo" ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"}`}><p className="font-black">Mode {mode === "demo" ? "démonstration" : "production"}</p><p className="mt-1 text-xs">{mode === "demo" ? "Aucune vidéo réelle n’est générée." : "BytePlus ModelArk est configuré côté serveur."}</p></div>
          </div>
        </header>

        {message && <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-cyan-100">{message}</div>}

        <section className="mt-7 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="text-xl font-black">Projets musicaux</h2>
            <div className="mt-4 space-y-2">{projects.map((item) => <button key={item.id} onClick={() => void loadProject(item.id)} className={`w-full rounded-2xl border p-4 text-left ${project?.id === item.id ? "border-violet-400 bg-violet-400/10" : "border-slate-800 bg-slate-900"}`}><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-400">{item.artistName} · {item._count?.scenes || 0} scènes</p></button>)}</div>
            <div className="mt-6 space-y-3 border-t border-slate-800 pt-5"><p className="font-bold text-violet-200">Nouveau projet</p>{[
              ["Titre de la chanson", "title"], ["Nom de l’artiste", "artistName"], ["Genre musical", "musicGenre"], ["BPM", "bpm"], ["Durée en secondes", "durationSeconds"], ["Budget maximal en crédits", "maxBudgetCredits"],
            ].map(([label, key]) => <input key={key} aria-label={label} placeholder={label} value={newProject[key as keyof typeof newProject]} onChange={(event) => setNewProject({ ...newProject, [key]: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm" />)}
              <select value={newProject.finalFormat} onChange={(event) => setNewProject({ ...newProject, finalFormat: event.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2"><option>16:9</option><option>9:16</option><option>1:1</option></select>
              <button disabled={busy} onClick={() => void createProject()} className="w-full rounded-xl bg-violet-400 px-4 py-3 font-black text-slate-950 disabled:opacity-50">Créer le projet</button>
            </div>
          </aside>

          {!project ? <div className="grid min-h-[500px] place-items-center rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center text-slate-400">Créez ou sélectionnez un projet pour ouvrir le studio.</div> : <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-4">{[["Artiste", project.artistName], ["Format", project.finalFormat], ["Scènes", String(project.scenes.length)], ["Tokens réels", consumption.toLocaleString("fr-FR")]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950 p-5"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-violet-200">{value}</p></div>)}</section>

            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Identité et références</h2><p className="text-sm text-slate-400">Sélectionnez les médias à transmettre à la prochaine génération.</p></div><button onClick={() => void addConsent()} className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-bold text-emerald-200">{project.consentRecords.length ? "Consentement enregistré ✓" : "Enregistrer le consentement"}</button></div>
              <div className="mt-5"><ProjectAssetUploader projectId={project.id} onUploaded={() => loadProject(project.id)} /></div>
              <ProjectAssetGallery
                projectId={project.id}
                assets={project.mediaAssets}
                selectedIds={selectedAssets}
                onToggleSelection={(assetId) => setSelectedAssets((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId])}
              />
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6"><h2 className="text-2xl font-black">Storyboard timecodé</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{project.scenes.map((scene) => { const task = scene.generationTasks[0]; return <article key={scene.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-violet-300">PLAN {scene.order} · {scene.durationSeconds}s</p><h3 className="mt-1 text-lg font-black">{scene.title}</h3></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs">{task?.status || scene.status}</span></div><p className="mt-3 line-clamp-3 text-sm text-slate-400">{scene.prompt}</p>{task?.errorMessage && <p className="mt-3 text-sm text-red-300">{task.errorMessage}</p>}{(task?.permanentVideoUrl || scene.variants[0]?.videoUrl) && <video controls src={task?.permanentVideoUrl || scene.variants[0].videoUrl} className="mt-4 aspect-video w-full rounded-xl bg-black" />}<div className="mt-4 flex gap-2"><button disabled={busy || scene.locked} onClick={() => void generate(scene, true)} className="rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-200 disabled:opacity-40">Prévisualiser</button><button disabled={busy || scene.locked} onClick={() => void generate(scene)} className="rounded-xl bg-violet-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40">Générer</button></div></article>; })}</div>
              <div className="mt-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2"><input placeholder="Titre de la scène" value={newScene.title} onChange={(e) => setNewScene({ ...newScene, title: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /><div className="grid grid-cols-2 gap-2"><input type="number" placeholder="Début" value={newScene.start} onChange={(e) => setNewScene({ ...newScene, start: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /><input type="number" placeholder="Fin" value={newScene.end} onChange={(e) => setNewScene({ ...newScene, end: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /></div><textarea placeholder="Prompt cinématographique détaillé" value={newScene.prompt} onChange={(e) => setNewScene({ ...newScene, prompt: e.target.value })} rows={4} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 md:col-span-2" /><select value={newScene.modelId} onChange={(e) => setNewScene({ ...newScene, modelId: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><option value="auto">Choix automatique</option>{models.filter((model) => model.availability === "active" && model.pricing.length > 0).map((model) => <option key={model.modelId} value={model.modelId}>{model.label}</option>)}</select><button disabled={busy || newScene.prompt.length < 10} onClick={() => void addScene()} className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">Ajouter à la timeline</button></div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 to-violet-950/30 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-black">Consommation et montage final</h2><p className="mt-2 text-sm text-slate-400">Les tarifs en dollars restent vides tant qu’ils ne sont pas vérifiés et configurés. Le rendu final sera traité par un worker d’arrière-plan.</p></div><div className="flex flex-wrap gap-3"><SecureDownloadButton href={`/api/projects/${encodeURIComponent(project.id)}/history/download`} fallbackName={`rudyo-historique-${project.id}.json`} label="Télécharger l’historique JSON" className="inline-flex items-center gap-2 rounded-xl border border-violet-300/40 px-4 py-3 font-bold text-violet-200 disabled:opacity-60" /><SecureDownloadButton href={`/api/projects/${encodeURIComponent(project.id)}/export?format=json`} fallbackName={`rudyo-${project.id}-storyboard.json`} label="Télécharger le storyboard JSON" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-3 font-bold text-cyan-200 disabled:opacity-60" /><SecureDownloadButton href={`/api/projects/${encodeURIComponent(project.id)}/export?format=pdf`} fallbackName={`rudyo-${project.id}-storyboard.pdf`} label="Télécharger le storyboard PDF" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-3 font-bold text-cyan-200 disabled:opacity-60" /></div></div></section>
            <SavedResults />
          </div>}
        </section>
      </div>
    </main>
  );
}
