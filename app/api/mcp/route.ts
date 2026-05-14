import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createServer() {
  const server = new McpServer({
    name: "rudyo-video-studio-ia",
    version: "1.0.0",
  });

  server.tool(
    "generate_storyboard",
    "Créer un storyboard vidéo structuré à partir d'une idée.",
    {
      idea: z.string().min(1).describe("Idée principale de la vidéo"),
      duration: z.string().optional().describe("Durée cible : 30s, 1min, 3min"),
      style: z
        .string()
        .optional()
        .describe("Style : clip, promo, formation, documentaire"),
      audience: z.string().optional().describe("Public cible"),
    },
    async ({ idea, duration, style, audience }) => {
      return {
        content: [
          {
            type: "text",
            text:
              `Storyboard généré pour : ${idea}\n\n` +
              `Durée : ${duration ?? "non précisée"}\n` +
              `Style : ${style ?? "non précisé"}\n` +
              `Public : ${audience ?? "non précisé"}\n\n` +
              `1. Ouverture : plan d'accroche visuelle.\n` +
              `2. Mise en contexte : présentation du sujet.\n` +
              `3. Développement : scènes principales.\n` +
              `4. Moment fort : message central.\n` +
              `5. Conclusion : appel à l'action.`,
          },
        ],
      };
    },
  );

  server.tool(
    "generate_script",
    "Créer un script vidéo ou une voix off.",
    {
      objective: z.string().min(1).describe("Objectif de la vidéo"),
      tone: z
        .string()
        .optional()
        .describe("Ton : professionnel, émotionnel, dynamique, pédagogique"),
      duration: z.string().optional().describe("Durée cible"),
    },
    async ({ objective, tone, duration }) => {
      return {
        content: [
          {
            type: "text",
            text:
              `Script vidéo\n\n` +
              `Objectif : ${objective}\n` +
              `Ton : ${tone ?? "professionnel"}\n` +
              `Durée : ${duration ?? "non précisée"}\n\n` +
              `Introduction : capter l'attention.\n` +
              `Développement : présenter le message principal.\n` +
              `Conclusion : terminer avec une action claire.`,
          },
        ],
      };
    },
  );

  server.tool(
    "analyze_video_idea",
    "Analyser et améliorer une idée vidéo.",
    {
      idea: z.string().min(1).describe("Idée vidéo à analyser"),
      goal: z
        .string()
        .optional()
        .describe("Objectif : informer, vendre, former, inspirer, annoncer"),
      constraints: z
        .string()
        .optional()
        .describe("Contraintes : budget, lieu, durée, matériel"),
    },
    async ({ idea, goal, constraints }) => {
      return {
        content: [
          {
            type: "text",
            text:
              `Analyse de l'idée vidéo\n\n` +
              `Idée : ${idea}\n` +
              `Objectif : ${goal ?? "non précisé"}\n` +
              `Contraintes : ${constraints ?? "non précisées"}\n\n` +
              `Points forts : idée exploitable et adaptable.\n` +
              `À améliorer : préciser le public cible, le format et le message central.\n` +
              `Recommandation : structurer la vidéo en accroche, développement, preuve et conclusion.`,
          },
        ],
      };
    },
  );

  server.tool(
    "organize_video_project",
    "Organiser un projet vidéo en tâches de production.",
    {
      title: z.string().optional().describe("Titre du projet"),
      brief: z.string().min(1).describe("Brief du projet"),
      deadline: z.string().optional().describe("Échéance"),
      resources: z
        .string()
        .optional()
        .describe("Personnes, matériel, lieux ou fichiers disponibles"),
    },
    async ({ title, brief, deadline, resources }) => {
      return {
        content: [
          {
            type: "text",
            text:
              `Organisation du projet vidéo\n\n` +
              `Titre : ${title ?? "Projet vidéo"}\n` +
              `Brief : ${brief}\n` +
              `Échéance : ${deadline ?? "non précisée"}\n` +
              `Ressources : ${resources ?? "non précisées"}\n\n` +
              `Étapes :\n` +
              `1. Clarifier l'objectif.\n` +
              `2. Écrire le script.\n` +
              `3. Préparer le storyboard.\n` +
              `4. Lister les besoins techniques.\n` +
              `5. Tourner ou générer les médias.\n` +
              `6. Monter, vérifier et exporter.`,
          },
        ],
      };
    },
  );

  return server;
}

async function handleMcpRequest(request: Request) {
  const server = createServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  return transport.handleRequest(request);
}

export async function GET() {
  return Response.json({
    success: true,
    name: "rudyo-video-studio-ia",
    message: "MCP server is running",
    endpoint: "/api/mcp",
    note: "Use POST for MCP JSON-RPC requests.",
  });
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    },
  });
}
