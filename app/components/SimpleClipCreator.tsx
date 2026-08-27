"use client";

import { Check, ChevronDown, Download, ImagePlus, Loader2, Music2, Sparkles, Trash2, UploadCloud, WandSparkles } from "lucide-react";
import { upload as uploadBlob } from "@vercel/blob/client";
import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/app/components/SessionProvider";
import { buildClipCallToAction, CLIP_PLAN_CATALOG, formatCreditAmount, formatEuros } from "@/lib/clip-pricing";

type PlanCode = "TIKTOK" | "LONG" | "PREMIUM";
type Quote = { totalCredits: number; requiredCredits: number; priceEur: number; audioDurationSeconds: number; normalizedSeconds: number; billableDurationSeconds: number; plan: PlanCode | "CUSTOM"; planName: string; supported: boolean; fitsSelectedPlan: boolean; recommendedPlan: PlanCode | null; maxPriceEur: number | null; balance: number | null; balanceAfter: number | null; missingCredits: number; missingPriceEur: number; allowed: boolean; workerAvailable: boolean; workerState?: string; workerWaking?: boolean; refusalCode: string | null };
type ClipState = "form" | "draft" | "processing" | "completed" | "failed";
type StatusPayload = Partial<Quote> & { state: "draft" | "processing" | "completed" | "failed"; progress?: number; message: string; videoUrl?: string; downloadUrl?: string; projectTitle?: string; durationSeconds?: number; createdAt?: string; error?: string };
type UploadedClipFiles = { photoFile: File; audioFile: File; photoUrl: string; audioUrl: string };
const suggestions = ["Romantique", "Cinématographique", "Tropical", "Concert", "Gospel", "Zouk", "Urbain", "Élégant"];
const example = "Une chanteuse arrive dans un club élégant en voiture américaine blanche. Elle traverse une foule d’admirateurs, monte sur scène et chante devant le public. Style cinématographique, romantique et international.";
const ACTIVE_PROJECT_KEY = "rudyo-active-simple-clip";
const PRICING_NOTICE = "Prix calculé automatiquement selon la durée réelle de votre musique.";
const planOptions = [
  { code: "TIKTOK" as const, title: "Clip jusqu’à 3 min 30", duration: "3 minutes 30", maxCredits: CLIP_PLAN_CATALOG.TIKTOK.maxCredits, maxPrice: CLIP_PLAN_CATALOG.TIKTOK.maxPriceInEuros, description: "Idéal pour TikTok, Instagram, Facebook et YouTube.", button: "Choisir le clip jusqu’à 3 min 30" },
  { code: "LONG" as const, title: "Clip jusqu’à 5 minutes", duration: "5 minutes", maxCredits: CLIP_PLAN_CATALOG.LONG.maxCredits, maxPrice: CLIP_PLAN_CATALOG.LONG.maxPriceInEuros, description: "Idéal pour une chanson complète.", button: "Choisir le clip jusqu’à 5 minutes" },
  { code: "PREMIUM" as const, title: "Clip jusqu’à 7 minutes", duration: "7 minutes", maxCredits: CLIP_PLAN_CATALOG.PREMIUM.maxCredits, maxPrice: CLIP_PLAN_CATALOG.PREMIUM.maxPriceInEuros, description: "Idéal pour un clip long ou une version étendue.", button: "Choisir le clip jusqu’à 7 minutes" },
];

/**
 * Une réponse d'erreur n'est pas toujours du JSON : au-delà de la limite de
 * corps de requête, l'hébergeur renvoie un 413 en texte brut. On traduit le
 * code HTTP en message utile plutôt que de laisser fuir une erreur de parsing.
 */
function quoteFailureMessage(status: number, audioBytes: number): string {
  const size = `${(audioBytes / 1048576).toFixed(1)} Mo`;
  if (status === 413) return `Votre musique pèse ${size}, ce qui dépasse la taille que le serveur accepte de recevoir. Choisissez un MP3 plus léger ou une version compressée.`;
  if (status === 401 || status === 403) return "Connectez-vous pour obtenir le prix de votre clip.";
  if (status === 429) return "Trop de demandes de prix en peu de temps. Patientez quelques instants.";
  if (status >= 500) return "Le service de tarification est momentanément indisponible.";
  return `Le serveur a refusé le calcul du prix (code ${status}).`;
}

