import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Rudyo Video Studio MCP",
    version: "1.0.0",
    description: "Serveur MCP pour la création de vidéos assistées par IA",
    author: "Rudy FARO",
    website: "https://farozik.com",

    tools: [
      {
        name: "generate_storyboard",
        description: "Générer un storyboard structuré pour une vidéo",
        input_schema: {
          type: "object",
          properties: {
            idea: {
              type: "string",
              description: "Idée principale de la vidéo",
            },
            duration: {
              type: "string",
              description: "Durée estimée (ex: 30s, 1min)",
            },
            style: {
              type: "string",
              description: "Style (clip musical, promo, formation...)",
            },
          },
          required: ["idea"],
        },
      },
      {
        name: "generate_script",
        description: "Créer un script vidéo complet",
        input_schema: {
          type: "object",
          properties: {
            idea: {
              type: "string",
              description: "Sujet de la vidéo",
            },
            tone: {
              type: "string",
              description: "Ton (pro, émotionnel, dynamique...)",
            },
          },
          required: ["idea"],
        },
      },
      {
        name: "analyze_video_idea",
        description: "Analyser et améliorer une idée de vidéo",
        input_schema: {
          type: "object",
          properties: {
            idea: {
              type: "string",
              description: "Idée à analyser",
            },
          },
          required: ["idea"],
        },
      },
      {
        name: "organize_video_project",
        description: "Structurer un projet vidéo complet",
        input_schema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Nom du projet",
            },
            brief: {
              type: "string",
              description: "Description du projet",
            },
          },
          required: ["brief"],
        },
      },
    ],
  });
}
