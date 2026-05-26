import {
  MODEL_CREDIT_RATES,
  MODEL_CREDIT_CATEGORY_LABELS,
  type ModelCreditCategory,
  type ModelCreditRate,
} from "@/lib/model-credit-rates";

export type BetaUserTest = {
  id: string;
  category: ModelCreditCategory;
  usage: string;
  testerProfile: string;
  goal: string;
  brief: string;
  steps: string[];
  expectedOutcome: string;
  successCriteria: string[];
  feedbackQuestions: string[];
  models: ModelCreditRate[];
};

function findRate(model: string, resolution?: string) {
  const match = MODEL_CREDIT_RATES.find(
    (rate) =>
      rate.model === model &&
      (!resolution || rate.resolution === resolution),
  );

  if (!match) {
    throw new Error(`Missing beta test model rate: ${model}`);
  }

  return match;
}

export const BETA_USER_TESTS: BetaUserTest[] = [
  {
    id: "text-to-image-cover",
    category: "Text to Image",
    usage: "Créer une image promotionnelle",
    testerProfile: "Artiste, association ou entrepreneur qui veut une affiche.",
    goal: "Vérifier que le testeur comprend le choix du modèle et le coût par image.",
    brief:
      "Générer une image carrée pour annoncer un nouveau single, un atelier ou un service local.",
    steps: [
      "Lire la grille crédits et choisir un modèle économique puis un modèle premium.",
      "Préparer un prompt simple avec sujet, ambiance, couleur et format.",
      "Générer une première image en 720P ou Any.",
      "Comparer le résultat avec une variante plus chère.",
      "Noter si le coût en crédits semble clair avant de lancer.",
    ],
    expectedOutcome:
      "Le testeur obtient une image exploitable et sait expliquer pourquoi un modèle coûte plus cher qu'un autre.",
    successCriteria: [
      "Le testeur identifie le coût avant génération.",
      "Le testeur comprend que le crédit est facturé par image.",
      "L'image produite peut être utilisée comme brouillon visuel.",
    ],
    feedbackQuestions: [
      "Le prix en crédits était-il clair avant de cliquer ?",
      "Quel modèle choisiriez-vous pour un usage réel ?",
      "Le résultat est-il assez bon pour continuer le projet ?",
    ],
    models: [
      findRate("Grok Imagine Image"),
      findRate("Flux.2"),
      findRate("Midjourney V7"),
      findRate("GPT Image 2.0"),
    ],
  },
  {
    id: "image-to-video-clip",
    category: "Image to Video",
    usage: "Transformer une image en clip court",
    testerProfile: "Créateur qui veut animer une image ou une pochette.",
    goal:
      "Vérifier que le testeur comprend la facturation par seconde et la durée minimale.",
    brief:
      "Animer une image de départ pour produire une vidéo courte de 4 à 8 secondes.",
    steps: [
      "Choisir une image source nette.",
      "Sélectionner un modèle 720P rapide et noter son minimum de durée.",
      "Calculer le coût attendu avant génération.",
      "Tester une version courte puis comparer avec un modèle premium.",
      "Vérifier si le débit de crédits correspond à la durée choisie.",
    ],
    expectedOutcome:
      "Le testeur comprend que le coût final dépend du modèle, de la résolution et du nombre de secondes.",
    successCriteria: [
      "Le testeur sait calculer le coût minimum.",
      "La difference 720P / 1080P est comprise.",
      "Le résultat vidéo est jugé cohérent avec l'image source.",
    ],
    feedbackQuestions: [
      "La durée minimale était-elle visible au bon moment ?",
      "Avez-vous été surpris par le coût total ?",
      "Quel compromis préférez-vous : vitesse, qualité ou prix ?",
    ],
    models: [
      findRate("Magi-1.1"),
      findRate("Seedance 1.0 Pro Fast", "720P"),
      findRate("Pixverse V6", "1080P"),
      findRate("Veo 3 Fast"),
    ],
  },
  {
    id: "avatar-presenter",
    category: "Avatar",
    usage: "Créer une vidéo avatar",
    testerProfile: "Formateur, coach ou artiste qui veut parler face caméra.",
    goal:
      "Tester la compréhension du coût par seconde pour une prise de parole avatar.",
    brief:
      "Créer une introduction de 10 secondes pour présenter une formation ou un titre musical.",
    steps: [
      "Choisir un texte court de présentation.",
      "Comparer Gaga Avatar V2 avec un modèle avatar premium.",
      "Calculer le coût pour 10 secondes.",
      "Évaluer la synchronisation voix / visage.",
      "Noter si le rendu inspire confiance pour une publication.",
    ],
    expectedOutcome:
      "Le testeur identifie le modèle avatar adapté à son budget et à son niveau de qualité attendu.",
    successCriteria: [
      "Le coût par seconde est compris.",
      "Le testeur sait choisir un modèle selon son usage.",
      "Le résultat est jugé publiable ou améliorable avec des consignes claires.",
    ],
    feedbackQuestions: [
      "Le coût pour 10 secondes vous paraît-il acceptable ?",
      "Le rendu avatar est-il assez naturel ?",
      "Que faudrait-il ajouter avant un usage commercial ?",
    ],
    models: [
      findRate("Gaga Avatar V2"),
      findRate("Kling AI Avatar v2 Pro"),
      findRate("Omnihuman V1.5"),
    ],
  },
  {
    id: "audio-song-voice",
    category: "Audio",
    usage: "Générer musique ou voix",
    testerProfile: "Artiste, podcasteur ou créateur de contenu court.",
    goal:
      "Vérifier que le testeur distingue une requête musique et une facturation audio par seconde.",
    brief:
      "Créer soit un jingle musical, soit une voix off de 20 secondes.",
    steps: [
      "Choisir entre musique complète et voix off.",
      "Comparer Suno Music V5 avec un service text-to-speech.",
      "Calculer le coût d'une voix off de 20 secondes.",
      "Écouter le résultat et noter la clarté.",
      "Vérifier si le testeur comprend l'unité de facturation.",
    ],
    expectedOutcome:
      "Le testeur sait quand choisir une génération musicale par requête ou une voix facturée à la seconde.",
    successCriteria: [
      "Le testeur comprend la différence entre requête et seconde.",
      "Le coût d'un audio court est anticipé correctement.",
      "La sortie audio correspond au brief.",
    ],
    feedbackQuestions: [
      "L'unité de facturation était-elle évidente ?",
      "La voix ou la musique correspond-elle à votre besoin ?",
      "Quelle durée testeriez-vous ensuite ?",
    ],
    models: [
      findRate("Suno Music V5"),
      findRate("ElevenLabs Text-to-speech"),
      findRate("MiniMax Text-to-speech"),
      findRate("ElevenLabs Music"),
    ],
  },
  {
    id: "video-analysis-shot",
    category: "Video Analysis",
    usage: "Analyser une vidéo par plan",
    testerProfile: "Monteur ou créateur qui veut comprendre une vidéo existante.",
    goal:
      "Tester si le coût par plan est clair pour analyser une vidéo avant montage.",
    brief:
      "Importer ou décrire une vidéo courte et demander une analyse des plans importants.",
    steps: [
      "Choisir une vidéo de référence de moins d'une minute.",
      "Identifier le nombre de plans ou shots à analyser.",
      "Calculer le coût total avant analyse.",
      "Lire les recommandations de montage.",
      "Noter si l'analyse aide à améliorer le projet.",
    ],
    expectedOutcome:
      "Le testeur comprend que l'analyse vidéo se facture par plan et non par seconde.",
    successCriteria: [
      "Le testeur comprend l'unité par plan.",
      "Le nombre de plans est expliqué simplement.",
      "L'analyse donne au moins une action utile pour le montage.",
    ],
    feedbackQuestions: [
      "Le mot plan ou shot est-il clair ?",
      "L'analyse vous aide-t-elle à prendre une décision ?",
      "Préférez-vous un prix par vidéo ou par plan ?",
    ],
    models: [findRate("VidMuse feature", "Any")],
  },
  {
    id: "audio-analysis-duration",
    category: "Audio Analysis",
    usage: "Analyser une piste audio",
    testerProfile: "Artiste ou réalisateur qui prépare un clip musical.",
    goal:
      "Vérifier que le testeur comprend le coût d'analyse audio par seconde.",
    brief:
      "Analyser un extrait audio de 30 secondes pour préparer un clip, des paroles ou un storyboard.",
    steps: [
      "Choisir un extrait audio court.",
      "Saisir ou confirmer la durée de l'extrait.",
      "Calculer le coût total de l'analyse.",
      "Lire les recommandations de rythme, ambiance et moments forts.",
      "Noter si le résultat aide à créer une vidéo.",
    ],
    expectedOutcome:
      "Le testeur comprend la relation entre durée audio, crédits et recommandations créatives.",
    successCriteria: [
      "Le coût par seconde est anticipé correctement.",
      "L'analyse identifie des moments utiles.",
      "Le testeur sait quoi faire après l'analyse.",
    ],
    feedbackQuestions: [
      "Le coût pour 30 secondes était-il acceptable ?",
      "L'analyse vous donne-t-elle des idées visuelles ?",
      "Quelle durée audio testeriez-vous en production ?",
    ],
    models: [findRate("VidMuse feature", "-")],
  },
];

export function getBetaTestLabel(test: BetaUserTest) {
  return MODEL_CREDIT_CATEGORY_LABELS[test.category];
}
