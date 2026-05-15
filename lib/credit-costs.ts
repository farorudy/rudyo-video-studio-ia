export const CREDIT_COSTS = {
  storyboard: 2,
  script: 2,
  prompts: 3,
  subtitles: 3,
  audio_analysis: 5,
  clip_lyrics: 20,
  quick_clip: 20,
  training_video: 5,
  animated_flyer: 5,
  promo_video: 5,
} as const;

export type CreditTool = keyof typeof CREDIT_COSTS;

export const CREDIT_TOOL_LABELS: Record<CreditTool, string> = {
  storyboard: "Storyboard vidéo",
  script: "Script voix off",
  prompts: "Prompts vidéo IA",
  subtitles: "Sous-titres / paroles",
  audio_analysis: "Analyse audio",
  clip_lyrics: "Clip lyrics",
  quick_clip: "Clip rapide",
  training_video: "Vidéo formation",
  animated_flyer: "Flyer animé",
  promo_video: "Vidéo promotionnelle",
};

export const CREDIT_TOOL_DESCRIPTIONS: Record<CreditTool, string> = {
  storyboard:
    "Créer un storyboard structuré avec scènes, textes écran, caméra et transitions.",
  script:
    "Rédiger un script ou une voix off professionnelle pour votre vidéo.",
  prompts:
    "Générer des prompts prêts pour Runway, Sora, Pika, Veo, Kling ou Luma.",
  subtitles:
    "Préparer des sous-titres ou paroles structurées pour un clip ou une formation.",
  audio_analysis:
    "Analyser une musique ou une idée audio pour préparer un clip vidéo.",
  clip_lyrics:
    "Préparer un projet complet de clip paroles avec structure, storyboard et prompts.",
  quick_clip:
    "Créer rapidement une structure de clip à partir d’une musique ou d’une idée.",
  training_video:
    "Transformer un cours ou une formation en plan vidéo pédagogique.",
  animated_flyer:
    "Transformer une affiche en vidéo courte pour WhatsApp, Instagram ou TikTok.",
  promo_video:
    "Préparer une vidéo pour vendre une formation, un service ou un événement.",
};

export const CREDIT_TOOLS: CreditTool[] = [
  "quick_clip",
  "clip_lyrics",
  "storyboard",
  "script",
  "prompts",
  "subtitles",
  "audio_analysis",
  "training_video",
  "animated_flyer",
  "promo_video",
];
