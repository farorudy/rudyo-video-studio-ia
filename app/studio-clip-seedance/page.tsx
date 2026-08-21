"use client";

import { useCallback, useEffect, useState } from "react";

type Model = { modelId: string; label: string; tier: string; availability: string; capabilities: { resolutions: string[]; durations: number[] } };
type Task = { id: string; status: string; provider: string; permanentVideoUrl?: string; errorMessage?: string; actualCompletionTokens?: number };
type Scene = { id: string; order: number; title: string; prompt: string; status: string; durationSeconds: number; resolution: string; ratio: string; modelId?: string; locked: boolean; generationTasks: Task[]; variants: Array<{ id: string; videoUrl: string; selected: boolean }> };
type Asset = { id: string; type: string; fileName: string; url: string };
type Project = { id: string; title: string; artistName: string; musicGenre?: string; bpm?: number; durationSeconds?: number; finalFormat: string; demoMode: boolean; scenes: Scene[]; mediaAssets: Asset[]; consentRecords: Array<{ id: string; personName: string }>; budgetLimit?: { projectCredits?: number }; _count?: { scenes: number; generationTasks: number } };

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "REJECTED", "CANCELED", "EXPIRED"]);
const assetTypes = [
  ["AUDIO", "Chanson MP3 ou WAV"], ["ARTIST_PORTRAIT", "Portrait principal"],
  ["REFERENCE_IMAGE", "Image de référence"], ["REFERENCE_VIDEO", "Vidéo de référence"],
  ["DECOR", "Décor"], ["OUTFIT", "Tenue"], ["FIRST_FRAME", "Première image"], ["LAST_FRAME", "Dernière image"],
] as const;

