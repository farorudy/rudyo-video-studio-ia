"use client";

import { useState, useEffect } from "react";
import TimelinePlans, { type TimelineClip } from "../components/TimelinePlans";
import ExportConfig, {
  type ExportConfigValues,
} from "../components/ExportConfig";
import {
  getAiModelOptions,
  getDefaultAiModel,
  isAiProvider,
  type AiProvider,
} from "@/lib/ai-provider";

type ClipPrompt = {
  id: number;
  nom: string;
  duree: string;
  description: string;
  promptVideo: string;
  promptImage: string;
  imageTestUrl: string;
  subtitleText?: string;
};

type StoryboardPlan = {
  plan: number;
  duree: string;
  description: string;
  camera: string;
  texte_ecran: string;
  prompt_video_ia: string;
  transition: string;
};

type StoryboardStructuredResult = {
  titre: string;
  type_video: string;
  format: string;
  style: string;
  duree_totale: string;
  resume: string;
  storyboard: StoryboardPlan[];
};

type ClipPackageResult = {
  provider?: string;
  clips: ClipPrompt[];
  montage: {
    commande: string;
    dossierPlans: string;
    audio: string;
    sortie: string;
  };
  exports: {
    json: string;
    texte: string;
  };
};

type GenerationJob = {
  clipId: number;
  clipName: string;
  status: string;
  provider: string;
  savedTo?: string;
  outputUrl?: string;
  webUrl?: string;
  getUrl?: string;
  predictionId?: string;
  error?: string;
};

type GenerationResult = {
  provider: string;
  model: string;
  jobs: GenerationJob[];
  manifest: string;
};

type UploadResult = {
  count: number;
  files: string[];
};

type AudioSection = {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
  energy: "low" | "medium" | "high";
};

type AudioAnalysisResult = {
  provider: string;
  fileName: string;
  durationSec: number;
  bpm: number;
  sections: AudioSection[];
  analyzedAt: string;
  audioRef: string;
  analysisRef: string;
};

type RemapStrategy = "conservative" | "balanced" | "aggressive";
type HistoryFilter = "all" | "locked";
type HistorySort = "newest" | "oldest";
type StoryboardMode =
  | "mock"
  | "live"
  | "fallback"
  | "openai"
  | "blackbox"
  | null;

type AiModelByProvider = Record<AiProvider, string>;

const HISTORY_FILTER_STORAGE_KEY = "rudyo:history-filter";
const AI_PROVIDER_STORAGE_KEY = "rudyo:ai-provider";
const AI_MODEL_STORAGE_KEY = "rudyo:ai-model-by-provider";

const AI_PROVIDER_OPTIONS: Array<{
  value: AiProvider;
  label: string;
  description: string;
}> = [
  {
    value: "ollama",
    label: "Ollama",
    description: "Local, sans clé API",
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "API officielle",
  },
  {
    value: "blackbox",
    label: "Blackbox AI",
    description: "OpenAI-compatible",
  },
];

function formatSecondsDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "6 secondes";
  }

  const rounded = Math.max(1, Math.round(seconds));
  return `${rounded} seconde${rounded > 1 ? "s" : ""}`;
}

function formatClockTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60)
    .toString()
    .padStart(2, "0");
  const secs = (rounded % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function toSectionId(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-");
}

function getAiProviderLabel(provider: AiProvider) {
  if (provider === "openai") {
    return "OpenAI";
  }

  if (provider === "blackbox") {
    return "Blackbox AI";
  }

  return "Ollama";
}

function getInitialAiModelByProvider(): AiModelByProvider {
  return {
    ollama: getDefaultAiModel("ollama"),
    openai: getDefaultAiModel("openai"),
    blackbox: getDefaultAiModel("blackbox"),
  };
}

function sanitizeAiModelByProvider(value: unknown): AiModelByProvider {
  const defaults = getInitialAiModelByProvider();

  if (!value || typeof value !== "object") {
    return defaults;
  }

  const candidate = value as Partial<Record<AiProvider, unknown>>;

  return {
    ollama:
      typeof candidate.ollama === "string" && candidate.ollama.trim()
        ? candidate.ollama.trim()
        : defaults.ollama,
    openai:
      typeof candidate.openai === "string" && candidate.openai.trim()
        ? candidate.openai.trim()
        : defaults.openai,
    blackbox:
      typeof candidate.blackbox === "string" && candidate.blackbox.trim()
        ? candidate.blackbox.trim()
        : defaults.blackbox,
  };
}

function clipEnergyScore(clip: TimelineClip) {
  const source =
    `${clip.nom} ${clip.description} ${clip.promptVideo} ${clip.promptImage}`.toLowerCase();

  const highMatches =
    source.match(
      /explosion|energie|énergie|dance|danse|chore|choregraph|chor[ée]graph|hero|h[ée]ro|climax|puissance|impact|intense|action|dynamic|epic|performance/g,
    )?.length ?? 0;

  const lowMatches =
    source.match(
      /calme|po[ée]tique|contemplatif|douce|intime|pause|slow|soft|respiration|suspendu/g,
    )?.length ?? 0;

  return highMatches - lowMatches;
}

function applySectionToClip(clip: TimelineClip, section: AudioSection) {
  const clipDurationSec = Math.max(0.2, section.endSec - section.startSec);

  return {
    ...clip,
    duree: formatSecondsDuration(clipDurationSec),
    startSec: section.startSec,
    endSec: section.endSec,
    sectionLabel: section.label,
    sectionEnergy: section.energy,
  };
}

function pickByScore(
  candidates: Array<{ clip: TimelineClip; index: number; score: number }>,
  mode: "highest" | "lowest" | "neutral",
  strategy: RemapStrategy,
) {
  if (candidates.length === 0) {
    return 0;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (mode === "highest") {
      return b.score - a.score;
    }

    if (mode === "lowest") {
      return a.score - b.score;
    }

    const distA = Math.abs(a.score);
    const distB = Math.abs(b.score);
    return distA - distB || a.index - b.index;
  });

  const fraction =
    strategy === "aggressive" ? 0 : strategy === "balanced" ? 0.25 : 0.5;
  const pickRank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * fraction)),
  );
  const picked = sorted[pickRank];

  return candidates.findIndex((candidate) => candidate === picked);
}

