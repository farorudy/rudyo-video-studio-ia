import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { IncomingMessage } from "http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createServer() {
  const server = new McpServer({
    name: "rudyo-video-studio-ia",
    version: "1.0.0",
  });

  server.tool(
    "generate_storyboard",
    "Use this when the user wants to create a structured video storyboard.",
    {
      idea: z.string().min(1).describe("Main video idea"),
      duration: z
        .string()
        .optional()
        .describe("Target duration, for example 30s, 1min, 3min"),
      style: z
        .string()
        .optional()
        .describe("Video style: music clip, promo, training, documentary"),
      audience: z.string().optional().describe("Target audience"),
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
              `3. Développement : enchaînement des scènes principales.\n` +
              `4. Moment fort : plan émotionnel ou message central.\n` +
              `5. Conclusion : appel à l'action ou chute narrative.`,
          },
        ],
      };
    },
  );

  server.tool(
    "generate_script",
    "Use this when the user wants a video script or voice-over text.",
    {
      objective: z.string().min(1).describe("Goal of the video"),
      tone: z
        .string()
        .optional()
        .describe("Tone: professional, emotional, dynamic, educational"),
      duration: z.string().optional().describe("Target duration"),
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
              `Introduction : capter l'attention du spectateur.\n` +
              `Développement : présenter clairement le message principal.\n` +
              `Conclusion : terminer avec une phrase forte et une action claire.`,
          },
        ],
      };
    },
  );

  server.tool(
    "analyze_video_idea",
    "Use this when the user wants to evaluate or improve a video idea.",
    {
      idea: z.string().min(1).describe("Video idea to analyze"),
      goal: z
        .string()
        .optional()
        .describe("Goal: inform, sell, train, inspire, announce"),
      constraints: z
        .string()
        .optional()
        .describe("Budget, location, duration, team, equipment"),
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
              `Points forts : idée exploitable, adaptable en format court ou long.\n` +
              `À améliorer : préciser le public cible, le message central et le format final.\n` +
              `Recommandation : structurer la vidéo en accroche, développement, preuve, conclusion.`,
          },
        ],
      };
    },
  );

  server.tool(
    "organize_video_project",
    "Use this when the user wants to organize a video project into tasks and production steps.",
    {
      title: z.string().optional().describe("Project title"),
      brief: z.string().min(1).describe("Project brief"),
      deadline: z.string().optional().describe("Deadline"),
      resources: z
        .string()
        .optional()
        .describe("Available people, equipment, locations or files"),
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
              `6. Monter, vérifier, exporter.`,
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
  });

  await server.connect(transport);

  const body = request.method === "POST" ? await request.json() : undefined;

  // Cast the request to the expected type
  const incomingRequest = request as unknown as IncomingMessage & {
    auth?: AuthInfo;
  };

  return await transport.handleRequest(incomingRequest, body);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
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