function safeUploadName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || "fichier";
}

async function readResponseBody<T>(response: Response): Promise<T> {
  const raw = await response.text();
  try {
    if (!raw.trim()) throw new SyntaxError("Empty response");
    return JSON.parse(raw) as T;
  }
  catch { throw new Error(response.status === 413 ? "Le fichier est trop volumineux pour cet envoi." : `Réponse serveur invalide (code ${response.status}).`); }
}

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
  const { status: sessionStatus, user, refreshSession } = useSession();
  const [photo, setPhoto] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [idea, setIdea] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const [style, setStyle] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>("TIKTOK");
  const [audioStartSeconds, setAudioStartSeconds] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
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
  const uploadedFiles = useRef<UploadedClipFiles | null>(null);
  const [resultDetails, setResultDetails] = useState<{ title: string; durationSeconds: number; createdAt: string; downloadUrl: string } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const photoUrl = useMemo(() => photo ? URL.createObjectURL(photo) : "", [photo]);
  const audioUrl = useMemo(() => audio ? URL.createObjectURL(audio) : "", [audio]);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      readDraft((draft) => { setPhoto(draft.photo || null); if (draft.audio) selectAudio(draft.audio); else setAudio(null); setIdea(draft.idea || ""); setSelectedPlan(draft.plan || "TIKTOK"); setStyle(draft.style || ""); setAudioStartSeconds(draft.audioStartSeconds || 0); });
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
    if (!audio || !Number.isFinite(audioDuration) || audioDuration <= 0) { setQuote(null); setQuoteError(""); return; }
    try {
      const response = await fetch("/api/simple-clips/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioDurationSeconds: audioDuration, audioStartSeconds, plan: selectedPlan }),
        cache: "no-store",
      });
      const raw = await response.text();
      let body: Quote | null = null;
      try { body = raw ? JSON.parse(raw) as Quote : null; } catch { body = null; }
      if (!response.ok || !body) {
        throw new Error((body as unknown as { error?: string } | null)?.error || quoteFailureMessage(response.status, audio.size));
      }
      setQuote(body);
      setQuoteError("");
      // La formule adaptée est appliquée d’office : l’utilisateur ne choisit jamais
      // une formule trop courte, et sa musique n’est donc jamais coupée.
      if (body.supported && body.recommendedPlan && body.recommendedPlan !== selectedPlan) {
        setSelectedPlan(body.recommendedPlan);
        setError("");
      }
    } catch (loadError) {
      // Un devis muet laisserait un bouton désactivé sans explication : on le dit.
      setQuote(null);
      setQuoteError(loadError instanceof Error && loadError.message ? loadError.message : "Le prix n’a pas pu être calculé.");
    }
  }, [audio, audioDuration, audioStartSeconds, selectedPlan]);
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
        const body = await readResponseBody<StatusPayload>(response);
        if (!response.ok) throw new Error(body.error || "Suivi indisponible.");
        if (stopped) return;
        setProgress(body.progress ?? 0); setProgressMessage(body.message);
        if (body.state === "draft") { setResumeQuote(body as Quote); setClipState("draft"); }
        if (body.state === "completed") { setVideoUrl(body.videoUrl || ""); setResultDetails({ title: body.projectTitle || "Mon clip Rudyo", durationSeconds: body.durationSeconds || 0, createdAt: body.createdAt || new Date().toISOString(), downloadUrl: body.downloadUrl || body.videoUrl || "" }); setClipState("completed"); window.localStorage.removeItem(ACTIVE_PROJECT_KEY); window.dispatchEvent(new Event("rudyo:credits-changed")); }
        if (body.state === "failed") { setError(body.message); setClipState("failed"); window.localStorage.removeItem(ACTIVE_PROJECT_KEY); window.dispatchEvent(new Event("rudyo:credits-changed")); }
      } catch { if (!stopped) setProgressMessage("Votre clip continue en arrière-plan"); }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [clipState, projectId, refreshSession]);

  useEffect(() => {
    if (!projectId || clipState !== "draft") return;
    let stopped = false;
    async function loadDraft() {
      try {
        const response = await fetch(`/api/simple-clips/${encodeURIComponent(projectId!)}`, { cache: "no-store" });
        const body = await readResponseBody<StatusPayload>(response);
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
    uploadedFiles.current = null;
    setPhoto(file);
  }
  function selectAudio(file?: File) {
    setError("");
    if (!file || !["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4"].includes(file.type)) return setError("Choisissez une musique MP3, WAV ou M4A valide.");
    uploadedFiles.current = null;
    setAudio(file);
    setAudioDuration(0);
    const url = URL.createObjectURL(file); const element = new Audio(url);
    element.onloadedmetadata = () => { setAudioDuration(element.duration); URL.revokeObjectURL(url); };
    element.onerror = () => { setQuote(null); setQuoteError("La durée de cette musique n’a pas pu être lue par votre navigateur."); URL.revokeObjectURL(url); };
  }
  function onDrop(event: DragEvent<HTMLDivElement>, kind: "photo" | "audio") {
    event.preventDefault(); const file = event.dataTransfer.files[0];
    if (kind === "photo") selectPhoto(file); else selectAudio(file);
  }
  async function uploadSelectedFiles() {
    if (!photo || !audio || !user) throw new Error("Connectez-vous pour importer vos fichiers.");
    const existing = uploadedFiles.current;
    if (existing?.photoFile === photo && existing.audioFile === audio) return existing;
    const progressByKind = { photo: 0, audio: 0 };
    const totalBytes = photo.size + audio.size;
    const updateProgress = (kind: "photo" | "audio", loaded: number) => {
      progressByKind[kind] = loaded;
      setProgress(Math.min(28, 4 + Math.round(((progressByKind.photo + progressByKind.audio) / totalBytes) * 24)));
    };
    const uploadOne = async (file: File, kind: "photo" | "audio") => {
      const name = safeUploadName(file.name);
      const pathname = `rudyo-video-studio/users/${user.id}/simple-clips/assets/${crypto.randomUUID()}/${name}`;
      return uploadBlob(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/simple-clips/uploads",
        clientPayload: JSON.stringify({ kind, fileName: name }),
        contentType: file.type,
        multipart: file.size >= 5 * 1024 * 1024,
        onUploadProgress: ({ loaded }) => updateProgress(kind, loaded),
      });
    };
    setProgressMessage("Importation sécurisée de vos fichiers");
    const [photoBlob, audioBlob] = await Promise.all([uploadOne(photo, "photo"), uploadOne(audio, "audio")]);
    const result = { photoFile: photo, audioFile: audio, photoUrl: photoBlob.url, audioUrl: audioBlob.url };
    uploadedFiles.current = result;
    return result;
  }
  async function buildClipRequest(intent: "generate" | "prepare_only") {
    if (!photo || !audio) throw new Error("Ajoutez votre photo et votre musique.");
    const files = await uploadSelectedFiles();
    return {
      body: JSON.stringify({
        plan: selectedPlan, idea, style, audioStartSeconds, intent,
        photoBlobUrl: files.photoUrl, audioBlobUrl: files.audioUrl,
        photoName: photo.name, audioName: audio.name,
      }),
      headers: { "Content-Type": "application/json" },
    };
  }
  async function startMissingCreditsCheckout() {
    if (!photo || !audio || !quote || quote.missingCredits <= 0 || actionInFlight.current) return;
    actionInFlight.current = true;
    setCheckoutLoading(true);
    setError("");
    putDraft(photo, audio, idea, selectedPlan, style, audioStartSeconds);
    try {
      const clipRequest = await buildClipRequest("prepare_only");
      const prepare = await fetch("/api/simple-clips", { method: "POST", headers: { ...clipRequest.headers, "Idempotency-Key": crypto.randomUUID() }, body: clipRequest.body });
      const draft = await readResponseBody<{ projectId?: string; error?: string }>(prepare);
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
    // L’effet d’auto-sélection réaligne la formule ; on attend simplement le devis à jour.
    if (!quote.fitsSelectedPlan) return setError("La formule adaptée à votre musique est en cours de sélection. Réessayez dans un instant.");
    if (!quote.workerAvailable) return setError("Le service de création est momentanément indisponible. Aucun crédit ne sera débité.");
    if (quote.refusalCode === "INSUFFICIENT_CREDITS") { void startMissingCreditsCheckout(); return; }
    if (!quote.allowed) return setError("Cette formule est temporairement indisponible.");
    void upload();
  }
  function prepareScenarioOnly() {
    setError("");
    if (!photo || !audio || idea.trim().length < 10 || !quote?.supported || !quote.fitsSelectedPlan) return setError("Complétez la photo, la musique, l’idée et la formule avant de préparer le scénario.");
    if (sessionStatus !== "authenticated") return setAuthPrompt(true);
    putDraft(photo, audio, idea, selectedPlan, style, audioStartSeconds);
    void upload("prepare_only");
  }
  async function upload(intent: "generate" | "prepare_only" = "generate") {
    if (!photo || !audio || !quote?.supported || !quote.fitsSelectedPlan || (intent === "generate" && !quote.allowed) || actionInFlight.current) return;
    actionInFlight.current = true;
    setClipState("processing"); setProgress(4); setProgressMessage("Préparation de votre projet");
    try {
      const clipRequest = await buildClipRequest(intent);
      const response = await fetch("/api/simple-clips", {
        method: "POST",
        headers: { ...clipRequest.headers, "Idempotency-Key": crypto.randomUUID() },
        body: clipRequest.body,
      });
      const body = await readResponseBody<(Partial<Quote> & { projectId?: string; error?: string; state?: string })>(response);
      if (!response.ok || !body.projectId) {
        if (body.projectId) {
          setProjectId(body.projectId);
          window.localStorage.setItem(ACTIVE_PROJECT_KEY, body.projectId);
          setError(body.error || "Votre brouillon est conservé. Réessayez lorsque le service sera disponible.");
          setClipState("draft");
          return;
        }
        throw new Error(body.error || "La création n’a pas pu démarrer.");
      }
      if (body.state === "draft") {
        setProjectId(body.projectId);
        setResumeQuote(body as Quote);
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, body.projectId);
        setClipState("draft");
        return;
      }
      setProjectId(body.projectId); window.localStorage.setItem(ACTIVE_PROJECT_KEY, body.projectId); setProgress(34); setProgressMessage("Préparation de votre scénario");
      await refreshSession();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "L’envoi a été interrompu. Vous pouvez recommencer.");
      setClipState("failed");
    } finally {
      actionInFlight.current = false;
    }
  }
  async function confirmResumedDraft() {
    if (!projectId || !resumeQuote?.allowed) return;
    setError("");
    try {
      const response = await fetch(`/api/simple-clips/${encodeURIComponent(projectId)}/confirm`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
      const body = await readResponseBody<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error || "La génération n’a pas pu démarrer.");
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
      setPaymentReturn(false);
      setClipState("processing");
      setProgress(5);
      setProgressMessage("Préparation de votre scénario");
      await refreshSession();
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
  /**
   * Relance la tâche existante sans nouveau débit. La photo, la musique et
   * l’idée restent en mémoire et dans le brouillon IndexedDB.
   */
  async function retryGeneration() {
    if (!projectId || actionInFlight.current) return;
    actionInFlight.current = true;
    setError("");
    try {
      const response = await fetch(`/api/simple-clips/${encodeURIComponent(projectId)}/retry`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() } });
      const body = await readResponseBody<{ error?: string }>(response);
      if (!response.ok) throw new Error(body.error || "La relance n’a pas pu démarrer.");
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
      setProgress(5);
      setProgressMessage("Nouvelle tentative de création");
      setClipState("processing");
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "La relance n’a pas pu démarrer.");
    } finally {
      actionInFlight.current = false;
    }
  }
  function reset() { window.localStorage.removeItem(ACTIVE_PROJECT_KEY); uploadedFiles.current = null; setClipState("form"); setProgress(0); setProjectId(null); setVideoUrl(""); setResultDetails(null); setError(""); }
  const formComplete = Boolean(photo && audio && idea.trim().length >= 10);
  // Un seul module tarifaire décide du libellé, du montant et du surcrédit Stripe.
  // Visiteur non connecté : on annonce le prix réel, la connexion est demandée ensuite.
  const callToAction = quote?.supported && quote.requiredCredits
    ? buildClipCallToAction({ requiredCredits: quote.requiredCredits, balanceCredits: quote.balance ?? quote.requiredCredits })
    : null;

  if (clipState === "processing") return <ProgressScreen progress={progress} message={progressMessage} />;
  if (clipState === "draft") return <DraftResumeScreen quote={resumeQuote} paymentReturn={paymentReturn} checkoutLoading={checkoutLoading} error={error} onConfirm={() => void confirmResumedDraft()} onBuy={() => void checkoutSavedDraft()} />;
  if (clipState === "completed") return <ResultScreen videoUrl={videoUrl} details={resultDetails} onReset={() => { setPhoto(null); setAudio(null); setIdea(""); reset(); }} onEdit={reset} />;
  if (clipState === "failed") return <ErrorScreen message={error} canRetry={Boolean(projectId)} onRetry={projectId ? () => void retryGeneration() : reset} onEdit={reset} />;

  return <section className="mx-auto max-w-5xl px-4 pb-12 pt-28 sm:px-6">
    <div className="text-center"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200"><Sparkles size={16} /> Trois durées, un prix à la minute</span><h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">Créez votre clip jusqu’à 7 minutes</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">Ajoutez votre photo, votre musique et votre idée : la formule est choisie pour vous.</p></div>
    <section aria-labelledby="clip-plan-heading" className="mt-12">
      <div className="text-center"><p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Étape 1</p><h2 id="clip-plan-heading" className="mt-3 text-3xl font-black">Choisissez votre formule</h2><p className="mx-auto mt-3 max-w-xl text-slate-300">{PRICING_NOTICE}</p></div>
      <div className="mt-7 grid gap-5 md:grid-cols-3">{planOptions.map((option) => {
        const selected = selectedPlan === option.code;
        return <article key={option.code} className={`rounded-3xl border p-6 transition ${selected ? "border-cyan-300 bg-cyan-950/30 shadow-[0_0_30px_rgba(34,211,238,0.12)]" : "border-slate-800 bg-slate-950"}`}>
          {selected ? <p className="mb-3 text-sm font-black text-cyan-200"><Check className="mr-1 inline" size={16} /> Formule sélectionnée</p> : null}
          <h3 className="text-2xl font-black">{option.title}</h3><p className="mt-3 font-bold text-cyan-100">Jusqu’à {option.duration}</p><p className="mt-5 text-3xl font-black">maximum {option.maxPrice} €</p><p className="mt-1 text-lg text-slate-300">soit au plus {formatCreditAmount(option.maxCredits)} crédits</p><p className="mt-3 text-sm text-cyan-200/80">{PRICING_NOTICE}</p><p className="mt-4 min-h-12 text-sm leading-6 text-slate-400">{option.description}</p>
          <button type="button" onClick={() => { setSelectedPlan(option.code); setError(""); }} aria-pressed={selected} className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-black ${selected ? "bg-cyan-300 text-slate-950" : "border border-slate-700 text-white hover:border-cyan-300"}`}>{selected ? "Formule sélectionnée" : option.button}</button>
        </article>;
      })}</div>
    </section>
    <div className="mt-12 space-y-5 rounded-[2rem] border border-slate-700/80 bg-slate-950/85 p-4 shadow-2xl sm:p-8">
      <div><p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Étape 2</p><h2 className="mt-2 text-2xl font-black">Ajoutez les éléments de votre clip</h2></div>
      <UploadCard number="1" title="Ma photo" subtitle="Ajoutez une photo nette de l’artiste" icon={ImagePlus} onDrop={(event) => onDrop(event, "photo")}>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => selectPhoto(event.target.files?.[0])} />
        {photo && photoUrl ? <div className="flex items-center gap-4"><div className="relative h-24 w-24 overflow-hidden rounded-2xl"><Image src={photoUrl} alt="Aperçu de l’artiste" fill sizes="96px" className="object-cover" unoptimized /></div><FileActions name={photo.name} onReplace={() => photoInput.current?.click()} onDelete={() => { uploadedFiles.current = null; setPhoto(null); }} /></div> : <EmptyUpload onClick={() => photoInput.current?.click()} label="Choisir ou déposer une photo" formats="JPG, PNG ou WebP" />}
      </UploadCard>
      <UploadCard number="2" title="Ma musique" subtitle="Ajoutez votre chanson" icon={Music2} onDrop={(event) => onDrop(event, "audio")}>
        <input ref={audioInput} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,.m4a" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => selectAudio(event.target.files?.[0])} />
        {audio ? <div><FileActions name={`${audio.name}${quote ? ` · ${Math.floor(quote.normalizedSeconds / 60)}:${String(quote.normalizedSeconds % 60).padStart(2, "0")}` : ""}`} onReplace={() => audioInput.current?.click()} onDelete={() => { uploadedFiles.current = null; setAudio(null); setAudioDuration(0); }} /><audio controls preload="metadata" src={audioUrl} className="mt-4 h-10 w-full" /></div> : <EmptyUpload onClick={() => audioInput.current?.click()} label="Choisir ou déposer une chanson" formats="MP3, WAV ou M4A" />}
      </UploadCard>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7"><Heading number="3" title="Mon idée de clip" subtitle="Une phrase suffit" /><textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder={example} maxLength={3000} rows={6} className="mt-5 w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 p-4 leading-7 outline-none placeholder:text-slate-600 focus:border-cyan-300" /><div className="mt-4 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} type="button" onClick={() => setIdea((value) => `${value.trim()}${value.trim() ? " " : ""}Style ${item.toLowerCase()}.`)} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-cyan-400">+ {item}</button>)}</div></div>
      <details className="group rounded-2xl border border-slate-800 bg-slate-950 p-5"><summary className="flex cursor-pointer list-none items-center justify-between font-bold text-slate-300">Options avancées <ChevronDown className="transition group-open:rotate-180" size={18} /></summary><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-slate-300">Style visuel<input value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Ex. lumière dorée" maxLength={120} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-normal text-white" /></label><label className="text-sm font-bold text-slate-300">Début de l’extrait (secondes)<input type="number" min="0" max={Math.max(0, Math.floor(audioDuration - 1))} value={audioStartSeconds} onChange={(event) => setAudioStartSeconds(Math.max(0, Number(event.target.value) || 0))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-normal text-white" /></label></div></details>
      {!quote && quoteError && audio ? <div data-testid="clip-quote-error" role="alert" className="rounded-2xl border border-amber-400/40 bg-amber-950/25 p-4 text-center text-amber-100">
        <p className="font-black">Le prix n’a pas pu être calculé.</p>
        <p className="mt-2 text-sm">{quoteError}</p>
        <button type="button" onClick={() => void loadQuote()} className="mt-4 rounded-xl border border-amber-300/60 px-4 py-2 font-black">Recalculer le prix</button>
      </div> : null}
      {quote ? <div data-testid="clip-quote" className="rounded-2xl border border-cyan-400/30 bg-cyan-950/20 p-4 text-center">{quote.supported ? <>
        <p className="font-black text-cyan-100">Durée détectée : {Math.floor(quote.normalizedSeconds / 60)} min {String(quote.normalizedSeconds % 60).padStart(2, "0")} s</p>
        <p className="mt-1 text-cyan-100">{quote.planName} · {formatCreditAmount(quote.totalCredits)} crédits · {formatEuros(quote.priceEur)}</p>
        <p className="mt-2 text-sm text-slate-300">Solde actuel : {quote.balance === null ? "—" : formatCreditAmount(quote.balance)} crédits · Crédits manquants : {formatCreditAmount(quote.missingCredits)} · Solde après génération : {quote.balanceAfter === null ? "—" : formatCreditAmount(quote.balanceAfter)}</p>
        <p className="mt-2 text-xs text-cyan-200/70">{PRICING_NOTICE}</p>
        {!quote.fitsSelectedPlan && quote.recommendedPlan ? <p role="status" className="mt-3 rounded-xl border border-cyan-400/40 bg-cyan-950/40 p-3 text-sm text-cyan-100">Votre musique dure {quote.normalizedSeconds} secondes : la formule «&nbsp;{quote.planName}&nbsp;» a été sélectionnée automatiquement pour conserver l’intégralité du morceau.</p> : null}
        {quote.missingCredits > 0 ? <p className="mt-3 font-bold text-amber-200">Il vous manque {formatCreditAmount(quote.missingCredits)} crédits, soit {formatEuros(quote.missingPriceEur)}.{callToAction && callToAction.overcreditCredits > 0 ? ` Le minimum de paiement impose l’achat de ${formatCreditAmount(callToAction.purchasedCredits)} crédits, dont ${formatCreditAmount(callToAction.overcreditCredits)} crédits conservés sur votre solde.` : ""}</p> : null}
      </> : <p role="alert" className="font-black text-amber-100">Votre musique dure {quote.normalizedSeconds} secondes et dépasse la durée maximale automatique de 7 minutes (420 secondes). Aucun paiement n’est possible pour cette durée.</p>}</div> : null}
      {error ? <p role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100">{error}</p> : null}
      <button data-testid="clip-primary-action" type="button" onClick={prepareGeneration} disabled={!formComplete || !quote?.supported || checkoutLoading || (!quote.allowed && quote.refusalCode !== "INSUFFICIENT_CREDITS")} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-300 px-6 py-5 text-lg font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><WandSparkles /> {checkoutLoading ? "Conservation du projet…" : callToAction ? callToAction.label : !audio ? "Ajoutez votre musique pour connaître le prix" : quoteError ? "Prix indisponible — recalculez ci-dessus" : "Calcul du prix en cours…"}</button>
      {formComplete && quote?.supported && quote.fitsSelectedPlan && !quote.allowed && quote.refusalCode !== "INSUFFICIENT_CREDITS" ? <button type="button" onClick={prepareScenarioOnly} className="w-full rounded-2xl border border-cyan-300/50 px-6 py-4 font-black text-cyan-100">Préparer le scénario sans lancer Seedance</button> : null}
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
    {quote ? <><p className="mt-5 text-lg text-slate-200">{quote.planName} · {quote.normalizedSeconds} secondes · {quote.totalCredits.toLocaleString("fr-FR")} crédits</p><p className="mt-3 text-slate-300">{quote.missingCredits > 0 ? `Il manque encore ${quote.missingCredits.toLocaleString("fr-FR")} crédits. Le webhook Stripe peut prendre quelques secondes.` : quote.allowed ? "Vos crédits sont disponibles. Vous pouvez maintenant générer votre clip." : "Le scénario est conservé, mais aucune génération ni aucun débit ne sont autorisés pour le moment."}</p></> : <p className="mt-5 text-slate-300">Chargement de votre brouillon privé…</p>}
    {error ? <p role="alert" className="mt-5 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-rose-100">{error}</p> : null}
    {quote?.allowed ? <button type="button" onClick={onConfirm} className="mt-8 w-full rounded-2xl bg-cyan-300 px-6 py-5 text-lg font-black text-slate-950">Confirmer et générer mon clip</button> : null}
    {quote && quote.missingCredits > 0 && !waitingForWebhook ? <button type="button" onClick={onBuy} disabled={checkoutLoading} className="mt-8 w-full rounded-2xl bg-cyan-300 px-6 py-5 text-lg font-black text-slate-950 disabled:opacity-50">{checkoutLoading ? "Ouverture du paiement…" : `Acheter ${quote.missingCredits.toLocaleString("fr-FR")} crédits — ${quote.missingPriceEur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}</button> : null}
    {quote && !quote.workerAvailable ? <p className="mt-5 text-amber-200">Le worker est indisponible. Votre projet reste conservé et aucun crédit ne sera débité.</p> : null}
    <Link href="/creations" className="mt-6 inline-block font-bold text-cyan-200 underline">Voir le scénario dans Mes créations</Link>
    <p className="mt-5 text-xs text-slate-500">Aucune génération n’est lancée sans cette confirmation finale.</p>
  </div></section>;
}
function ResultScreen({ videoUrl, details, onReset, onEdit }: { videoUrl: string; details: { title: string; durationSeconds: number; createdAt: string; downloadUrl: string } | null; onReset: () => void; onEdit: () => void }) {
  const duration = details?.durationSeconds ? `${Math.floor(details.durationSeconds / 60)} min ${String(Math.round(details.durationSeconds) % 60).padStart(2, "0")} s` : "Durée indisponible";
  const date = details?.createdAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(details.createdAt)) : "";
  return <section className="mx-auto max-w-4xl px-5 pb-16 pt-28 text-center"><div className="rounded-[2rem] border border-emerald-400/30 bg-slate-950/90 p-6 sm:p-10"><h1 className="text-4xl font-black">Votre clip est prêt !</h1><h2 className="mt-4 text-xl font-bold text-cyan-100">{details?.title || "Mon clip Rudyo"}</h2><p className="mt-2 text-sm text-slate-400">{duration}{date ? ` · Créé le ${date}` : ""}</p><video controls playsInline src={videoUrl} className="mt-8 aspect-video w-full rounded-2xl bg-black" /><a href={details?.downloadUrl || videoUrl} download className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-6 py-4 font-black text-slate-950"><Download /> Télécharger mon clip sur mon ordinateur</a><div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={onReset} className="rounded-xl border border-slate-700 px-4 py-3 font-bold">Créer un autre clip</button><button onClick={onEdit} className="rounded-xl border border-slate-700 px-4 py-3 font-bold">Modifier et régénérer</button></div></div></section>;
}
function ErrorScreen({ message, canRetry, onRetry, onEdit }: { message: string; canRetry: boolean; onRetry: () => void; onEdit: () => void }) { return <section className="mx-auto grid min-h-[80vh] max-w-2xl place-items-center px-5 pt-20 text-center"><div className="rounded-[2rem] border border-rose-500/30 bg-slate-950/90 p-8"><h1 className="text-3xl font-black">Nous n’avons pas pu terminer ce clip</h1><p role="alert" className="mt-5 leading-7 text-slate-300">{message || "La création s’est interrompue. Votre photo, votre musique et votre idée sont conservées."}</p>{canRetry ? <p className="mt-3 text-sm text-cyan-200">Votre photo, votre musique et votre idée sont conservées. La relance ne vous débite pas une seconde fois.</p> : null}<button data-testid="clip-retry" onClick={onRetry} className="mt-7 w-full rounded-xl bg-cyan-300 px-5 py-4 font-black text-slate-950">{canRetry ? "Réessayer" : "Recommencer"}</button><button onClick={onEdit} className="mt-3 w-full rounded-xl border border-slate-700 px-5 py-3 font-bold">Modifier mon idée</button><a href="mailto:support@rudyo.ai" className="mt-5 inline-block text-sm text-slate-400 underline">Contacter l’assistance</a></div></section>; }