function mapClipsToAudioSections(
  clips: TimelineClip[],
  sections: AudioSection[],
  strategy: RemapStrategy,
): TimelineClip[] {
  if (clips.length === 0 || sections.length === 0) {
    return clips;
  }

  const indexed = clips.map((clip, index) => ({
    clip,
    index,
    score: clipEnergyScore(clip),
  }));
  const remaining = [...indexed];
  const mapped: TimelineClip[] = [];

  for (
    let sectionIndex = 0;
    sectionIndex < sections.length;
    sectionIndex += 1
  ) {
    if (remaining.length === 0) {
      break;
    }

    const section = sections[sectionIndex];

    const bestPos =
      section.energy === "high"
        ? pickByScore(remaining, "highest", strategy)
        : section.energy === "low"
          ? pickByScore(remaining, "lowest", strategy)
          : pickByScore(remaining, "neutral", strategy);

    const [selected] = remaining.splice(bestPos, 1);
    mapped.push(applySectionToClip(selected.clip, section));
  }

  if (remaining.length > 0) {
    const sortedRemaining = [...remaining].sort((a, b) => a.index - b.index);

    for (let i = 0; i < sortedRemaining.length; i += 1) {
      const section = sections[Math.min(i, sections.length - 1)];
      mapped.push(applySectionToClip(sortedRemaining[i].clip, section));
    }
  }

  return mapped;
}

type MontageResult = {
  sortie: string;
  tailleOctets: number;
  plansUtilises: string[];
  logs: string;
  thumbnailUrl?: string | null;
  mode?: string;
};

type SavedProject = {
  id: string;
  titre: string;
  savedAt: string;
  aiProvider?: AiProvider;
  aiModel?: string;
  aiModelByProvider?: Partial<Record<AiProvider, string>>;
  storyboard?: string | null;
  storyboardStructure?: StoryboardStructuredResult | null;
  audioAnalysis?: AudioAnalysisResult | null;
  clips?: TimelineClip[] | null;
  config?: Partial<ExportConfigValues> | null;
  remapStrategy?: RemapStrategy;
  manualOrderLocked?: boolean;
};

function isRemapStrategy(value: unknown): value is RemapStrategy {
  return (
    value === "conservative" || value === "balanced" || value === "aggressive"
  );
}

function isHistoryFilter(value: unknown): value is HistoryFilter {
  return value === "all" || value === "locked";
}

const DEFAULT_EXPORT_CONFIG: ExportConfigValues = {
  resolution: "1280x720",
  transitionType: "fade",
  transitionDuree: 0.5,
  musiqueVolume: 0.8,
  voixVolume: 1.0,
};

type WorkflowStep = {
  id: number;
  title: string;
  description: string;
  status: "waiting" | "current" | "done";
};

