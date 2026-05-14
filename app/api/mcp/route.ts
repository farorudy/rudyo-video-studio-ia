const outputSchema = {
  type: "object",
  properties: {
    content: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          text: { type: "string" },
        },
        required: ["type", "text"],
      },
    },
  },
  required: ["content"],
};

const safeReadOnlyAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
};

const tools = [
  {
    name: "generate_storyboard",
    description:
      "Créer un storyboard vidéo structuré à partir d'une idée, d'une chanson, d'une affiche, d'une formation ou d'un événement.",
    inputSchema: {
      type: "object",
      properties: {
        idea: {
          type: "string",
          description: "Idée principale de la vidéo",
        },
        duration: {
          type: "string",
          description: "Durée cible : 30s, 1min, 3min",
        },
        style: {
          type: "string",
          description:
            "Style de vidéo : clip musical, flyer animé, promo, formation, documentaire",
        },
        audience: {
          type: "string",
          description: "Public cible",
        },
      },
      required: ["idea"],
    },
    outputSchema,
    annotations: safeReadOnlyAnnotations,
  },
  {
    name: "generate_script",
    description: "Créer un script vidéo ou un texte de voix off.",
    inputSchema: {
      type: "object",
      properties: {
        objective: {
          type: "string",
          description: "Objectif de la vidéo",
        },
        tone: {
          type: "string",
          description:
            "Ton souhaité : professionnel, émotionnel, dynamique, pédagogique",
        },
        duration: {
          type: "string",
          description: "Durée cible : 30s, 1min, 3min",
        },
      },
      required: ["objective"],
    },
    outputSchema,
    annotations: safeReadOnlyAnnotations,
  },
  {
    name: "analyze_video_idea",
    description: "Analyser et améliorer une idée vidéo.",
    inputSchema: {
      type: "object",
      properties: {
        idea: {
          type: "string",
          description: "Idée vidéo à analyser",
        },
        goal: {
          type: "string",
          description:
            "Objectif de la vidéo : informer, vendre, former, inspirer, annoncer",
        },
        constraints: {
          type: "string",
          description:
            "Contraintes du projet : budget, lieu, durée, matériel, équipe, délai",
        },
      },
      required: ["idea"],
    },
    outputSchema,
    annotations: safeReadOnlyAnnotations,
  },
  {
    name: "organize_video_project",
    description: "Organiser un projet vidéo en étapes de production.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Titre du projet vidéo",
        },
        brief: {
          type: "string",
          description: "Brief ou description complète du projet vidéo",
        },
        deadline: {
          type: "string",
          description: "Échéance ou date limite du projet",
        },
        resources: {
          type: "string",
          description:
            "Ressources disponibles : personnes, matériels, lieux, fichiers, budget",
        },
      },
      required: ["brief"],
    },
    outputSchema,
    annotations: safeReadOnlyAnnotations,
  },
];
