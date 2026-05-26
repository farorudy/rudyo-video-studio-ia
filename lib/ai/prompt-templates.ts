import { GenerateRequest, Scene, ImportedElement } from "./types";

export function getSystemPrompt(
  mode: "creative" | "expert" | "sovereign",
): string {
  const basePrompt = `Tu es un expert en production vidéo et en création de storyboards professionnels.
Tu génères des storyboards détaillés et structurés en JSON valide.
Chaque scène doit être claire, actionnable et prête pour la production.`;

  const modePrompts = {
    creative: `${basePrompt}
Tu favorises l'innovation visuelle, la créativité et les approches non-conventionnelles.
Produis des idées rapides, imaginatives et structurées.
Sois enthousiaste et propose des effets visuels modernes.`,

    expert: `${basePrompt}
Tu favorises la narration cohérente, la qualité narrative et les détails.
Produis des storyboards profonds, narratifs et très détaillés.
Considère la cinématographie, la psychologie du spectateur et les best practices.`,

    sovereign: `${basePrompt}
Tu favorises la clarté, l'efficacité économique et la compatibilité RGPD.
Produis des storyboards clairs, français, économiques et éthiques.
Utilise des ressources disponibles localement ou en open-source.
Respecte les normes de données personnelles.`,
  };

  return modePrompts[mode];
}

export function buildStoryboardPrompt(request: GenerateRequest): string {
  const format = request.format || "horizontal";
  const duration = request.duration || 60;
  const style = request.style || "cinéma";
  const tone = request.tone || "professionnel";

  return `Génère un storyboard vidéo professionnel pour le sujet suivant:

**Sujet:** ${request.topic}
**Objectif:** ${request.objective || "Engager et informer le public"}
**Public cible:** ${request.targetAudience || "Audience générale"}
**Durée recommandée:** ${duration} secondes
**Format:** ${format} (${format === "vertical" ? "9:16" : format === "horizontal" ? "16:9" : "1:1"})
**Style visuel:** ${style}
**Ton:** ${tone}
**Langue:** ${request.language || "Français"}

${request.customInstructions ? `**Instructions spécifiques:** ${request.customInstructions}` : ""}

**Important:**
1. Retourne UNIQUEMENT du JSON valide, sans texte supplémentaire
2. Divise le storyboard en 5-8 scènes logiques
3. Chaque scène doit avoir:
   - Un titre clair
   - Une description détaillée
   - Le texte à l'écran (maximum 20 caractères par ligne)
   - Une voix off (dialogues ou narration)
   - Une ambiance sonore (musique, bruitages)
   - Les mouvements de caméra (pan, zoom, tracking, etc.)
   - Le type de transition
   - Un prompt visuel pour chaque scène
   - Un prompt vidéo (si applicable)

4. Formate la réponse exactement comme ceci:
{
  "project": {
    "title": "...",
    "objective": "...",
    "targetAudience": "...",
    "recommendedDuration": ${duration},
    "recommendedFormat": "${format}",
    "visualStyle": "${style}",
    "tone": "${tone}",
    "language": "${request.language || "Français"}",
    "createdAt": "${new Date().toISOString()}",
    "aiMode": "${request.mode}",
    "aiProvider": "unknown"
  },
  "scenes": [
    {
      "id": 1,
      "title": "...",
      "description": "...",
      "duration": number,
      "onScreenText": "...",
      "voiceOver": "...",
      "soundscape": "...",
      "cameraMovement": "...",
      "transition": "...",
      "visualPrompt": "...",
      "videoPrompt": "..."
    }
  ],
  "metadata": {
    "totalDuration": number,
    "sceneCount": number,
    "requirements": ["..."],
    "importedElements": [
      {"type": "music|sound|image|video", "name": "...", "description": "...", "suggestedSource": "..."}
    ]
  }
}`;
}

export function buildScriptPrompt(request: GenerateRequest): string {
  return `Génère un script vidéo pour:
${request.topic}

Structure le script en scènes avec dialogues et actions.
Retourne en JSON structuré.`;
}