export default function Home() {
  const [titre, setTitre] = useState("Bòd lanmè pa lwen");
  const [typeVideo, setTypeVideo] = useState("Clip musical");
  const [duree, setDuree] = useState("3 minutes");
  const [format, setFormat] = useState("16:9 YouTube");
  const [style, setStyle] = useState("Cinématographique caribéen");
  const [nombrePlans, setNombrePlans] = useState("25");
  const [description, setDescription] = useState(
    "Un clip tourné en Guadeloupe sur le thème de la persévérance, de l’amour, de la pluie, du bord de mer et du lanbéli.",
  );

  const [resultat, setResultat] = useState("");
  const [storyboardStructure, setStoryboardStructure] =
    useState<StoryboardStructuredResult | null>(null);
  const [modeStoryboard, setModeStoryboard] = useState<StoryboardMode>(null);
  const [aiProvider, setAiProvider] = useState<AiProvider>("ollama");
  const [aiModelByProvider, setAiModelByProvider] = useState<AiModelByProvider>(
    getInitialAiModelByProvider(),
  );
  const [packClips, setPackClips] = useState<ClipPackageResult | null>(null);
  const [generationVideos, setGenerationVideos] =
    useState<GenerationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [audioAnalysis, setAudioAnalysis] =
    useState<AudioAnalysisResult | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [montageResult, setMontageResult] = useState<MontageResult | null>(
    null,
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [chargement, setChargement] = useState(false);
  const [chargementClips, setChargementClips] = useState(false);
  const [chargementGeneration, setChargementGeneration] = useState(false);
  const [chargementUpload, setChargementUpload] = useState(false);
  const [chargementAudio, setChargementAudio] = useState(false);
  const [chargementMontage, setChargementMontage] = useState(false);
  const [orderedClips, setOrderedClips] = useState<TimelineClip[]>([]);
  const [remapStrategy, setRemapStrategy] = useState<RemapStrategy>("balanced");
  const [manualOrderLocked, setManualOrderLocked] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfigValues>(
    DEFAULT_EXPORT_CONFIG,
  );
  const [projectHistory, setProjectHistory] = useState<SavedProject[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySort, setHistorySort] = useState<HistorySort>("newest");
  const [savingProject, setSavingProject] = useState(false);
  const [copiePromptsOk, setCopiePromptsOk] = useState(false);
  const [afficherTexteBrut, setAfficherTexteBrut] = useState(false);
  const [erreurCopiePrompts, setErreurCopiePrompts] = useState("");
  const [erreur, setErreur] = useState("");
  const [erreurClips, setErreurClips] = useState("");
  const [erreurGeneration, setErreurGeneration] = useState("");
  const [erreurUpload, setErreurUpload] = useState("");
  const [erreurAudio, setErreurAudio] = useState("");
  const [erreurMontage, setErreurMontage] = useState("");

  const metrics = [
    { label: "Storyboard", value: "Mode local", tone: "emerald" },
    { label: "Stockage", value: "Local ou Blob", tone: "amber" },
    { label: "Montage", value: "FFmpeg", tone: "sky" },
  ] as const;

  async function genererStoryboard() {
    setChargement(true);
    setResultat("");
    setStoryboardStructure(null);
    setModeStoryboard(null);
    setAfficherTexteBrut(false);
    setCopiePromptsOk(false);
    setErreurCopiePrompts("");
    setPackClips(null);
    setGenerationVideos(null);
    setUploadResult(null);
    setAudioAnalysis(null);
    setAudioCurrentTime(0);
    setAudioIsPlaying(false);
    setMontageResult(null);
    setSelectedFiles([]);
    setSelectedAudioFile(null);
    setOrderedClips([]);
    setErreur("");
    setErreurClips("");
    setErreurGeneration("");
    setErreurUpload("");
    setErreurAudio("");
    setErreurMontage("");

    try {
      const response = await fetch("/api/storyboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titre,
          typeVideo,
          duree,
          format,
          style,
          description,
          nombrePlans,
          provider: aiProvider,
          model: aiModelByProvider[aiProvider],
        }),
      });

      const data = await response.json();

      if (data.success && typeof data.storyboard === "string") {
        setResultat(data.storyboard);
        setStoryboardStructure(
          data.result && typeof data.result === "object" ? data.result : null,
        );
        setModeStoryboard(
          data.fallback
            ? "fallback"
            : data.mock
              ? "mock"
              : data.provider === "openai"
                ? "openai"
                : data.provider === "blackbox"
                  ? "blackbox"
                  : "live",
        );
      } else {
        setErreur(
          data.error || "Erreur : impossible de générer le storyboard.",
        );
      }
    } catch {
      setErreur("Erreur : impossible de générer le storyboard.");
    } finally {
      setChargement(false);
    }
  }

  async function preparerClips() {
    if (!resultat) {
      setErreurClips("Générez d'abord un storyboard.");
      return;
    }

    setChargementClips(true);
    setErreurClips("");

    try {
      const response = await fetch("/api/clip-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titre,
          duree,
          format,
          style,
          storyboard: resultat,
          provider: aiProvider,
        }),
      });

      const data = await response.json();

      if (data.success && data.result) {
        setPackClips(data.result);
        setCopiePromptsOk(false);
        setErreurCopiePrompts("");
        setGenerationVideos(null);
        setUploadResult(null);
        setMontageResult(null);
        // Initialiser la timeline avec les clips dans l'ordre par défaut
        const baseClips = (data.result as ClipPackageResult).clips.map((c) => ({
          ...c,
        }));

        setOrderedClips(
          audioAnalysis
            ? mapClipsToAudioSections(
                baseClips,
                audioAnalysis.sections,
                remapStrategy,
              )
            : baseClips,
        );
      } else {
        setErreurClips(
          data.error || "Erreur : impossible de préparer les clips.",
        );
      }
    } catch {
      setErreurClips("Erreur : impossible de préparer les clips.");
    } finally {
      setChargementClips(false);
    }
  }

  function copierTexteFallback(texte: string) {
    const textarea = document.createElement("textarea");
    textarea.value = texte;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  async function copierPromptsVideo() {
    if (!packClips) {
      return;
    }

    const prompts = packClips.clips
      .map(
        (clip) =>
          `Clip ${clip.id} - ${clip.nom}\nDurée : ${clip.duree}\nPrompt vidéo IA : ${clip.promptVideo}`,
      )
      .join("\n\n");

    setCopiePromptsOk(false);
    setErreurCopiePrompts("");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompts);
      } else {
        copierTexteFallback(prompts);
      }

      setCopiePromptsOk(true);
    } catch {
      try {
        copierTexteFallback(prompts);
        setCopiePromptsOk(true);
      } catch {
        setErreurCopiePrompts("Impossible de copier les prompts vidéo.");
      }
    }
  }

  const workflowSteps: WorkflowStep[] = [
    {
      id: 1,
      title: "Storyboard automatique",
      description: "Génération instantanée depuis le brief vidéo.",
      status: resultat ? "done" : chargement ? "current" : "waiting",
    },
    {
      id: 2,
      title: "Plans et prompts",
      description: "Prépare les plans et les textes utiles pour vos rushs.",
      status: packClips ? "done" : resultat ? "current" : "waiting",
    },
    {
      id: 3,
      title: "Montage simple",
      description:
        "Montage FFmpeg gratuit à partir des mp4 déposés dans media/plans.",
      status:
        montageResult || chargementMontage
          ? "done"
          : packClips || uploadResult || generationVideos
            ? "current"
            : "waiting",
    },
    {
      id: 4,
      title: "Export MP4",
      description:
        "Produit un clip final prêt dans media/export/clip_final.mp4.",
      status: montageResult ? "done" : packClips ? "current" : "waiting",
    },
  ];

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setProjectHistory(d.projects as SavedProject[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_FILTER_STORAGE_KEY);
      if (isHistoryFilter(stored)) {
        setHistoryFilter(stored);
      }
    } catch {
      // Ignorer les erreurs de stockage navigateur
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_FILTER_STORAGE_KEY, historyFilter);
    } catch {
      // Ignorer les erreurs de stockage navigateur
    }
  }, [historyFilter]);

  useEffect(() => {
    try {
      const storedProvider = window.localStorage.getItem(
        AI_PROVIDER_STORAGE_KEY,
      );
      if (isAiProvider(storedProvider)) {
        setAiProvider(storedProvider);
      }

      const storedModels = window.localStorage.getItem(AI_MODEL_STORAGE_KEY);
      setAiModelByProvider(
        sanitizeAiModelByProvider(
          storedModels ? JSON.parse(storedModels) : null,
        ),
      );
    } catch {
      // Ignorer les erreurs de stockage navigateur
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, aiProvider);
    } catch {
      // Ignorer les erreurs de stockage navigateur
    }
  }, [aiProvider]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        AI_MODEL_STORAGE_KEY,
        JSON.stringify(aiModelByProvider),
      );
    } catch {
      // Ignorer les erreurs de stockage navigateur
    }
  }, [aiModelByProvider]);

  async function sauvegarderProjet() {
    setSavingProject(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre,
          storyboard: resultat,
          storyboardStructure,
          audioAnalysis,
          clips: orderedClips,
          config: exportConfig,
          remapStrategy,
          manualOrderLocked,
          aiProvider,
          aiModelByProvider,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const histRes = await fetch("/api/projects");
        const histData = await histRes.json();
        if (histData.success)
          setProjectHistory(histData.projects as SavedProject[]);
      }
    } catch {
      // Silencieux
    } finally {
      setSavingProject(false);
    }
  }

  async function supprimerProjet(id: string) {
    await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setProjectHistory((prev) => prev.filter((p) => p.id !== id));
  }

  function chargerProjet(project: SavedProject) {
    setTitre(project.titre || "Projet sans titre");
    setResultat(project.storyboard || "");
    setStoryboardStructure(project.storyboardStructure || null);
    setAudioAnalysis(project.audioAnalysis || null);
    setAudioCurrentTime(0);
    setAudioIsPlaying(false);
    setOrderedClips(Array.isArray(project.clips) ? project.clips : []);
    setAiProvider(
      isAiProvider(project.aiProvider) ? project.aiProvider : "ollama",
    );
    setAiModelByProvider((current) => {
      const nextModels = { ...current };

      if (
        isAiProvider(project.aiProvider) &&
        typeof project.aiModel === "string"
      ) {
        nextModels[project.aiProvider] = project.aiModel;
      }

      if (project.aiModelByProvider) {
        return {
          ...nextModels,
          ...sanitizeAiModelByProvider(project.aiModelByProvider),
        };
      }

      return nextModels;
    });
    setExportConfig({
      ...DEFAULT_EXPORT_CONFIG,
      ...(project.config || {}),
    });
    setRemapStrategy(
      isRemapStrategy(project.remapStrategy)
        ? project.remapStrategy
        : "balanced",
    );
    setManualOrderLocked(Boolean(project.manualOrderLocked));
    setShowHistory(false);
    setErreur("");
    setErreurClips("");
    setErreurGeneration("");
    setErreurUpload("");
    setErreurAudio("");
    setErreurMontage("");
  }

  async function lancerMontage() {
    setChargementMontage(true);
    setErreurMontage("");

    try {
      // Construire la config avancée à partir de l'état UI
      const resolutionMap: Record<string, { w: number; h: number }> = {
        "1280x720": { w: 1280, h: 720 },
        "1920x1080": { w: 1920, h: 1080 },
        "1080x1920": { w: 1080, h: 1920 },
      };
      const res = resolutionMap[exportConfig.resolution] ?? { w: 1280, h: 720 };

      const parseDurSec = (d: string) => {
        const m = d.match(/(\d+)\s*minute/i);
        if (m) return parseInt(m[1], 10) * 60;
        const s = d.match(/(\d+)\s*seconde/i);
        if (s) return parseInt(s[1], 10);
        return 6;
      };

      const advancedConfig =
        orderedClips.length > 0
          ? {
              clips: orderedClips.map((c) => ({
                file: c.nom,
                duree:
                  c.endSec !== undefined && c.startSec !== undefined
                    ? Math.max(1, Math.round((c.endSec - c.startSec) * 10) / 10)
                    : parseDurSec(c.duree),
                subtitleText: c.subtitleText,
              })),
              transition: {
                type: exportConfig.transitionType,
                duree: exportConfig.transitionDuree,
              },
              audio: {
                musique: "media/audio/musique.mp3",
                musiqueVolume: exportConfig.musiqueVolume,
                voixVolume: exportConfig.voixVolume,
              },
              output: {
                fichier: "media/export/clip_final.mp4",
                resolution: `${res.w}x${res.h}`,
                fps: 24,
              },
            }
          : undefined;

      const response = await fetch("/api/montage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(advancedConfig ? { config: advancedConfig } : {}),
      });

      const data = await response.json();

      if (data.success && data.result) {
        setMontageResult(data.result);
      } else {
        setErreurMontage(data.error || "Erreur : impossible de monter le MP4.");
      }
    } catch {
      setErreurMontage("Erreur : impossible de monter le MP4.");
    } finally {
      setChargementMontage(false);
    }
  }

  async function analyserAudio() {
    if (!selectedAudioFile) {
      setErreurAudio("Sélectionnez d'abord un fichier audio.");
      return;
    }

    setChargementAudio(true);
    setErreurAudio("");

    try {
      const formData = new FormData();
      formData.append("audio", selectedAudioFile);

      const response = await fetch("/api/audio-analysis", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.result) {
        const analysis = data.result as AudioAnalysisResult;
        setAudioAnalysis(analysis);
        setAudioCurrentTime(0);
        setAudioIsPlaying(false);
        setOrderedClips((prev) =>
          mapClipsToAudioSections(prev, analysis.sections, remapStrategy),
        );
      } else {
        setErreurAudio(
          data.error || "Erreur : impossible d'analyser la musique.",
        );
      }
    } catch {
      setErreurAudio("Erreur : impossible d'analyser la musique.");
    } finally {
      setChargementAudio(false);
    }
  }

  function remapperClipsParEnergie() {
    if (!audioAnalysis || orderedClips.length === 0) {
      return;
    }

    setOrderedClips((prev) =>
      mapClipsToAudioSections([...prev], audioAnalysis.sections, remapStrategy),
    );
  }

  function changerRemapStrategy(strategy: RemapStrategy) {
    setRemapStrategy(strategy);

    if (!audioAnalysis || orderedClips.length === 0 || manualOrderLocked) {
      return;
    }

    setOrderedClips((prev) =>
      mapClipsToAudioSections([...prev], audioAnalysis.sections, strategy),
    );
  }

  async function uploaderPlans() {
    if (selectedFiles.length === 0) {
      setErreurUpload("Sélectionnez au moins un fichier vidéo.");
      return;
    }

    setChargementUpload(true);
    setErreurUpload("");

    try {
      const formData = new FormData();

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/upload-plans", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.result) {
        setUploadResult(data.result);
        setSelectedFiles([]);
      } else {
        setErreurUpload(
          data.error || "Erreur : impossible d'uploader les clips.",
        );
      }
    } catch {
      setErreurUpload("Erreur : impossible d'uploader les clips.");
    } finally {
      setChargementUpload(false);
    }
  }

  const activeAudioSection = audioAnalysis?.sections.find(
    (section) =>
      audioCurrentTime >= section.startSec && audioCurrentTime < section.endSec,
  );
  const activeSectionId = activeAudioSection
    ? toSectionId(activeAudioSection.label)
    : null;
  const currentAiModel =
    aiModelByProvider[aiProvider] || getDefaultAiModel(aiProvider);
  const currentAiModelOptions = getAiModelOptions(aiProvider);
  const filteredProjectHistory =
    historyFilter === "locked"
      ? projectHistory.filter((project) => project.manualOrderLocked)
      : projectHistory;
  const sortedProjectHistory = [...filteredProjectHistory].sort((a, b) => {
    const aTime = new Date(a.savedAt).getTime();
    const bTime = new Date(b.savedAt).getTime();
    const safeATime = Number.isFinite(aTime) ? aTime : 0;
    const safeBTime = Number.isFinite(bTime) ? bTime : 0;

    return historySort === "newest"
      ? safeBTime - safeATime
      : safeATime - safeBTime;
  });

  return (
    <main className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="overflow-hidden rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_.65fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Rudyo Video Studio local
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Montez une vidéo complète sans dépendre d’une IA.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Préparez un storyboard local, organisez vos plans, uploadez vos
                clips et assemblez un montage final dans une interface plus
                lisible et plus directe.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/offres"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-pink-500 transition-all"
                >
                  🎬 Voir nos offres &amp; tarifs
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    {metric.label}
                  </p>
                  <p
                    className={`mt-2 text-xl font-semibold ${
                      metric.tone === "emerald"
                        ? "text-emerald-300"
                        : metric.tone === "amber"
                          ? "text-amber-300"
                          : "text-sky-300"
                    }`}
                  >
                    {metric.value}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
              01
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Brief, storyboard local et préparation des plans en quelques
              secondes.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
              02
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Upload local ou cloud pour garder les clips disponibles au
              montage.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-sky-300">
              03
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Timeline, sous-titres et export final regroupés dans le même flux.
            </p>
          </article>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Analyse musique
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Importer un morceau et générer sa structure
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Cette étape prépare une base tempo + sections pour piloter la suite
            du workflow clip musical.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Fichier audio (mp3, wav, m4a)
              </label>
              <input
                type="file"
                accept="audio/*"
                title="Fichier audio"
                onChange={(event) =>
                  setSelectedAudioFile(event.target.files?.[0] ?? null)
                }
                className="block w-full rounded-2xl border border-white/10 bg-slate-950/60 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-400 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-slate-950"
              />
              {selectedAudioFile ? (
                <p className="mt-2 text-sm text-slate-300">
                  Fichier sélectionné : {selectedAudioFile.name}
                </p>
              ) : null}
            </div>

            <button
              onClick={analyserAudio}
              disabled={chargementAudio}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:border-emerald-400/30 hover:bg-emerald-400/10 disabled:opacity-50"
            >
              {chargementAudio ? "Analyse en cours..." : "Analyser la musique"}
            </button>
          </div>

          {erreurAudio ? (
            <p className="mt-4 text-sm text-rose-300">{erreurAudio}</p>
          ) : null}

          {audioAnalysis ? (
            <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <p>
                  <span className="font-semibold text-white">Fichier :</span>{" "}
                  {audioAnalysis.fileName}
                </p>
                <p>
                  <span className="font-semibold text-white">Durée :</span>{" "}
                  {audioAnalysis.durationSec.toFixed(2)} s
                </p>
                <p>
                  <span className="font-semibold text-white">BPM estimé :</span>{" "}
                  {audioAnalysis.bpm}
                </p>
                <p>
                  <span className="font-semibold text-white">Provider :</span>{" "}
                  {audioAnalysis.provider}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-300">
                  <p>
                    Lecture: {formatClockTime(audioCurrentTime)} /{" "}
                    {formatClockTime(audioAnalysis.durationSec)}
                  </p>
                  <p>
                    État: {audioIsPlaying ? "en lecture" : "en pause"}
                    {activeAudioSection
                      ? ` · section ${activeAudioSection.label}`
                      : ""}
                  </p>
                </div>
                <audio
                  controls
                  src={audioAnalysis.audioRef}
                  className="w-full"
                  onPlay={() => setAudioIsPlaying(true)}
                  onPause={() => setAudioIsPlaying(false)}
                  onEnded={() => setAudioIsPlaying(false)}
                  onTimeUpdate={(event) =>
                    setAudioCurrentTime(event.currentTarget.currentTime)
                  }
                />
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-white">Sections détectées</p>
                {audioAnalysis.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`rounded-xl border px-3 py-2 ${
                      activeAudioSection?.id === section.id
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : "border-white/10 bg-slate-900"
                    }`}
                  >
                    <p className="font-medium text-slate-100">
                      {section.label}
                    </p>
                    <p className="text-xs text-slate-400">
                      {section.startSec.toFixed(2)}s →{" "}
                      {section.endSec.toFixed(2)}s · énergie {section.energy}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400">
                Analyse sauvegardée : {audioAnalysis.analysisRef}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-5 rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Titre
            </label>
            <input
              title="Titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Type de vidéo
            </label>
            <select
              title="Type de vidéo"
              value={typeVideo}
              onChange={(e) => setTypeVideo(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            >
              <option>Clip musical</option>
              <option>Vidéo de formation</option>
              <option>Flyer animé</option>
              <option>Vidéo promotionnelle</option>
              <option>Vidéo Moodle</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Durée
            </label>
            <input
              title="Durée"
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Format
            </label>
            <select
              title="Format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            >
              <option>16:9 YouTube</option>
              <option>9:16 TikTok / Reels / Shorts</option>
              <option>1:1 WhatsApp / Instagram</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Style
            </label>
            <input
              title="Style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Nombre de plans
            </label>
            <input
              title="Nombre de plans"
              value={nombrePlans}
              onChange={(e) => setNombrePlans(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-200">
                  Provider IA
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  Ollama reste local. OpenAI et Blackbox AI utilisent leur API
                  compatible OpenAI.
                </p>
              </div>
              <span className="inline-flex rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                {getAiProviderLabel(aiProvider)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {AI_PROVIDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAiProvider(option.value)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    aiProvider === option.value
                      ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Modèle pour {getAiProviderLabel(aiProvider)}
              </label>
              <select
                title="Modèle IA"
                value={currentAiModel}
                onChange={(event) =>
                  setAiModelByProvider((current) => ({
                    ...current,
                    [aiProvider]: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
              >
                {!currentAiModelOptions.some(
                  (option) => option.value === currentAiModel,
                ) ? (
                  <option value={currentAiModel}>
                    {currentAiModel} - Modèle actuel
                  </option>
                ) : null}
                {currentAiModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Description de la vidéo
            </label>
            <textarea
              title="Description de la vidéo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          <div className="md:col-span-2">
            <button
              onClick={genererStoryboard}
              disabled={chargement}
              className="rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-300 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {chargement ? "Génération en cours..." : "Générer le storyboard"}
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowSteps.map((step) => (
            <article
              key={step.id}
              className={`rounded-2xl border p-4 ${
                step.status === "done"
                  ? "border-emerald-500 bg-emerald-950/30"
                  : step.status === "current"
                    ? "border-amber-400 bg-amber-950/20"
                    : "border-slate-800 bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                  {step.id}. {step.title}
                </p>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    step.status === "done"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : step.status === "current"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {step.status === "done"
                    ? "Terminé"
                    : step.status === "current"
                      ? "En cours"
                      : "En attente"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{step.description}</p>
            </article>
          ))}
        </section>

        {erreur ? (
          <section className="mt-8 rounded-2xl border border-rose-900 bg-slate-900 p-6">
            <p className="text-rose-300">{erreur}</p>
          </section>
        ) : null}

        {resultat && (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Meilleure option générée
              </p>
              <h2 className="mt-2 text-2xl font-bold">Storyboard du clip</h2>
              <p className="mt-2 text-slate-300">
                Version locale prête à être relue, copiée ou retravaillée.
              </p>
              {modeStoryboard ? (
                <p className="mt-3 inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {modeStoryboard === "mock"
                    ? "Mode test local"
                    : modeStoryboard === "fallback"
                      ? "Fallback local"
                      : modeStoryboard === "openai"
                        ? "Mode OpenAI"
                        : modeStoryboard === "blackbox"
                          ? "Mode Blackbox AI"
                          : "Mode Ollama"}
                </p>
              ) : null}
            </div>

            {storyboardStructure ? (
              <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Titre
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {storyboardStructure.titre}
                  </p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Type
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {storyboardStructure.type_video}
                  </p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Format
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {storyboardStructure.format}
                  </p>
                </article>
                <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Durée totale
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {storyboardStructure.duree_totale}
                  </p>
                </article>
              </div>
            ) : null}

            {storyboardStructure ? (
              <article className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                  Résumé
                </p>
                <p className="mt-3 text-slate-200">
                  {storyboardStructure.resume}
                </p>
              </article>
            ) : null}

            {!storyboardStructure || afficherTexteBrut ? (
              <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-200">
                  {resultat}
                </pre>
              </article>
            ) : null}

            {storyboardStructure ? (
              <div className="mt-6 space-y-4">
                {storyboardStructure.storyboard.map((plan) => (
                  <article
                    key={plan.plan}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                          Plan {plan.plan}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">
                          {plan.duree}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-300">
                        {plan.transition}
                      </p>
                    </div>

                    <p className="mt-3 text-slate-200">{plan.description}</p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <p className="text-sm text-slate-300">
                        <span className="font-semibold text-white">
                          Caméra :
                        </span>{" "}
                        {plan.camera}
                      </p>
                      <p className="text-sm text-slate-300">
                        <span className="font-semibold text-white">
                          Texte écran :
                        </span>{" "}
                        {plan.texte_ecran}
                      </p>
                      <p className="md:col-span-2 text-sm text-slate-300">
                        <span className="font-semibold text-white">
                          Prompt vidéo IA :
                        </span>{" "}
                        {plan.prompt_video_ia}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {storyboardStructure ? (
              <button
                onClick={() => setAfficherTexteBrut((value) => !value)}
                className="mt-6 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                {afficherTexteBrut
                  ? "Masquer le texte brut"
                  : "Afficher le texte brut"}
              </button>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={preparerClips}
                disabled={chargementClips}
                className="rounded-xl border border-emerald-400 px-5 py-3 font-semibold text-emerald-300 disabled:opacity-50"
              >
                {chargementClips
                  ? "Préparation des clips..."
                  : "Préparer les clips vidéo"}
              </button>
            </div>

            {erreurClips ? (
              <p className="mt-4 text-rose-300">{erreurClips}</p>
            ) : null}
          </section>
        )}

        {packClips ? (
          <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Pack de clips
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Prompts prêts pour générer les vidéos
              </h2>
              <p className="mt-2 text-slate-300">
                Storyboard et prompts enrichis avec le provider sélectionné.
                Chaque clip inclut aussi une image de test Pollinations avant un
                futur branchement premium.
              </p>
              {packClips.provider ? (
                <p className="mt-3 inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {packClips.provider}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={copierPromptsVideo}
                  className="rounded-xl border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-300"
                >
                  Copier les prompts vidéo
                </button>
                {copiePromptsOk ? (
                  <p className="text-sm text-emerald-300">
                    Prompts copiés dans le presse-papiers.
                  </p>
                ) : null}
                {erreurCopiePrompts ? (
                  <p className="text-sm text-rose-300">{erreurCopiePrompts}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Export JSON
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {packClips.exports.json}
                </p>
              </article>
              <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Export texte
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {packClips.exports.texte}
                </p>
              </article>
              <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Dossier des plans
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {packClips.montage.dossierPlans}
                </p>
              </article>
              <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Commande de montage
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {packClips.montage.commande}
                </p>
              </article>
            </div>

            <div className="mt-6 space-y-4">
              {packClips.clips.map((clip) => (
                <article
                  key={clip.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                        Clip {clip.id}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">{clip.nom}</h3>
                    </div>
                    <p className="text-sm text-slate-300">{clip.duree}</p>
                  </div>

                  <p className="mt-3 text-slate-200">{clip.description}</p>

                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <p>
                      <span className="font-semibold text-white">
                        Prompt image :
                      </span>{" "}
                      {clip.promptImage}
                    </p>
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                      <img
                        src={clip.imageTestUrl}
                        alt={`Aperçu test ${clip.nom}`}
                        className="h-auto w-full"
                      />
                    </div>
                    <p>
                      <span className="font-semibold text-white">
                        Aperçu test Pollinations :
                      </span>{" "}
                      <a
                        href={clip.imageTestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-300 underline underline-offset-4"
                      >
                        ouvrir l'image
                      </a>
                    </p>
                    <p>
                      <span className="font-semibold text-white">
                        Prompt vidéo :
                      </span>{" "}
                      {clip.promptVideo}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
                  Création des rushs
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Préparez vos clips hors ligne ou avec vos outils habituels
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Cette application ne dépend pas d'un générateur vidéo.
                  Utilisez les prompts comme aide de tournage ou de création,
                  puis passez directement à l'upload de vos mp4 pour le montage
                  final.
                </p>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                  <p>
                    1. Générez ou tournez vos plans avec l'outil de votre choix.
                  </p>
                  <p>2. Exportez chaque plan en mp4.</p>
                  <p>3. Uploadez ensuite les fichiers dans media/plans.</p>
                </div>

                {generationVideos ? (
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <p>
                      <span className="font-semibold text-white">
                        Provider :
                      </span>{" "}
                      {generationVideos.provider}
                    </p>
                    <p>
                      <span className="font-semibold text-white">Modèle :</span>{" "}
                      {generationVideos.model}
                    </p>
                    <p>
                      <span className="font-semibold text-white">
                        Manifest :
                      </span>{" "}
                      {generationVideos.manifest}
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
                  Upload direct
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Envoyer vos mp4 dans media/plans
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Déposez ici vos clips finaux pour les rendre disponibles
                  immédiatement au script de montage.
                </p>
                <label className="mt-4 block text-sm font-medium text-slate-200">
                  Sélection des clips vidéo
                </label>
                <input
                  type="file"
                  multiple
                  accept="video/mp4,video/quicktime,video/webm"
                  title="Sélection des clips vidéo"
                  onChange={(event) =>
                    setSelectedFiles(Array.from(event.target.files ?? []))
                  }
                  className="mt-2 block w-full rounded-2xl border border-white/10 bg-slate-950/60 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-400 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-slate-950"
                />

                {selectedFiles.length > 0 ? (
                  <p className="mt-3 text-sm text-slate-300">
                    {selectedFiles.length} fichier(s) sélectionné(s)
                  </p>
                ) : null}

                <button
                  onClick={uploaderPlans}
                  disabled={chargementUpload}
                  className="mt-4 rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:border-emerald-400/30 hover:bg-emerald-400/10 disabled:opacity-50"
                >
                  {chargementUpload
                    ? "Upload en cours..."
                    : "Uploader les clips"}
                </button>

                {erreurUpload ? (
                  <p className="mt-4 text-sm text-rose-300">{erreurUpload}</p>
                ) : null}

                {uploadResult ? (
                  <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                    <p>
                      <span className="font-semibold text-slate-100">
                        Fichiers envoyés :
                      </span>{" "}
                      {uploadResult.count}
                    </p>
                    {uploadResult.files.map((file) => (
                      <p key={file}>{file}</p>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Timeline des plans
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Organiser l'ordre du montage
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Glissez-déposez les plans pour personnaliser l'ordre. Éditez les
                sous-titres directement.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-xs text-slate-300">
                  Stratégie
                  <select
                    title="Stratégie de remapping"
                    value={remapStrategy}
                    onChange={(event) =>
                      changerRemapStrategy(event.target.value as RemapStrategy)
                    }
                    className="ml-2 rounded-full border border-white/10 bg-slate-900 px-3 py-1 text-xs text-slate-100"
                  >
                    <option value="conservative">Conservateur</option>
                    <option value="balanced">Équilibré</option>
                    <option value="aggressive">Agressif</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setManualOrderLocked((v) => !v)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    manualOrderLocked
                      ? "border-amber-400/60 bg-amber-400/15 text-amber-200"
                      : "border-white/10 bg-white/5 text-white hover:border-emerald-400/30 hover:bg-emerald-400/10"
                  }`}
                >
                  {manualOrderLocked
                    ? "Ordre manuel verrouillé"
                    : "Verrouiller l'ordre manuel"}
                </button>
                <button
                  type="button"
                  onClick={remapperClipsParEnergie}
                  disabled={!audioAnalysis || orderedClips.length === 0}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-400/30 hover:bg-emerald-400/10 disabled:opacity-50"
                >
                  Re-mapper selon l'énergie
                </button>
                {!audioAnalysis ? (
                  <p className="text-xs text-slate-400">
                    Analysez d'abord un morceau pour activer le mapping
                    intelligent.
                  </p>
                ) : manualOrderLocked ? (
                  <p className="text-xs text-amber-300">
                    Auto-remap désactivé: la stratégie change sans réordonner la
                    timeline.
                  </p>
                ) : null}
              </div>
              <div className="mt-4">
                <TimelinePlans
                  clips={orderedClips}
                  onChange={setOrderedClips}
                  activeSectionId={activeSectionId}
                />
              </div>
            </section>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <ExportConfig config={exportConfig} onChange={setExportConfig} />
            </div>

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Montage avancé et export MP4
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Assembler les clips en une vidéo finale
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Utilise les mp4 présents dans media/plans et la piste audio
                media/audio/musique.mp3 pour exporter le clip final.
              </p>
              <button
                onClick={lancerMontage}
                disabled={chargementMontage}
                className="mt-4 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {chargementMontage
                  ? "Montage en cours..."
                  : "Monter et exporter le MP4"}
              </button>

              {erreurMontage ? (
                <p className="mt-4 text-sm text-rose-300">{erreurMontage}</p>
              ) : null}

              {montageResult ? (
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <p>
                    <span className="font-semibold text-white">Mode :</span>{" "}
                    {montageResult.mode === "advanced"
                      ? "Avancé (FFmpeg)"
                      : "Simple"}
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      Fichier exporté :
                    </span>{" "}
                    {montageResult.sortie}
                  </p>
                  <p>
                    <span className="font-semibold text-white">Taille :</span>{" "}
                    {(montageResult.tailleOctets / (1024 * 1024)).toFixed(2)} Mo
                  </p>
                  <p>
                    <span className="font-semibold text-white">
                      Plans utilisés :
                    </span>{" "}
                    {montageResult.plansUtilises.length}
                  </p>
                  {montageResult.thumbnailUrl ? (
                    <div>
                      <p className="mb-1 font-semibold text-white">
                        Miniature :
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={montageResult.thumbnailUrl}
                        alt="Miniature du montage"
                        className="h-auto w-48 rounded-xl border border-slate-700"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="/api/export-video"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-emerald-400 px-4 py-2 font-semibold text-emerald-300"
                    >
                      Prévisualiser le MP4
                    </a>
                    <a
                      href="/api/export-video?download=1"
                      className="rounded-xl border border-slate-600 px-4 py-2 font-semibold text-white"
                    >
                      Télécharger le MP4
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(
                            window.location.origin + "/api/export-video",
                          )
                          .catch(() => {})
                      }
                      className="rounded-xl border border-slate-600 px-4 py-2 font-semibold text-white"
                    >
                      Copier le lien
                    </button>
                  </div>
                  <video
                    controls
                    className="w-full rounded-xl border border-slate-800 bg-black"
                    src="/api/export-video"
                  />
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs leading-6 text-slate-300">
                    {montageResult.logs}
                  </pre>
                </div>
              ) : null}
            </section>

            {generationVideos ? (
              <div className="mt-6 space-y-4">
                {generationVideos.jobs.map((job) => (
                  <article
                    key={`${job.clipId}-${job.predictionId ?? job.clipName}`}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20 backdrop-blur-xl"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                          Job {job.clipId}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-white">
                          {job.clipName}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-300">{job.status}</p>
                    </div>

                    <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                      {job.savedTo ? (
                        <p>
                          <span className="font-semibold text-white">
                            Sauvé dans :
                          </span>{" "}
                          {job.savedTo}
                        </p>
                      ) : null}
                      {job.outputUrl ? (
                        <p>
                          <span className="font-semibold text-white">
                            Sortie :
                          </span>{" "}
                          {job.outputUrl}
                        </p>
                      ) : null}
                      {job.webUrl ? (
                        <p>
                          <span className="font-semibold text-white">
                            Suivi web :
                          </span>{" "}
                          {job.webUrl}
                        </p>
                      ) : null}
                      {job.getUrl ? (
                        <p>
                          <span className="font-semibold text-white">
                            API status :
                          </span>{" "}
                          {job.getUrl}
                        </p>
                      ) : null}
                      {job.error ? (
                        <p className="text-rose-300">{job.error}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                    Historique des projets
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    Sauvegarder et recharger vos sessions
                  </h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={sauvegarderProjet}
                    disabled={savingProject || !titre}
                    className="rounded-xl border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-300 disabled:opacity-50"
                  >
                    {savingProject ? "Sauvegarde..." : "Sauvegarder le projet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {showHistory ? "Masquer l'historique" : "Voir l'historique"}
                  </button>
                </div>
              </div>

              {showHistory ? (
                <div className="mt-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setHistoryFilter("all")}
                      className={`rounded-full border px-3 py-1 ${
                        historyFilter === "all"
                          ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200"
                          : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      Tous ({projectHistory.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryFilter("locked")}
                      className={`rounded-full border px-3 py-1 ${
                        historyFilter === "locked"
                          ? "border-amber-400/60 bg-amber-400/15 text-amber-200"
                          : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      Verrou manuel (
                      {
                        projectHistory.filter(
                          (project) => project.manualOrderLocked,
                        ).length
                      }
                      )
                    </button>
                    <span
                      className="mx-1 h-4 w-px bg-white/10"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => setHistorySort("newest")}
                      className={`rounded-full border px-3 py-1 ${
                        historySort === "newest"
                          ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
                          : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      Plus récent
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistorySort("oldest")}
                      className={`rounded-full border px-3 py-1 ${
                        historySort === "oldest"
                          ? "border-sky-400/60 bg-sky-400/15 text-sky-200"
                          : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      Plus ancien
                    </button>
                  </div>

                  {sortedProjectHistory.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      {historyFilter === "locked"
                        ? "Aucun projet avec verrou manuel actif."
                        : "Aucun projet sauvegardé."}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {sortedProjectHistory.map((project) => (
                        <li
                          key={project.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {project.titre}
                            </p>
                            {project.manualOrderLocked ? (
                              <p className="mt-1 inline-flex rounded-full border border-amber-400/55 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                                Verrou manuel actif
                              </p>
                            ) : null}
                            {project.aiProvider ? (
                              <p className="mt-1 inline-flex rounded-full border border-sky-400/55 bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                                {getAiProviderLabel(project.aiProvider)}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-xs text-slate-400">
                              {new Date(project.savedAt).toLocaleString(
                                "fr-FR",
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => chargerProjet(project)}
                            className="rounded-xl border border-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-300"
                          >
                            Charger
                          </button>
                          <button
                            type="button"
                            onClick={() => supprimerProjet(project.id)}
                            className="rounded-xl border border-rose-500 px-3 py-1.5 text-sm font-semibold text-rose-300"
                          >
                            Supprimer
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}