export default function SeedanceClipStudioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [mode, setMode] = useState<"demo" | "production">("demo");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [newProject, setNewProject] = useState({ title: "", artistName: "", musicGenre: "", bpm: "", durationSeconds: "", finalFormat: "16:9", maxBudgetCredits: "200" });
  const [newScene, setNewScene] = useState({ title: "Plan 1", start: "0", end: "5", prompt: "", modelId: "auto", resolution: "720p", ratio: "16:9" });

  const loadProject = useCallback(async (id: string) => {
    const response = await fetch(`/api/seedance/projects/${id}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setProject(data.project);
    else setMessage(data.error || "Projet inaccessible.");
  }, []);

  const loadProjects = useCallback(async () => {
    const response = await fetch("/api/seedance/projects", { cache: "no-store" });
    if (response.status === 401) { setMessage("Connectez-vous avec votre compte Rudyo pour utiliser le studio."); return; }
    const data = await response.json();
    if (response.ok) setProjects(data.projects);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/seedance/projects", { cache: "no-store", signal: controller.signal })
        .then(async (response) => ({ response, data: await response.json() }))
        .then(({ response, data }) => {
          if (response.status === 401) setMessage("Connectez-vous avec votre compte Rudyo pour utiliser le studio.");
          else if (response.ok) setProjects(data.projects);
        }),
      fetch("/api/seedance/models", { signal: controller.signal })
        .then((response) => response.json())
        .then((data) => { setModels(data.models || []); setMode(data.mode || "demo"); }),
    ]).catch(() => undefined);
    return () => controller.abort();
  }, []);

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

  async function createProject() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/seedance/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...newProject,
      bpm: newProject.bpm ? Number(newProject.bpm) : undefined,
      durationSeconds: newProject.durationSeconds ? Number(newProject.durationSeconds) : undefined,
      maxBudgetCredits: newProject.maxBudgetCredits ? Number(newProject.maxBudgetCredits) : undefined,
    }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(data.error || "Création impossible."); return; }
    await loadProjects(); await loadProject(data.project.id); setMessage("Projet musical créé.");
  }

  async function addScene() {
    if (!project) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/seedance/projects/${project.id}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      title: newScene.title, startTimeSeconds: Number(newScene.start), endTimeSeconds: Number(newScene.end), prompt: newScene.prompt,
      modelId: newScene.modelId === "auto" ? undefined : newScene.modelId, resolution: newScene.resolution, ratio: newScene.ratio,
      generateAudio: false, watermark: false,
    }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(data.error || "Scène invalide."); return; }
    await loadProject(project.id); setNewScene((value) => ({ ...value, title: `Plan ${project.scenes.length + 2}`, start: value.end, end: String(Number(value.end) + 5), prompt: "" }));
  }

  async function uploadAsset(file: File, type: string) {
    if (!project) return;
    setBusy(true); setMessage("Importation en cours…");
    const form = new FormData(); form.set("file", file); form.set("type", type);
    const response = await fetch(`/api/seedance/projects/${project.id}/media`, { method: "POST", body: form });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(data.error || "Importation impossible."); return; }
    await loadProject(project.id); setMessage(`${file.name} a été sauvegardé.`);
  }

  async function addConsent() {
    if (!project) return;
    const personName = window.prompt("Nom de la personne qui autorise l’utilisation de son image ou de sa voix :", project.artistName);
    if (!personName) return;
    if (!window.confirm("Je confirme disposer des droits nécessaires pour utiliser l’image et la voix de cette personne.")) return;
    const response = await fetch(`/api/seedance/projects/${project.id}/consents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personName, authorizationType: "image_et_voix", consentedAt: new Date().toISOString(), confirmed: true }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || "Consentement non enregistré.");
    else { await loadProject(project.id); setMessage("Consentement enregistré et horodaté."); }
  }

  async function generate(scene: Scene, preview = false) {
    if (!window.confirm(`${preview ? "Créer une prévisualisation" : "Lancer la génération"} de « ${scene.title} » ? Les limites du projet seront vérifiées avant l’envoi.`)) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/seedance/scenes/${scene.id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(), requestedModelId: scene.modelId || "auto", preview,
      referenceAssetIds: selectedAssets, confirmCost: true,
    }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(data.error || "Génération impossible."); return; }
    await loadProject(project!.id);
    setMessage(data.demo ? "Mode démonstration : simulation terminée, aucune vidéo réelle ni aucun token consommé." : "Tâche BytePlus enregistrée. Le suivi est automatique.");
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
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{assetTypes.map(([type, label]) => <label key={type} className="cursor-pointer rounded-2xl border border-slate-800 bg-slate-900 p-4"><span className="text-sm font-bold">{label}</span><input type="file" accept={type === "AUDIO" ? "audio/*" : type.includes("VIDEO") ? "video/*" : "image/*"} className="mt-3 block w-full text-xs text-slate-400" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, type); }} /></label>)}</div>
              {project.mediaAssets.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{project.mediaAssets.map((asset) => <button key={asset.id} onClick={() => setSelectedAssets((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id])} className={`rounded-full border px-3 py-2 text-xs ${selectedAssets.includes(asset.id) ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-700"}`}>{asset.fileName}</button>)}</div>}
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6"><h2 className="text-2xl font-black">Storyboard timecodé</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{project.scenes.map((scene) => { const task = scene.generationTasks[0]; return <article key={scene.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-violet-300">PLAN {scene.order} · {scene.durationSeconds}s</p><h3 className="mt-1 text-lg font-black">{scene.title}</h3></div><span className="rounded-full bg-slate-800 px-3 py-1 text-xs">{task?.status || scene.status}</span></div><p className="mt-3 line-clamp-3 text-sm text-slate-400">{scene.prompt}</p>{task?.errorMessage && <p className="mt-3 text-sm text-red-300">{task.errorMessage}</p>}{(task?.permanentVideoUrl || scene.variants[0]?.videoUrl) && <video controls src={task?.permanentVideoUrl || scene.variants[0].videoUrl} className="mt-4 aspect-video w-full rounded-xl bg-black" />}<div className="mt-4 flex gap-2"><button disabled={busy || scene.locked} onClick={() => void generate(scene, true)} className="rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-200 disabled:opacity-40">Prévisualiser</button><button disabled={busy || scene.locked} onClick={() => void generate(scene)} className="rounded-xl bg-violet-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40">Générer</button></div></article>; })}</div>
              <div className="mt-6 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2"><input placeholder="Titre de la scène" value={newScene.title} onChange={(e) => setNewScene({ ...newScene, title: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /><div className="grid grid-cols-2 gap-2"><input type="number" placeholder="Début" value={newScene.start} onChange={(e) => setNewScene({ ...newScene, start: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /><input type="number" placeholder="Fin" value={newScene.end} onChange={(e) => setNewScene({ ...newScene, end: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" /></div><textarea placeholder="Prompt cinématographique détaillé" value={newScene.prompt} onChange={(e) => setNewScene({ ...newScene, prompt: e.target.value })} rows={4} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 md:col-span-2" /><select value={newScene.modelId} onChange={(e) => setNewScene({ ...newScene, modelId: e.target.value })} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"><option value="auto">Choix automatique</option>{models.map((model) => <option key={model.modelId} value={model.modelId}>{model.label} · {model.availability}</option>)}</select><button disabled={busy || newScene.prompt.length < 10} onClick={() => void addScene()} className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">Ajouter à la timeline</button></div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 to-violet-950/30 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-black">Consommation et montage final</h2><p className="mt-2 text-sm text-slate-400">Les tarifs en dollars restent vides tant qu’ils ne sont pas vérifiés et configurés. Le rendu final sera traité par un worker d’arrière-plan.</p></div><div className="flex gap-3"><a href={`/api/seedance/consumption?projectId=${project.id}`} className="rounded-xl border border-violet-300/40 px-4 py-3 font-bold text-violet-200">Historique JSON</a><a href="https://console.byteplus.com/ark/region:ark+ap-southeast-1/model" target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-3 font-black text-slate-950">Ouvrir la console BytePlus</a></div></div></section>
          </div>}
        </section>
      </div>
    </main>
  );
}
