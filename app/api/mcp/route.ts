import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
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
          description: "Durée cible",
        },
      },
      required: ["objective"],
    },
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
            "Objectif : informer, vendre, former, inspirer, annoncer",
        },
        constraints: {
          type: "string",
          description: "Contraintes : budget, lieu, durée, matériel, équipe",
        },
      },
      required: ["idea"],
    },
  },
  {
    name: "organize_video_project",
    description: "Organiser un projet vidéo en étapes de production.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Titre du projet",
        },
        brief: {
          type: "string",
          description: "Brief du projet vidéo",
        },
        deadline: {
          type: "string",
          description: "Échéance",
        },
        resources: {
          type: "string",
          description: "Personnes, matériels, lieux ou fichiers disponibles",
        },
      },
      required: ["brief"],
    },
  },
];

function jsonRpcResult(id: string | number | null | undefined, result: any) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  };
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  };
}

function callTool(name: string, args: any) {
  if (name === "generate_storyboard") {
    const idea = args?.idea ?? "";
    const duration = args?.duration ?? "non précisée";
    const style = args?.style ?? "non précisé";
    const audience = args?.audience ?? "non précisé";

    return {
      content: [
        {
          type: "text",
          text:
            `Storyboard généré pour : ${idea}\n\n` +
            `Durée : ${duration}\n` +
            `Style : ${style}\n` +
            `Public : ${audience}\n\n` +
            `1. Ouverture : plan d'accroche visuelle.\n` +
            `2. Mise en contexte : présentation du sujet.\n` +
            `3. Développement : enchaînement des scènes principales.\n` +
            `4. Moment fort : message central ou émotion forte.\n` +
            `5. Conclusion : appel à l'action ou chute narrative.\n\n` +
            `Prompt vidéo IA conseillé : cinematic professional video, strong visual storytelling, clean transitions, realistic lighting, high quality.`,
        },
      ],
    };
  }

  if (name === "generate_script") {
    const objective = args?.objective ?? "";
    const tone = args?.tone ?? "professionnel";
    const duration = args?.duration ?? "non précisée";

    return {
      content: [
        {
          type: "text",
          text:
            `Script vidéo\n\n` +
            `Objectif : ${objective}\n` +
            `Ton : ${tone}\n` +
            `Durée : ${duration}\n\n` +
            `Introduction : capter l'attention du spectateur.\n` +
            `Développement : présenter clairement le message principal.\n` +
            `Preuve : montrer un bénéfice concret ou une situation réelle.\n` +
            `Conclusion : terminer avec une phrase forte et un appel à l'action.`,
        },
      ],
    };
  }

  if (name === "analyze_video_idea") {
    const idea = args?.idea ?? "";
    const goal = args?.goal ?? "non précisé";
    const constraints = args?.constraints ?? "non précisées";

    return {
      content: [
        {
          type: "text",
          text:
            `Analyse de l'idée vidéo\n\n` +
            `Idée : ${idea}\n` +
            `Objectif : ${goal}\n` +
            `Contraintes : ${constraints}\n\n` +
            `Points forts : l'idée est exploitable et peut être adaptée en format court ou long.\n` +
            `À améliorer : préciser le public cible, le message central, le format final et le canal de diffusion.\n` +
            `Recommandation : structurer la vidéo en accroche, contexte, preuve, émotion et appel à l'action.`,
        },
      ],
    };
  }

  if (name === "organize_video_project") {
    const title = args?.title ?? "Projet vidéo";
    const brief = args?.brief ?? "";
    const deadline = args?.deadline ?? "non précisée";
    const resources = args?.resources ?? "non précisées";

    return {
      content: [
        {
          type: "text",
          text:
            `Organisation du projet vidéo\n\n` +
            `Titre : ${title}\n` +
            `Brief : ${brief}\n` +
            `Échéance : ${deadline}\n` +
            `Ressources : ${resources}\n\n` +
            `Étapes :\n` +
            `1. Clarifier l'objectif.\n` +
            `2. Écrire le script.\n` +
            `3. Préparer le storyboard.\n` +
            `4. Lister les besoins techniques.\n` +
            `5. Tourner ou générer les médias.\n` +
            `6. Monter la vidéo.\n` +
            `7. Vérifier, exporter et publier.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Outil inconnu : ${name}`,
      },
    ],
  };
}

function handleJsonRpc(message: JsonRpcRequest) {
  const id = message.id;

  if (message.method === "initialize") {
    return jsonRpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "rudyo-video-studio-ia",
        version: "1.0.0",
      },
    });
  }

  if (message.method === "notifications/initialized") {
    return null;
  }

  if (message.method === "tools/list") {
    return jsonRpcResult(id, {
      tools,
    });
  }

  if (message.method === "tools/call") {
    const toolName = message.params?.name;
    const toolArgs = message.params?.arguments ?? {};

    if (!toolName) {
      return jsonRpcError(id, -32602, "Nom de l'outil manquant.");
    }

    return jsonRpcResult(id, callTool(toolName, toolArgs));
  }

  return jsonRpcError(
    id,
    -32601,
    `Méthode MCP non supportée : ${message.method}`,
  );
}

export async function GET() {
  return NextResponse.json({
    success: true,
    name: "rudyo-video-studio-ia",
    message: "MCP server is running",
    endpoint: "/api/mcp",
    protocol: "JSON-RPC 2.0",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      const responses = body
        .map((message) => handleJsonRpc(message))
        .filter(Boolean);

      if (responses.length === 0) {
        return new Response(null, { status: 204 });
      }

      return NextResponse.json(responses);
    }

    const response = handleJsonRpc(body);

    if (!response) {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      jsonRpcError(null, -32700, "Erreur JSON-RPC : requête invalide."),
      { status: 400 },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    },
  });
}
