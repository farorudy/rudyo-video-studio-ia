"use client";

import { Check, ChevronDown, Download, ImagePlus, Loader2, Music2, Sparkles, Trash2, UploadCloud, WandSparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/app/components/SessionProvider";

type PlanCode = "TIKTOK" | "LONG" | "PREMIUM";
type Quote = { totalCredits: number; requiredCredits: number; priceEur: number; audioDurationSeconds: number; normalizedSeconds: number; billableDurationSeconds: number; plan: PlanCode | "CUSTOM"; planName: string; supported: boolean; fitsSelectedPlan: boolean; recommendedPlan: PlanCode | null; maxPriceEur: number | null; balance: number | null; balanceAfter: number | null; missingCredits: number; missingPriceEur: number; allowed: boolean; workerAvailable: boolean; workerState?: string; workerWaking?: boolean; refusalCode: string | null };
type ClipState = "form" | "draft" | "processing" | "completed" | "failed";
type StatusPayload = Partial<Quote> & { state: "draft" | "processing" | "completed" | "failed"; progress?: number; message: string; videoUrl?: string; downloadUrl?: string; projectTitle?: string; durationSeconds?: number; createdAt?: string; error?: string };
const suggestions = ["Romantique", "Cinématographique", "Tropical", "Concert", "Gospel", "Zouk", "Urbain", "Élégant"];
const example = "Une chanteuse arrive dans un club élégant en voiture américaine blanche. Elle traverse une foule d’admirateurs, monte sur scène et chante devant le public. Style cinématographique, romantique et international.";
const ACTIVE_PROJECT_KEY = "rudyo-active-simple-clip";
const planOptions = [
  { code: "TIKTOK" as const, title: "Clip 3:30", duration: "3 minutes 30", credits: 3_500, price: 35, description: "Idéal pour TikTok, Instagram, Facebook et YouTube.", button: "Choisir le clip 3 min 30 — 35 €" },
  { code: "LONG" as const, title: "Clip 5:00", duration: "5 minutes", credits: 5_000, price: 50, description: "Idéal pour une chanson complète.", button: "Choisir le clip 5 minutes — 50 €" },
  { code: "PREMIUM" as const, title: "Clip 7:00", duration: "7 minutes", credits: 7_000, price: 70, description: "Idéal pour un clip long ou une version étendue.", button: "Choisir le clip 7 minutes — 70 €" },
];

function putDraft(photo: File | null, audio: File | null, idea: string, plan: PlanCode, style: string, audioStartSeconds: number) {
  if (!("indexedDB" in window)) return;
  const request = indexedDB.open("rudyo-simple-clip", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("draft");
  request.onsuccess = () => request.result.transaction("draft", "readwrite").objectStore("draft").put({ photo, audio, idea, plan, style, audioStartSeconds }, "current");
}

function readDraft(callback: (draft: { photo?: File; audio?: File; idea?: string; plan?: PlanCode; style?: string; audioStartSeconds?: number }) => void) {
  if (!("indexedDB" in window)) return;
  const request = indexedDB.open("rudyo-simple-clip", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("draft");
  request.onsuccess = () => {
    const result = request.result.transaction("draft", "readonly").objectStore("draft").get("current");
    result.onsuccess = () => { if (result.result) callback(result.result); };
  };
}

export default function SimpleClipCreator() {
  const { status: sessionStatus } = useSession();
  const [photo, setPhoto] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [idea, setIdea] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [style, setStyle] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>("TIKTOK");
  const [audioStartSeconds, setAudioStartSeconds] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [clipState, setClipState] = useState<ClipState>("form");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("Importation de vos fichiers");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [resumeQuote, setResumeQuote] = useState<Quote | null>(null);
  const [paymentReturn, setPaymentReturn] = useState(false);
  const autoConfirmAttempted = useRef(false);
  const actionInFlight = useRef(false);
  const [resultDetails, setResultDetails] = useState<{ title: string; durationSeconds: number; createdAt: string; downloadUrl: string } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const photoUrl = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  const audioUrl = useMemo(() => audio ? URL.createObjectURL(audio) : "", [audio]);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      readDraft((draft) => { setPhoto(draft.photo || null); setAudio(draft.audio || null); setIdea(draft.idea || ""); setSelectedPlan(draft.plan || "TIKTOK"); setStyle(draft.style || ""); setAudioStartSeconds(draft.audioStartSeconds || 0); });
      const search = new URLSearchParams(window.location.search);
      const resume = search.get("resumeProjectId");
      if (resume) {
        setProjectId(resume);
        setPaymentReturn(search.get("payment") === "success");
        setClipState("draft");
      } else {
        const active = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
        if (active) { setProjectId(active); setClipState("processing"); }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadQuote = useCallback(async () => {
    if (!audio) { setQuote(null); return; }
    try {
      const form = new FormData(); form.set("audio", audio); form.set("audioStartSeconds", String(audioStartSeconds)); form.set("plan", selectedPlan);
      const response = await fetch("/api/simple-clips/quote", { method: "POST", body: form, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setQuote(body);
    } catch { setQuote(null); }
  }, [audio, audioStartSeconds, selectedPlan]);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadQuote(), 0);
    return () => window.clearTimeout(timer);
  }, [loadQuote, sessionStatus]);

  useEffect(() => {
    if (!projectId || clipState !== "processing") return;
    let stopped = false;
    async function poll() {
      try {
        const response = await fetch(`/api/simple-clips/${encodeURIComponent(projectId!)}`, { cache: "no-store" });
        const body = await response.json() as StatusPayload;
        if (!response.ok) throw new Error(body.error || "Suivi indisponible.");
        if (stopped) return;
        setProgress(body.progress ?? 0); setProgressMessage(body.message);
        if (body.state === "draft") { setResumeQuote(body as Quote); setClipState("draft"); }
        if (body.state === "completed") { setVideoUrl(body.videoUrl || ""); setResultDetails({ title: body.projectTitle || "Mon clip Rudyo", durationSeconds: body.durationSeconds || 0, createdAt: body.createdAt || new Date().toISOString(), downloadUrl: body.downloadUrl || body.videoUrl || "" }); setClipState("completed"); window.localStorage.removeItem(ACTIVE_PROJECT_KEY); }
        if (body.state === "failed") { setError(body.message); setClipState("failed"); window.localStorage.removeItem(ACTIVE_PROJECT_KEY); }
      } catch { if (!stopped) setProgressMessage("Votre clip continue en arrière-plan"); }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [clipState, projectId]);

  useEffect(() => {
    if (!projectId || clipState !== "draft") return;
    let stopped = false;
    async function loadDraft() {
      try {
        const response = await fetch(`/api/simple-clips/${encodeURIComponent(projectId!)}`, { cache: "no-store" });
        const body = await response.json() as StatusPayload;
        if (!response.ok || body.state !== "draft") throw new Error(body.error || "Brouillon indisponible.");
        if (!stopped) {
          setResumeQuote(body as Quote);
        }
      } catch (draftError) {
        if (!stopped) setError(draftError instanceof Error ? draftError.message : "Brouillon indisponible.");
      }
    }
    void loadDraft();
    const timer = paymentReturn ? window.setInterval(() => void loadDraft(), 3000) : undefined;
    return () => { stopped = true; if (timer) window.clearInterval(timer); };
  }, [clipState, paymentReturn, projectId]);

  useEffect(() => {
    if (!paymentReturn || clipState !== "draft" || !resumeQuote?.allowed || autoConfirmAttempted.current) return;
    autoConfirmAttempted.current = true;
    void confirmResumedDraft();
  // The webhook updates the balance; this effect resumes the paid project exactly once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipState, paymentReturn, resumeQuote?.allowed]);

  function selectPhoto(file?: File) {
    setError("");
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Choisissez une photo JPG, PNG ou WebP valide.");
    setPhoto(file);
  }
  function selectAudio(file?: File) {
    setError("");
    if (!file || !["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4"].includes(file.type)) return setError("Choisissez une musique MP3, WAV ou M4A valide.");
    setAudio(file);
    const url = URL.createObjectURL(file); const element = new Audio(url);
    element.onloadedmetadata = () => { setAudioDuration(element.duration); URL.revokeObjectURL(url); };
  }
  function onDrop(event: DragEvent<HTMLDivElement>, kind: "photo" | "audio") {
    event.preventDefault(); const file = event.dataTransfer.files[0];
    if (kind === "photo") selectPhoto(file); else selectAudio(file);
  }
  function buildClipForm(intent: "generate" | "prepare_only") {
    const form = new FormData();
    if (photo) form.set("photo", photo);
    if (audio) form.set("audio", audio);
    Object.entries({ plan: selectedPlan, idea, style, audioStartSeconds: String(audioStartSeconds), intent }).forEach(([key, value]) => form.set(key, value));
    return form;
  }
  async function startMissingCreditsCheckout() {
    if (!photo || !audio || !quote || quote.missingCredits <= 0 || actionInFlight.current) return;
    actionInFlight.current = true;
    setCheckoutLoading(true);
    setError("");
    putDraft(photo, audio, idea, selectedPlan, style, audioStartSeconds);
    try {
      const prepare = await fetch("/api/simple-clips", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: buildClipForm("prepare_only") });
      const draft = await prepare.json() as { projectId?: string; error?: string };
      if (!draft.projectId) throw new Error(draft.error || "Le brouillon n’a pas pu être conservé.");
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, draft.projectId);
      const checkout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ mode: "clip_topup", projectId: draft.projectId }),
      });
      const payment = await checkout.json() as { url?: string; error?: string };
      if (!checkout.ok || !payment.url) throw new Error(payment.error || "Paiement indisponible.");
      window.location.href = payment.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Paiement indisponible.");
      setCheckoutLoading(false);
      actionInFlight.current = false;
    }
  }
  function prepareGeneration() {
    setError("");
    if (!photo || !audio || idea.trim().length < 10) return setError("Ajoutez votre photo, votre musique et décrivez votre idée en une phrase.");
    putDraft(photo, audio, idea, selectedPlan, style, audioStartSeconds);
    if (sessionStatus !== "authenticated") return setAuthPrompt(true);
    if (!quote) return setError("Le prix n’est pas disponible. Réessayez dans un instant.");
    if (!quote.supported) return setError("Votre musique dépasse la durée maximale automatique de 7 minutes.");
    if (!quote.fitsSelectedPlan) return setError("Choisissez une formule assez longue pour conserver toute votre musique.");
    if (!quote.workerAvailable) return setError("Le service de création est momentanément indisponible. Aucun crédit ne sera débité.");
    if (quote.refusalCode === "INSUFFICIENT_CREDITS") { void startMissingCreditsCheckout(); return; }
    if (!quote.allowed) return setError("Cette formule est temporairement indisponible.");
    upload();
  }
  function upload() {
    if (!photo || !audio || !quote?.allowed || actionInFlight.current) return;
    actionInFlight.current = true;
    setClipState("processing"); setProgress(4); setProgressMessage("Préparation de votre projet");
    const form = buildClipForm("generate");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/simple-clips"); xhr.setRequestHeader("Idempotency-Key", crypto.randomUUID());
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.min(28, Math.round(event.loaded / event.total * 28))); };
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "{}") as { projectId?: string; error?: string };
      if (xhr.status < 200 || xhr.status >= 300 || !body.projectId) {
        if (body.projectId) {
          setProjectId(body.projectId);
          window.localStorage.setItem(ACTIVE_PROJECT_KEY, body.projectId);
          setError(body.error || "Votre brouillon est conservé. Réessayez lorsque le service sera disponible.");
          setClipState("draft");
          actionInFlight.current = false;
          return;
        }
        setError(body.error || "La création n’a pas pu démarrer."); setClipState("failed"); actionInFlight.current = false; return;
      }
      setProjectId(body.projectId); window.localStorage.setItem(ACTIVE_PROJECT_KEY, body.projectId); setProgress(34); setProgressMessage("Préparation de votre scénario");
    };
    xhr.onerror = () => { setError("L’envoi a été interrompu. Vous pouvez recommencer."); setClipState("failed"); actionInFlight.current = false; };
    xhr.send(form);
  }
  async function confirmResumedDraft() {
    if (!projectId || !resumeQuote?.allowed) return;
    setError("");
    try {
      const response = await fetch(`/api/simple-clips/${encodeURIComponent(projectId)}/confirm`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "La génération n’a pas pu démarrer.");
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
      setPaymentReturn(false);
      setClipState("processing");
      setProgress(5);
      setProgressMessage("Préparation de votre scénario");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "La génération n’a pas pu démarrer.");
    }
  }
  async function checkoutSavedDraft() {
    if (!projectId || !resumeQuote || resumeQuote.missingCredits <= 0) return;
    setCheckoutLoading(true);
    setError("");
    try {
      const checkout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ mode: "clip_topup", projectId }),
      });
      const payment = await checkout.json() as { url?: string; error?: string };
      if (!checkout.ok || !payment.url) throw new Error(payment.error || "Paiement indisponible.");
      window.location.href = payment.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Paiement indisponible.");
      setCheckoutLoading(false);
    }
  }
  function reset() { window.localStorage.removeItem(ACTIVE_PROJECT_KEY); setClipState("form"); setProgress(0); setProjectId(null); setVideoUrl(""); setResultDetails(null); setError(""); }
  const selectedOption = planOptions.find((option) => option.code === selectedPlan)!;
  const formComplete = Boolean(photo && audio && idea.trim().length >= 10);

  if (clipState === "processing") return <ProgressScreen progress={progress} message={progressMessage} />;
  if (clipState === "draft") return <DraftResumeScreen quote={resumeQuote} paymentReturn={paymentReturn} checkoutLoading={checkoutLoading} error={error} onConfirm={() => void confirmResumedDraft()} onBuy={() => void checkoutSavedDraft()} />;
  if (clipState === "completed") return <ResultScreen videoUrl={videoUrl} details={resultDetails} onReset={() => { setPhoto(null); setAudio(null); setIdea(""); reset(); }} onEdit={reset} />;
  if (clipState === "failed") return <ErrorScreen message={error} onRetry={projectId ? () => setClipState("processing") : reset} onEdit={reset} />;

  return <section className="mx-auto max-w-5xl px-4 pb-12 pt-28 sm:px-6">
    <div className="text-center"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200"><Sparkles size={16} /> Trois durées, trois prix fixes</span><h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">Créez votre clip jusqu’à 7 minutes</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">Choisissez votre formule, puis ajoutez votre photo, votre musique et votre idée.</p></div>
    <section aria-labelledby="clip-plan-heading" className="mt-12">
      <div className="text-center"><p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Étape 1</p><h2 id="clip-plan-heading" className="mt-3 text-3xl font-black">Choisissez votre formule</h2></div>
      <div className="mt-7 grid gap-5 md:grid-cols-3">{planOptions.map((option) => {
        const selected = selectedPlan === option.code;
        return <article key={option.code} className={`rounded-3xl border p-6 transition ${selected ? "border-cyan-300 bg-cyan-950/30 shadow-[0_0_30px_rgba(34,211,238,0.12)]" : "border-slate-800 bg-slate-950"}`}>
          {selected ? <p className="mb-3 text-sm font-black text-cyan-200"><Check className="mr-1 inline" size={16} /> Formule sélectionnée</p> : null}
          <h3 className="text-2xl font-black">{option.title}</h3><p className="mt-3 font-bold text-cyan-100">Jusqu’à {option.duration}</p><p className="mt-5 text-3xl font-black">{option.credits.toLocaleString("fr-FR")} crédits</p><p className="mt-1 text-lg text-slate-300">{option.price} €</p><p className="mt-4 min-h-12 text-sm leading-6 text-slate-400">{option.description}</p>
          <button type="button" onClick={() => { setSelectedPlan(option.code); setError(""); }} aria-pressed={selected} className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-black ${selected ? "bg-cyan-300 text-slate-950" : "border border-slate-700 text-white hover:border-cyan-300"}`}>{selected ? "Formule sélectionnée" : option.button}</button>
        </article>;
      })}</div>
    </section>
    <div className="mt-12 space-y-5 rounded-[2rem] border border-slate-700/80 bg-slate-950/85 p-4 shadow-2xl sm:p-8">
      <div><p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Étape 2</p><h2 className="mt-2 text-2xl font-black">Ajoutez les éléments de votre clip</h2></div>
      <UploadCard number="1" title="Ma photo" subtitle="Ajoutez une photo nette de l’artiste" icon={ImagePlus} onDrop={(event) => onDrop(event, "photo")}>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => selectPhoto(event.target.files?.[0])} />
        {photo && photoUrl ? <div className="flex items-center gap-4"><div className="relative h-24 w-24 overflow-hidden rounded-2xl"><Image src={photoUrl} alt="Aperçu de l’artiste" fill sizes="96px" className="object-cover" unoptimized /></div><FileActions name={photo.name} onReplace={() => photoInput.current?.click()} onDelete={() => setPhoto(null)} /></div> : <EmptyUpload onClick={() => photoInput.current?.click()} label="Choisir ou déposer une photo" formats="JPG, PNG ou WebP" />}
      </UploadCard>
      <UploadCard number="2" title="Ma musique" subtitle="Ajoutez votre chanson" icon={Music2} onDrop={(event) => onDrop(event, "audio")}>
        <input ref={audioInput} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,.m4a" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => selectAudio(event.target.files?.[0])} />
        {audio ? <div><FileActions name={`${audio.name}${quote ? ` · ${Math.floor(quote.normalizedSeconds / 60)}:${String(quote.normalizedSeconds % 60).padStart(2, "0")}` : ""}`} onReplace={() => audioInput.current?.click()} onDelete={() => { setAudio(null); setAudioDuration(0); }} /><audio controls preload="metadata" src={audioUrl} className="mt-4 h-10 w-full" /></div> : <EmptyUpload onClick={() => audioInput.current?.click()} label="Choisir ou déposer une chanson" formats="MP3, WAV ou M4A" />}
      </UploadCard>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7"><Heading number="3" title="Mon idée de clip" subtitle="Une phrase suffit" /><textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder={example} maxLength={3000} rows={6} className="mt-5 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 p-4 leading-7 outline-none placeholder:text-slate-600 focus:border-cyan-300" /><div className="mt-4 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} type="button" onClick={() => setIdea((value) => `${value.trim()}${value.trim() ? " " : ""}Style ${item.toLowerCase()}.`)} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-cyan-400">+ {item}</button>)}</div></div>
      <details className="group rounded-2xl border border-slate-800 bg-slate-950 p-5"><summary className="flex cursor-pointer list-none items-center justify-between font-bold text-slate-300">Options avancées <ChevronDown className="transition group-open:rotate-180" size={18} /></summary><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-slate-300">Style visuel<input value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Ex. lumière dorée" maxLength={120} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-normal text-white" /></label><label className="text-sm font-bold text-slate-300">Début de l’extrait (secondes)<input type="number" min="0" max={Math.max(0, Math.floor(audioDuration - 1))} value={audioStartSeconds} onChange={(event) => setAudioStartSeconds(Math.max(0, Number(event.target.value) || 0))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-normal text-white" /></label></div></details>
      {quote ? <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4 text-center">{quote.supported ? <><p className="font-black text-cyan-100">{quote.planName} — {quote.totalCredits.toLocaleString("fr-FR")} crédits, soit {quote.priceEur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p><p className="mt-2 text-sm text-slate-300">Durée détectée : {Math.floor(quote.normalizedSeconds / 60)} min {String(quote.normalizedSeconds % 60).padStart(2, "0")} s · Solde actuel : {quote.balance ?? "—"} · Crédits manquants : {quote.missingCredits.toLocaleString("fr-FR")} · Solde après génération : {quote.balanceAfter ?? "—"}</p>{!quote.fitsSelectedPlan && quote.recommendedPlan ? <div role="alert" className="mt-4 rounded-xl border border-amber-400/40 bg-amber-950/30 p-4 text-amber-100"><p>Votre musique dure {Math.floor(quote.normalizedSeconds / 60)} minutes{quote.normalizedSeconds % 60 ? ` ${quote.normalizedSeconds % 60} secondes` : ""}. Choisissez une formule plus longue pour créer le clip complet.</p><button type="button" onClick={() => setSelectedPlan(quote.recommendedPlan!)} className="mt-3 rounded-lg bg-amber-300 px-4 py-2 font-black text-slate-950">{quote.recommendedPlan === "LONG" ? "Passer à la formule 5 minutes — 50 €" : "Passer à la formule 7 minutes — 70 €"}</button></div> : null}{quote.missingCredits > 0 && quote.fitsSelectedPlan ? <p className="mt-3 font-bold text-amber-200">Il vous manque {quote.missingCredits.toLocaleString("fr-FR")} crédits, soit {quote.missingPriceEur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €.</p> : null}</> : <p role="alert" className="font-black text-amber-100">Votre musique dépasse la durée maximale automatique de 7 minutes. La création automatique est indisponible.</p>}</div> : null}
      {error ? <p role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100">{error}</p> : null}
      <button type="button" onClick={prepareGeneration} disabled={!formComplete || !quote?.supported || !quote.fitsSelectedPlan || checkoutLoading || (!quote.allowed && quote.refusalCode !== "INSUFFICIENT_CREDITS")} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-300 px-6 py-5 text-lg font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><WandSparkles /> {checkoutLoading ? "Conservation du projet…" : quote?.refusalCode === "INSUFFICIENT_CREDITS" ? `Payer ${quote.missingPriceEur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € et créer mon clip` : `Créer mon clip — ${selectedOption.credits.toLocaleString("fr-FR")} crédits / ${selectedOption.price} €`}</button>
      {quote?.workerState === "STARTING" ? <p className="rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4 text-center text-cyan-100">Démarrage du service de création…</p> : null}
      {quote?.refusalCode === "WORKER_UNAVAILABLE" ? <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4 text-center text-amber-200"><p>La création est temporairement indisponible. Aucun crédit ne sera débité.</p><button type="button" onClick={() => void loadQuote()} className="mt-3 rounded-xl border border-amber-300/50 px-4 py-2 font-black">Réessayer</button></div> : null}
      <p className="text-center text-xs text-slate-500">En lançant la création, vous confirmez disposer des droits sur la photo et la musique importées.</p>
    </div>
    {authPrompt ? <Modal onClose={() => setAuthPrompt(false)}><h2 className="text-2xl font-black">Gardons votre travail au chaud</h2><p className="mt-4 leading-7 text-slate-300">Créez votre compte ou connectez-vous. Votre photo, votre musique et votre idée resteront ici.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><Link href="/login?returnTo=/" className="rounded-xl border border-slate-700 px-4 py-3 text-center font-bold">Connexion</Link><Link href="/inscription?returnTo=/" className="rounded-xl bg-cyan-300 px-4 py-3 text-center font-black text-slate-950">Créer mon compte</Link></div></Modal> : null}
  </section>;
}

function Heading({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-center gap-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-cyan-400 font-black text-slate-950">{number}</span><div><h2 className="text-xl font-black">{title}</h2><p className="text-sm text-slate-400">{subtitle}</p></div></div>; }
function UploadCard({ number, title, subtitle, icon: Icon, children, onDrop }: { number: string; title: string; subtitle: string; icon: typeof Music2; children: React.ReactNode; onDrop: (event: DragEvent<HTMLDivElement>) => void }) { return <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7"><div className="flex items-center gap-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-cyan-400 font-black text-slate-950">{number}</span><Icon className="text-cyan-300" /><div><h2 className="text-xl font-black">{title}</h2><p className="text-sm text-slate-400">{subtitle}</p></div></div><div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/80 p-5 hover:border-cyan-400">{children}</div></div>; }
function EmptyUpload({ onClick, label, formats }: { onClick: () => void; label: string; formats: string }) { return <button type="button" onClick={onClick} className="flex w-full flex-col items-center py-5"><UploadCloud className="text-cyan-300" size={34} /><span className="mt-3 font-bold">{label}</span><span className="mt-1 text-xs text-slate-500">{formats}</span></button>; }
function FileActions({ name, onReplace, onDelete }: { name: string; onReplace: () => void; onDelete: () => void }) { return <div className="min-w-0 flex-1"><p className="truncate font-bold">{name}</p><p className="mt-1 flex items-center gap-1 text-xs text-emerald-300"><Check size={14} /> Fichier prêt</p><div className="mt-3 flex gap-2"><button onClick={onReplace} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold">Remplacer</button><button aria-label="Supprimer" onClick={onDelete} className="rounded-lg border border-rose-500/30 px-3 py-2 text-rose-300"><Trash2 size={15} /></button></div></div>; }
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950 p-7">{children}</div></div>; }
function ProgressScreen({ progress, message }: { progress: number; message: string }) {
  const steps = [
    ["Préparation du projet", 5], ["Analyse de la musique", 15], ["Création du scénario", 30],
    ["Génération des scènes", 50], ["Montage avec votre musique", 72], ["Finalisation du clip", 92], ["Votre clip est prêt", 100],
  ] as const;
  return <section className="mx-auto grid min-h-[80vh] max-w-3xl place-items-center px-5 pt-20"><div className="w-full rounded-[2rem] border border-slate-800 bg-slate-950/85 p-8 sm:p-12"><Loader2 className="mx-auto animate-spin text-cyan-300" size={48} /><h1 className="mt-6 text-center text-3xl font-black sm:text-5xl">Votre clip est en cours de création</h1><div className="mt-8 h-3 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-4 text-center font-bold text-cyan-200">{message}</p><ol className="mt-8 space-y-3 text-left">{steps.map(([label, threshold], index) => { const done = progress >= threshold; const current = !done && (index === 0 || progress >= steps[index - 1][1]); return <li key={label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${done ? "border-emerald-400/30 text-emerald-200" : current ? "border-cyan-400/40 bg-cyan-950/20 text-cyan-100" : "border-slate-800 text-slate-500"}`}>{done ? <Check size={18} /> : current ? <Loader2 className="animate-spin" size={18} /> : <span className="grid h-[18px] w-[18px] place-items-center rounded-full border border-current text-[10px]">{index + 1}</span>}<span className="font-bold">{label}</span></li>; })}</ol><p className="mt-8 text-center text-sm text-slate-400">Vous pouvez quitter cette page. Votre clip restera disponible dans Mes créations.</p></div></section>;
}
function DraftResumeScreen({ quote, paymentReturn, checkoutLoading, error, onConfirm, onBuy }: { quote: Quote | null; paymentReturn: boolean; checkoutLoading: boolean; error: string; onConfirm: () => void; onBuy: () => void }) {
  const waitingForWebhook = paymentReturn && quote && quote.missingCredits > 0;
  return <section className="mx-auto grid min-h-[80vh] max-w-3xl place-items-center px-5 pt-20 text-center"><div className="w-full rounded-[2rem] border border-cyan-400/30 bg-slate-950/90 p-8 sm:p-12">
    {!quote || waitingForWebhook ? <Loader2 className="mx-auto animate-spin text-cyan-300" size={44} /> : <Check className="mx-auto text-emerald-300" size={48} />}
    <h1 className="mt-6 text-3xl font-black sm:text-5xl">{waitingForWebhook ? "Confirmation sécurisée du paiement" : "Votre projet est prêt à reprendre"}</h1>
    {quote ? <><p className="mt-5 text-lg text-slate-200">{quote.planName} · {quote.normalizedSeconds} secondes · {quote.totalCredits.toLocaleString("fr-FR")} crédits</p><p className="mt-3 text-slate-300">{quote.missingCredits > 0 ? `Il manque encore ${quote.missingCredits.toLocaleString("fr-FR")} crédits. Le webhook Stripe peut prendre quelques secondes.` : "Vos crédits ont été ajoutés. Vous pouvez maintenant générer votre clip."}</p></> : <p className="mt-5 text-slate-300">Chargement de votre brouillon privé…</p>}
    {error ? <p role="alert" className="mt-5 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-rose-100">{error}</p> : null}
    {quote?.allowed ? <button type="button" onClick={onConfirm} className="mt-8 w-full rounded-2xl bg-cyan-300 px-6 py-5 text-lg font-black text-slate-950">Confirmer et générer mon clip</button> : null}
    {quote && quote.missingCredits > 0 && !waitingForWebhook ? <button type="button" onClick={onBuy} disabled={checkoutLoading} className="mt-8 w-full rounded-2xl bg-cyan-300 px-6 py-5 text-lg font-black text-slate-950 disabled:opacity-50">{checkoutLoading ? "Ouverture du paiement…" : `Acheter ${quote.missingCredits.toLocaleString("fr-FR")} crédits — ${quote.missingPriceEur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}</button> : null}
    {quote && !quote.workerAvailable ? <p className="mt-5 text-amber-200">Le worker est indisponible. Votre projet reste conservé et aucun crédit ne sera débité.</p> : null}
    <p className="mt-5 text-xs text-slate-500">Aucune génération n’est lancée sans cette confirmation finale.</p>
  </div></section>;
}
function ResultScreen({ videoUrl, details, onReset, onEdit }: { videoUrl: string; details: { title: string; durationSeconds: number; createdAt: string; downloadUrl: string } | null; onReset: () => void; onEdit: () => void }) {
  const duration = details?.durationSeconds ? `${Math.floor(details.durationSeconds / 60)} min ${String(Math.round(details.durationSeconds) % 60).padStart(2, "0")} s` : "Durée indisponible";
  const date = details?.createdAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(details.createdAt)) : "";
  return <section className="mx-auto max-w-4xl px-5 pb-16 pt-28 text-center"><div className="rounded-[2rem] border border-emerald-400/30 bg-slate-950/90 p-6 sm:p-10"><h1 className="text-4xl font-black">Votre clip est prêt !</h1><h2 className="mt-4 text-xl font-bold text-cyan-100">{details?.title || "Mon clip Rudyo"}</h2><p className="mt-2 text-sm text-slate-400">{duration}{date ? ` · Créé le ${date}` : ""}</p><video controls playsInline src={videoUrl} className="mt-8 aspect-video w-full rounded-2xl bg-black" /><a href={details?.downloadUrl || videoUrl} download className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-6 py-4 font-black text-slate-950"><Download /> Télécharger mon clip sur mon ordinateur</a><div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={onReset} className="rounded-xl border border-slate-700 px-4 py-3 font-bold">Créer un autre clip</button><button onClick={onEdit} className="rounded-xl border border-slate-700 px-4 py-3 font-bold">Modifier et régénérer</button></div></div></section>;
}
function ErrorScreen({ message, onRetry, onEdit }: { message: string; onRetry: () => void; onEdit: () => void }) { return <section className="mx-auto grid min-h-[80vh] max-w-2xl place-items-center px-5 pt-20 text-center"><div className="rounded-[2rem] border border-rose-500/30 bg-slate-950/90 p-8"><h1 className="text-3xl font-black">Nous n’avons pas pu terminer ce clip</h1><p className="mt-5 leading-7 text-slate-300">{message || "Vos crédits ont été recrédités. Vous pouvez recommencer."}</p><button onClick={onRetry} className="mt-7 w-full rounded-xl bg-cyan-300 px-5 py-4 font-black text-slate-950">Recommencer</button><button onClick={onEdit} className="mt-3 w-full rounded-xl border border-slate-700 px-5 py-3 font-bold">Modifier mon idée</button><a href="mailto:support@rudyo.ai" className="mt-5 inline-block text-sm text-slate-400 underline">Contacter l’assistance</a></div></section>; }
