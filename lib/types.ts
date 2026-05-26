export type VideoType =
  | "clip_musical"
  | "clip_lyrics"
  | "flyer_anime"
  | "video_promotionnelle";

export type StoryboardPlan = {
  plan: number;
  titre_etape?: string;
  duree: string;
  description: string;
  camera: string;
  texte_ecran: string;
  dialogue?: string;
  objectif_pedagogique?: string;
  rythme_musical?: string;
  direction_artistique?: string;
  prompt_video_ia: string;
  negative_prompt?: string;
  transition: string;
  type_media: "video_ia" | "image" | "tournage_reel" | "texte_anime";
  statut: "a_creer" | "prompt_pret" | "media_ajoute" | "valide";
};

export type StoryboardScene = StoryboardPlan;

export type StoryboardResult = {
  titre: string;
  type_video: string;
  format: string;
  style: string;
  duree_totale: string;
  resume: string;
  storyboard: StoryboardPlan[];
};

export type StoryboardRequest = {
  titre: string;
  typeVideo: string;
  duree: string;
  format: string;
  style: string;
  langue: string;
  publicCible: string;
  nombrePlans: string;
  description: string;
};

export type StoryboardErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "AI_CONFIG_MISSING"
  | "CREDITS_INSUFFICIENTS"
  | "AI_EMPTY_RESPONSE"
  | "AI_INVALID_JSON"
  | "SERVER_ERROR";

export type StoryboardApiSuccess = {
  success: true;
  mode: "mock" | "openai";
  result: StoryboardResult;
  creditsUsed?: number;
};

export type StoryboardApiError = {
  success: false;
  code: StoryboardErrorCode;
  error: string;
  details?: string;
};

export type StoryboardApiResponse = StoryboardApiSuccess | StoryboardApiError;

export type RudyoUser = {
  id: string;
  email: string;
  name: string | null;
  credits: {
    balance: number;
    total?: number;
    used?: number;
  };
};
