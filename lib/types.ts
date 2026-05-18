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

export type StoryboardResult = {
  titre: string;
  type_video: string;
  format: string;
  style: string;
  duree_totale: string;
  resume: string;
  storyboard: StoryboardPlan[];
};

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
